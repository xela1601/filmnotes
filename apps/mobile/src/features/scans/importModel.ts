/**
 * The state of the scan review screen: which file goes onto which frame.
 *
 * Pure on purpose – the screen keeps the returned list in `useState` and every correction
 * is a new list. The matching rules themselves live in `@filmnotes/domain`
 * (`matchScansToFrames`, `shiftAssignments`); this module only adds the explicit pick,
 * which needs a frame lookup and therefore the roll's frames.
 */
import { matchScansToFrames, shiftAssignments } from '@filmnotes/domain';
import type { Frame, Id, ScanAssignment } from '@filmnotes/domain';

import type { PickedFile } from './pickScans';

/** The initial proposal: the n-th file in natural name order onto the n-th frame. */
export function buildAssignments(files: PickedFile[], frames: Frame[]): ScanAssignment[] {
  return matchScansToFrames(
    files.map((file) => file.name),
    frames,
  );
}

/**
 * Moves every assignment from `sortIndex` on by one frame – the fix for a lab that dropped
 * or added a scan. Returns the input unchanged when the shift would run out of frames or
 * collide with an earlier scan.
 */
export function moveAssignment(
  assignments: ScanAssignment[],
  frames: Frame[],
  sortIndex: number,
  direction: 1 | -1,
): ScanAssignment[] {
  return shiftAssignments(assignments, frames, sortIndex, direction);
}

/**
 * Puts one scan onto one frame, or unassigns it with `frameId = null`.
 *
 * A frame holds at most one scan, so the scan that was on the target frame is unassigned.
 * A `frameId` that is not a live frame of this roll is ignored (the frame was deleted in
 * another tab while the review screen was open).
 */
export function assignTo(
  assignments: ScanAssignment[],
  frames: Frame[],
  sortIndex: number,
  frameId: Id | null,
): ScanAssignment[] {
  const target =
    frameId === null
      ? null
      : frames.find((frame) => frame.id === frameId && frame.deleted === null) ?? null;
  if (frameId !== null && target === null) return assignments;

  return assignments.map((assignment) => {
    if (assignment.sortIndex === sortIndex) {
      return { ...assignment, frameId: target?.id ?? null, frameNo: target?.frameNo ?? null };
    }
    if (target !== null && assignment.frameId === target.id) {
      return { ...assignment, frameId: null, frameNo: null };
    }
    return assignment;
  });
}
