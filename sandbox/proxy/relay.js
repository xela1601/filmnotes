// Local relay: accepts unauthenticated CONNECT/HTTP proxy requests on 127.0.0.1 and
// forwards them to the sandbox proxy, injecting the Proxy-Authorization header that
// npm cannot send itself. Started by with-proxy.sh; writes its port to --port-file.
const net = require('net');
const http = require('http');

const upstream = new URL(process.env.HTTPS_PROXY || process.env.https_proxy);
const auth = 'Basic ' + Buffer.from(
  decodeURIComponent(upstream.username) + ':' + decodeURIComponent(upstream.password)
).toString('base64');
const UP_HOST = upstream.hostname;
const UP_PORT = Number(upstream.port || 3128);

const portFileIdx = process.argv.indexOf('--port-file');
const portFile = portFileIdx === -1 ? null : process.argv[portFileIdx + 1];

const server = http.createServer((req, res) => {
  const opts = {
    host: UP_HOST, port: UP_PORT, method: req.method, path: req.url,
    headers: { ...req.headers, 'proxy-authorization': auth },
  };
  const up = http.request(opts, (upRes) => {
    res.writeHead(upRes.statusCode, upRes.headers);
    upRes.pipe(res);
  });
  up.on('error', () => res.destroy());
  req.pipe(up);
});

server.on('connect', (req, clientSocket, head) => {
  const upSocket = net.connect(UP_PORT, UP_HOST, () => {
    upSocket.write(
      `CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\nProxy-Authorization: ${auth}\r\nProxy-Connection: Keep-Alive\r\n\r\n`
    );
  });
  let banner = Buffer.alloc(0);
  const onData = (chunk) => {
    banner = Buffer.concat([banner, chunk]);
    const end = banner.indexOf('\r\n\r\n');
    if (end === -1) return;
    const status = banner.slice(0, end).toString().split('\r\n')[0];
    upSocket.removeListener('data', onData);
    if (!/ 200 /.test(status)) {
      clientSocket.end(`HTTP/1.1 502 Bad Gateway\r\n\r\n${status}`);
      upSocket.destroy();
      return;
    }
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    const rest = banner.slice(end + 4);
    if (rest.length) clientSocket.write(rest);
    if (head && head.length) upSocket.write(head);
    upSocket.pipe(clientSocket);
    clientSocket.pipe(upSocket);
  };
  upSocket.on('data', onData);
  upSocket.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => upSocket.destroy());
});

// Port 0: the OS picks a free port, so several relays can run side by side.
server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  if (portFile) require('fs').writeFileSync(portFile, String(port));
  console.log(`relay listening on 127.0.0.1:${port}`);
});
