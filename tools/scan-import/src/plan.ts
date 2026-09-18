/**
 * The import plan: which file goes to which frame, and how that is shown in a terminal.
 *
 * The matching itself lives in `@filmnotes/domain` (`matchScansToFrames`), so the CLI and the
 * in-app import propose exactly the same mapping.
 */
import type { Frame, ScanAssignment } from '@filmnotes/domain';
import { matchScansToFrames } from '@filmnotes/domain';

import type { ImageFile } from './files';

/** How much of a frame's notes the table shows, including the ellipsis. */
const NOTES_WIDTH = 40;

/** Proposes one frame per file: n-th file in natural order → n-th frame of the roll. */
export function planImport(files: ImageFile[], frames: Frame[]): ScanAssignment[] {
  return matchScansToFrames(
    files.map((file) => file.name),
    frames,
  );
}

/** The frame notes on a single line, shortened to `NOTES_WIDTH`. */
function notesOf(assignment: ScanAssignment, frames: Frame[]): string {
  const frame = frames.find((candidate) => candidate.id === assignment.frameId);
  const notes = (frame?.notes ?? '').replace(/\s+/g, ' ').trim();
  if (notes.length <= NOTES_WIDTH) return notes;
  return `${notes.slice(0, NOTES_WIDTH - 1)}…`;
}

/** Pads every column to the width of its widest cell and joins the rows with `|`. */
function table(header: string[], rows: string[][]): string {
  const widths = header.map((_, column) =>
    Math.max(...[header, ...rows].map((row) => (row[column] ?? '').length)),
  );
  const line = (row: string[]): string =>
    row
      .map((cell, column) => cell.padEnd(widths[column] as number))
      .join(' | ')
      .trimEnd();
  const separator = widths.map((width) => '-'.repeat(width)).join('-+-');
  return [line(header), separator, ...rows.map(line)].join('\n');
}

/**
 * The plan as a table: index, file name, target frame, first characters of the frame's notes.
 * Files the roll has no frame for are marked `(unassigned)` – they are still uploaded and can
 * be attached in the app's review screen.
 */
export function renderPlan(assignments: ScanAssignment[], frames: Frame[]): string {
  const rows = [...assignments]
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((assignment) => [
      String(assignment.sortIndex + 1),
      assignment.fileName,
      assignment.frameNo === null ? '(unassigned)' : `#${assignment.frameNo}`,
      notesOf(assignment, frames),
    ]);
  return table(['#', 'file', 'frame', 'notes'], rows);
}

/** The number of files the plan could not assign to a frame. */
export function unassignedCount(assignments: ScanAssignment[]): number {
  return assignments.filter((assignment) => assignment.frameId === null).length;
}
