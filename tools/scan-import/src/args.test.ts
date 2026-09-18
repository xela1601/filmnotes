import { ArgumentError, parseArgs } from './args';

const BASE = [
  '--server',
  'https://pb.example.com',
  '--email',
  'me@example.com',
  '--roll',
  'roll100000000000',
];

describe('parseArgs', () => {
  it('reads every flag plus the source argument', () => {
    expect(
      parseArgs([...BASE, '--password', 'secret', '--yes', '--dry-run', '/scans/roll-42'], {}),
    ).toEqual({
      server: 'https://pb.example.com',
      email: 'me@example.com',
      password: 'secret',
      roll: 'roll100000000000',
      source: '/scans/roll-42',
      yes: true,
      dryRun: true,
    });
  });

  it('defaults yes and dryRun to false and leaves the password undefined', () => {
    const args = parseArgs([...BASE, '/scans/roll-42'], {});
    expect(args.yes).toBe(false);
    expect(args.dryRun).toBe(false);
    expect(args.password).toBeUndefined();
  });

  it('accepts --flag=value as well as --flag value', () => {
    const args = parseArgs(
      ['--server=https://pb.example.com', '--email=me@example.com', '--roll=roll100000000000', 'scans.zip'],
      {},
    );
    expect(args.server).toBe('https://pb.example.com');
    expect(args.email).toBe('me@example.com');
    expect(args.roll).toBe('roll100000000000');
    expect(args.source).toBe('scans.zip');
  });

  it('accepts -y as a short form of --yes', () => {
    expect(parseArgs([...BASE, '-y', 'scans.zip'], {}).yes).toBe(true);
  });

  it('takes the password from FILMNOTES_PASSWORD when the flag is missing', () => {
    expect(parseArgs([...BASE, 'scans.zip'], { FILMNOTES_PASSWORD: 'from-env' }).password).toBe(
      'from-env',
    );
  });

  it('prefers the flag over the environment', () => {
    expect(
      parseArgs([...BASE, '--password', 'from-flag', 'scans.zip'], { FILMNOTES_PASSWORD: 'from-env' })
        .password,
    ).toBe('from-flag');
  });

  it('ignores an empty FILMNOTES_PASSWORD', () => {
    expect(parseArgs([...BASE, 'scans.zip'], { FILMNOTES_PASSWORD: '' }).password).toBeUndefined();
  });

  it('rejects a missing --roll', () => {
    const argv = ['--server', 'https://pb.example.com', '--email', 'me@example.com', 'scans.zip'];
    expect(() => parseArgs(argv, {})).toThrow(ArgumentError);
    expect(() => parseArgs(argv, {})).toThrow(/--roll/);
  });

  it('rejects a missing source', () => {
    expect(() => parseArgs([...BASE], {})).toThrow(/source/);
  });

  it('rejects a second source', () => {
    expect(() => parseArgs([...BASE, 'a.zip', 'b.zip'], {})).toThrow(/one/);
  });

  it('rejects a missing --server and a missing --email', () => {
    expect(() => parseArgs(['--email', 'me@example.com', '--roll', 'r', 'a.zip'], {})).toThrow(
      /--server/,
    );
    expect(() => parseArgs(['--server', 'https://pb', '--roll', 'r', 'a.zip'], {})).toThrow(/--email/);
  });

  it('rejects an unknown flag', () => {
    expect(() => parseArgs([...BASE, '--frames', '3', 'a.zip'], {})).toThrow(/--frames/);
  });

  it('rejects a flag without a value', () => {
    expect(() => parseArgs(['--server', 'https://pb', '--email'], {})).toThrow(/--email/);
  });
});
