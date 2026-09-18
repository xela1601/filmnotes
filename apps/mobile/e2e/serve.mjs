/**
 * Static file server for the exported web bundle, shared by every e2e runner.
 *
 * Single-page output: any path that is not a file falls back to index.html, which is what
 * expo-router needs to resolve a deep link like /rolls/new on a plain static host.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const CONTENT_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".map": "application/json",
};

/** Serves `root` as a single-page app: unknown paths fall back to index.html. */
export async function startStaticServer(root, port) {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    for (const candidate of [
      join(root, path),
      join(root, path, "index.html"),
      join(root, "index.html"),
    ]) {
      try {
        const body = await readFile(candidate);
        response.writeHead(200, {
          "content-type": CONTENT_TYPES[extname(candidate)] ?? "application/octet-stream",
        });
        response.end(body);
        return;
      } catch {
        /* try the next candidate */
      }
    }
    response.writeHead(404).end("not found");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    base: `http://127.0.0.1:${port}`,
    close: () => server.close(),
  };
}
