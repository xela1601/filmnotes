import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Frame, Id } from '@filmnotes/domain';
import { makeFrame } from '@filmnotes/domain';

import type { Deps, ImportClient, Io, PromptOptions } from './main';
import { main } from './main';
import { jpegBytes } from './testImages';

const SERVER = 'https://pb.example.com';
const ROLL: Id = 'roll10000000000';
const OWNER: Id = 'owner1000000000';

let source: string;

beforeEach(() => {
  source = mkdtempSync(join(tmpdir(), 'scan-import-main-test-'));
  for (const name of ['img1.jpg', 'img2.jpg', 'img3.jpg']) {
    writeFileSync(join(source, name), jpegBytes());
  }
});

afterEach(() => {
  rmSync(source, { recursive: true, force: true });
});

interface Recorded {
  io: Io;
  out: string[];
  err: string[];
  prompts: { question: string; options: PromptOptions | undefined }[];
}

/** An `io` that collects the output and answers the prompts from a queue. */
function recordIo(answers: string[] = []): Recorded {
  const out: string[] = [];
  const err: string[] = [];
  const prompts: { question: string; options: PromptOptions | undefined }[] = [];
  const queue = [...answers];
  return {
    out,
    err,
    prompts,
    io: {
      stdout: (text) => out.push(text),
      stderr: (text) => err.push(text),
      prompt: async (question, options) => {
        prompts.push({ question, options });
        return queue.shift() ?? '';
      },
    },
  };
}

interface Fake {
  deps: Deps;
  logins: { email: string; password: string }[];
  created: Record<string, unknown>[];
  servers: string[];
}

function frames(count: number): Frame[] {
  return Array.from({ length: count }, (_, index) =>
    makeFrame({
      id: `frame${String(index + 1).padStart(10, '0')}`,
      rollId: ROLL,
      frameNo: index + 1,
      notes: `frame ${index + 1} notes`,
    }),
  );
}

function fakeDeps(
  options: {
    frames?: Frame[];
    loginError?: string;
    failCreate?: string[];
  } = {},
): Fake {
  const logins: { email: string; password: string }[] = [];
  const created: Record<string, unknown>[] = [];
  const servers: string[] = [];

  const client: ImportClient = {
    async authWithPassword(email, password) {
      logins.push({ email, password });
      if (options.loginError !== undefined) throw new Error(options.loginError);
      return { userId: OWNER };
    },
    async listFrames() {
      return options.frames ?? frames(3);
    },
    collection: () => ({
      async create(data) {
        if (options.failCreate?.includes(String(data.fileName)) === true) {
          throw new Error(`create refused ${String(data.fileName)}`);
        }
        created.push(data);
        return { id: String(data.id) };
      },
      async update(id) {
        return { id };
      },
    }),
  };

  return {
    logins,
    created,
    servers,
    deps: {
      async createClient(server) {
        servers.push(server);
        return client;
      },
    },
  };
}

function argv(extra: string[] = []): string[] {
  return ['--server', SERVER, '--email', 'me@example.com', '--roll', ROLL, ...extra, source];
}

