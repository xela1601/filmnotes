#!/usr/bin/env node
/**
 * Entry point of the `filmnotes-import` binary: wires the real terminal to `main`.
 *
 * Run it through the `filmnotes-import` bin (`bin/filmnotes-import.cjs`, which registers tsx)
 * or directly with `npx tsx src/cli.ts …`.
 */
import { createInterface } from 'node:readline';
import type { Interface } from 'node:readline';

import type { Io, PromptOptions } from './main';
import { main } from './main';
import { createPocketBaseClient } from './pb';

/** The readline internals used to suppress the echo of a hidden answer. */
interface MutableInterface {
  _writeToOutput(text: string): void;
  output: { write(text: string): void } | null;
}

/** True when a person is typing; false when the answers come from a pipe or a file. */
const interactive = process.stdin.isTTY === true;

/**
 * One readline interface for the whole run: readline reads ahead, so a second interface would
 * find a stream that the first one has already drained.
 */
let reader: Interface | null = null;

function lineReader(): Interface {
  if (reader === null) {
    reader = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  }
  return reader;
}

/**
 * The lines of a non-interactive stdin, read once and in full.
 *
 * A pipe (`printf 'secret\ny\n' | filmnotes-import …`) delivers everything at once, and readline
 * would drop the lines that arrive before the next question is asked, so the answers are buffered
 * here instead. Missing lines come back as `''`, which every caller reads as "no".
 */
let pipedLines: string[] | null = null;

async function nextPipedLine(): Promise<string> {
  if (pipedLines === null) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    pipedLines = Buffer.concat(chunks).toString('utf8').split('\n');
  }
  return pipedLines.shift() ?? '';
}

/** Asks on a terminal, suppressing the echo for a hidden answer (the password). */
async function askInteractively(question: string, options?: PromptOptions): Promise<string> {
  const rl = lineReader();
  const internals = rl as unknown as MutableInterface;
  const echo = internals._writeToOutput.bind(rl);
  if (options?.hidden === true) {
    internals._writeToOutput = (text: string): void => {
      if (text.includes(question)) internals.output?.write(question);
    };
  }
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.once('close', () => resolve(''));
      rl.question(question, resolve);
    });
    // The user's own Enter ends the line, except when the echo was suppressed.
    if (options?.hidden === true) process.stdout.write('\n');
    return answer;
  } finally {
    internals._writeToOutput = echo;
  }
}

/**
 * Asks a question and returns the answer. A typed password never reaches the screen, the
 * scrollback or a log file; a piped one is not echoed by anyone in the first place.
 */
async function ask(question: string, options?: PromptOptions): Promise<string> {
  if (interactive) return askInteractively(question, options);
  process.stdout.write(question);
  const answer = await nextPipedLine();
  process.stdout.write('\n');
  return answer;
}

const io: Io = {
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
  prompt: ask,
};

main(process.argv.slice(2), io, { createClient: createPocketBaseClient }).then(
  (code) => {
    reader?.close();
    process.exit(code);
  },
  (error: unknown) => {
    reader?.close();
    process.stderr.write(
      `filmnotes-import: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  },
);
