/**
 * Matching lab scans to the frames of a roll.
 *
 * Labs return files named in shooting order (`img1.jpg`, `img2.jpg`, ... or `000001.jpg`), so the
 * files are sorted naturally and handed to the frames ordered by frame number. The result is a
 * proposal the user corrects in the review screen with `shiftAssignments`.
 */
import type { Frame, Id } from './types';

export interface ScanAssignment {
  fileName: string;
  /** Position of the file in the natural order, 0 based. */
  sortIndex: number;
  frameId: Id | null;
  frameNo: number | null;
}

const NUMERIC = /^\d+$/;

/** Splits a name into runs of digits and non-digits, lower cased. */
function chunksOf(value: string): string[] {
  return value.toLowerCase().match(/\d+|\D+/g) ?? [];
}

/**
 * Compares file names the way a file browser does: embedded numbers count numerically, so
 * `img2.jpg` comes before `img10.jpg`. Case is ignored.
 */
export function naturalCompare(a: string, b: string): number {
  const left = chunksOf(a);
  const right = chunksOf(b);
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    const leftChunk = left[index] ?? '';
    const rightChunk = right[index] ?? '';
    if (leftChunk === rightChunk) continue;
    if (NUMERIC.test(leftChunk) && NUMERIC.test(rightChunk)) {
      const difference = Number(leftChunk) - Number(rightChunk);
      if (difference !== 0) return difference < 0 ? -1 : 1;
      continue;
    }
    // A number meets text (`img.jpg` vs `img2.jpg`): the chunks are not aligned any more, so the
    // rest of both names decides, plainly.
    const leftRest = left.slice(index).join('');
    const rightRest = right.slice(index).join('');
    return leftRest < rightRest ? -1 : 1;
  }
  if (left.length === right.length) return 0;
  return left.length < right.length ? -1 : 1;
}

/** The frames a scan can be assigned to: not deleted, ordered by frame number. */
function orderedFrames(frames: Frame[]): Frame[] {
  return frames.filter((frame) => frame.deleted === null).sort((a, b) => a.frameNo - b.frameNo);
}

function assign(fileName: string, sortIndex: number, frame: Frame | undefined): ScanAssignment {
  return {
    fileName,
    sortIndex,
    frameId: frame?.id ?? null,
    frameNo: frame?.frameNo ?? null,
  };
}

/**
 * Proposes one frame per file: the n-th file in natural order goes to the n-th frame of the roll.
 * Surplus files stay unassigned; surplus frames are simply not used.
 */
export function matchScansToFrames(fileNames: string[], frames: Frame[]): ScanAssignment[] {
  const ordered = orderedFrames(frames);
  return [...fileNames]
    .sort(naturalCompare)
    .map((fileName, sortIndex) => assign(fileName, sortIndex, ordered[sortIndex]));
}

/**
 * Moves every assignment from `fromSortIndex` on by one frame – the fix for a lab that dropped or
 * added a scan. Assignments that run past the last frame become unassigned.
 *
 * The shift never creates a duplicate: if the frame it would move onto is already taken by an
 * earlier scan (or there is no earlier frame left), nothing happens and the input is returned.
 */
export function shiftAssignments(
  assignments: ScanAssignment[],
  frames: Frame[],
  fromSortIndex: number,
  direction: 1 | -1,
): ScanAssignment[] {
  const ordered = orderedFrames(frames);
  const indexOfFrameNo = new Map<number, number>(ordered.map((frame, index) => [frame.frameNo, index]));
  const positionOf = (assignment: ScanAssignment): number =>
    assignment.frameNo === null ? -1 : indexOfFrameNo.get(assignment.frameNo) ?? -1;

  const sorted = [...assignments].sort((a, b) => a.sortIndex - b.sortIndex);
  const moving = sorted.filter((assignment) => assignment.sortIndex >= fromSortIndex);
  const staying = sorted.filter((assignment) => assignment.sortIndex < fromSortIndex);

  const anchor = moving.findIndex((assignment) => assignment.frameNo !== null);
  if (anchor === -1) return assignments;
  const anchorPosition = positionOf(moving[anchor] as ScanAssignment);
  if (anchorPosition === -1) return assignments;

  const base = anchorPosition + direction - anchor;
  const taken = new Set(staying.map(positionOf));
  const targets = moving.map((_, offset) => base + offset);
  if (targets.some((target) => target >= 0 && target < ordered.length && taken.has(target))) {
    return assignments;
  }
  if (targets.some((target) => target < 0)) return assignments;

  const shifted = new Map<number, ScanAssignment>(
    moving.map((assignment, offset) => [
      assignment.sortIndex,
      assign(assignment.fileName, assignment.sortIndex, ordered[base + offset]),
    ]),
  );
  return sorted.map((assignment) => shifted.get(assignment.sortIndex) ?? assignment);
}