describe('main', () => {
  it('prints the plan and uploads after a confirmed prompt', async () => {
    const io = recordIo(['y']);
    const fake = fakeDeps();

    const code = await main(argv(['--password', 'secret']), io.io, fake.deps);

    expect(code).toBe(0);
    expect(fake.servers).toEqual([SERVER]);
    expect(fake.logins).toEqual([{ email: 'me@example.com', password: 'secret' }]);
    expect(io.prompts).toHaveLength(1);
    expect(io.prompts[0]!.question).toMatch(/upload/i);
    const output = io.out.join('\n');
    expect(output).toContain('img1.jpg');
    expect(output).toContain('#1');
    expect(output).toContain('frame 1 notes');
    expect(fake.created.map((record) => record.fileName)).toEqual([
      'img1.jpg',
      'img2.jpg',
      'img3.jpg',
    ]);
    expect(fake.created.every((record) => record.owner === OWNER)).toBe(true);
    expect(output).toMatch(/Uploaded 3 of 3/);
  });

  it('uploads nothing and exits with 1 when the prompt is declined', async () => {
    const io = recordIo(['n']);
    const fake = fakeDeps();

    const code = await main(argv(['--password', 'secret']), io.io, fake.deps);

    expect(code).toBe(1);
    expect(fake.created).toEqual([]);
    expect(io.out.join('\n')).toMatch(/aborted/i);
  });

  it('does not ask with --yes', async () => {
    const io = recordIo();
    const fake = fakeDeps();

    const code = await main(argv(['--password', 'secret', '--yes']), io.io, fake.deps);

    expect(code).toBe(0);
    expect(io.prompts).toEqual([]);
    expect(fake.created).toHaveLength(3);
  });

  it('never uploads with --dry-run', async () => {
    const io = recordIo();
    const fake = fakeDeps();

    const code = await main(argv(['--password', 'secret', '--dry-run']), io.io, fake.deps);

    expect(code).toBe(0);
    expect(io.prompts).toEqual([]);
    expect(fake.created).toEqual([]);
    expect(io.out.join('\n')).toMatch(/dry run/i);
  });

  it('asks for the password without echoing it', async () => {
    const io = recordIo(['typed-password', 'y']);
    const fake = fakeDeps();

    const code = await main(argv(), io.io, fake.deps);

    expect(code).toBe(0);
    expect(io.prompts[0]!.question).toMatch(/password/i);
    expect(io.prompts[0]!.options).toEqual({ hidden: true });
    expect(fake.logins[0]!.password).toBe('typed-password');
    expect(io.out.join('\n')).not.toContain('typed-password');
    expect(io.err.join('\n')).not.toContain('typed-password');
  });

  it('reports a failed login without uploading', async () => {
    const io = recordIo();
    const fake = fakeDeps({ loginError: 'Failed to authenticate.' });

    const code = await main(argv(['--password', 'wrong', '--yes']), io.io, fake.deps);

    expect(code).toBe(1);
    expect(io.err.join('\n')).toContain('Failed to authenticate.');
    expect(io.err.join('\n')).not.toContain('wrong');
    expect(fake.created).toEqual([]);
  });

  it('stops when the roll has no frames', async () => {
    const io = recordIo();
    const fake = fakeDeps({ frames: [] });

    const code = await main(argv(['--password', 'secret', '--yes']), io.io, fake.deps);

    expect(code).toBe(1);
    expect(io.err.join('\n')).toMatch(new RegExp(ROLL));
    expect(fake.created).toEqual([]);
  });

  it('stops when the source holds no images', async () => {
    rmSync(source, { recursive: true, force: true });
    mkdirSync(source);
    const io = recordIo();
    const fake = fakeDeps();

    const code = await main(argv(['--password', 'secret', '--yes']), io.io, fake.deps);

    expect(code).toBe(1);
    expect(io.err.join('\n')).toMatch(/no image/i);
  });

  it('exits with 1 when a single file failed', async () => {
    const io = recordIo();
    const fake = fakeDeps({ failCreate: ['img2.jpg'] });

    const code = await main(argv(['--password', 'secret', '--yes']), io.io, fake.deps);

    expect(code).toBe(1);
    expect(io.out.join('\n')).toMatch(/Uploaded 2 of 3/);
    expect(io.err.join('\n')).toContain('img2.jpg');
  });

  it('answers a usage mistake with the usage text and exit code 2', async () => {
    const io = recordIo();
    const fake = fakeDeps();

    const code = await main(['--server', SERVER, '--email', 'me@example.com', source], io.io, fake.deps);

    expect(code).toBe(2);
    expect(io.err.join('\n')).toContain('--roll');
    expect(io.err.join('\n')).toContain('Usage: filmnotes-import');
    expect(fake.servers).toEqual([]);
  });

  it('prints the usage with --help and exits with 0', async () => {
    const io = recordIo();
    const fake = fakeDeps();

    const code = await main(['--help'], io.io, fake.deps);

    expect(code).toBe(0);
    expect(io.out.join('\n')).toContain('Usage: filmnotes-import');
    expect(fake.servers).toEqual([]);
  });

  it('reads the password from FILMNOTES_PASSWORD', async () => {
    const io = recordIo();
    const fake = fakeDeps();
    const previous = process.env.FILMNOTES_PASSWORD;
    process.env.FILMNOTES_PASSWORD = 'from-env';
    try {
      const code = await main(argv(['--yes']), io.io, fake.deps);
      expect(code).toBe(0);
      expect(io.prompts).toEqual([]);
      expect(fake.logins[0]!.password).toBe('from-env');
    } finally {
      if (previous === undefined) delete process.env.FILMNOTES_PASSWORD;
      else process.env.FILMNOTES_PASSWORD = previous;
    }
  });
});
