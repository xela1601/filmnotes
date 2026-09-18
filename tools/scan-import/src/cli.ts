#!/usr/bin/env node
/**
 * Entry point of the `filmnotes-import` binary: wires the real terminal to `main`.
 *
 * Run the built file (`node dist/cli.js …`, which is what the `filmnotes-import` bin points at)
 * or the source directly with `npx tsx src/cli.ts …`.
 */
import { createInterface } from 'node:readline';

import type { Io, PromptOptions } from './main';
import { main } from './main';

/** The readline internals used to suppress the echo of a hidden answer. */
interface MutableInterface {
  _writeToOutput(text: string): void;
  output: { write(text: string): void } | null;
}

/**
 * Asks a question on the terminal. With `hidden`, readline's echo is replaced by one that only
 * ever writes the question itself, so a typed password never reaches the screen, the scrollback
 * or a log file.
 */
async function ask(question: string, options?: PromptOptions): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (options?.hidden === true) {
    const internals = rl as unknown as MutableInterface;
    internals._writeToOutput = (text: string): void => {
      if (text.includes(question)) internals.output?.write(question);
    };
  }
  try {
    const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
    if (options?.hidden === true) process.stdout.write('\n');
    return answer;
  } finally {
    rl.close();
  }
}

const io: Io = {
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
  prompt: ask,
};

main(process.argv.slice(2), io).then(
  (code) => process.exit(code),
  (error: unknown) => {
    process.stderr.write(`filmnotes-import: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  },
);
