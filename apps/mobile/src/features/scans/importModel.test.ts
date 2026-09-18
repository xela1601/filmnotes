import type { Frame, ScanAssignment } from '@filmnotes/domain';

import { assignTo, buildAssignments, moveAssignment } from './importModel';
import type { PickedFile } from './pickScans';
import { makeFrame } from '../../testing/fixtures';

const ROLL_ID = 'roll00000000001';

/** `frame0000000003` – the store only accepts 15-character ids. */
const frameId = (index: number): string => `frame${String(index).padStart(10, '0')}`;

function threeFrames(): Frame[] {
  return [3, 1, 2].map((frameNo) =>
    makeFrame({ id: frameId(frameNo), rollId: ROLL_ID, frameNo, notes: `note ${frameNo}` }),
  );
}

function pick(name: string): PickedFile {
  return { name, uri: `file:///cache/${name}`, mimeType: 'image/jpeg', size: 4 };
}

/** The lab's file names, deliberately in the wrong (lexical) order. */
const FILES = ['scan_10.jpg', 'scan_2.jpg', 'scan_1.jpg'].map(pick);

/** `fileName → frameNo` of an assignment list, for readable expectations. */
function mapping(assignments: ScanAssignment[]): Record<string, number | null> {
  return Object.fromEntries(
    [...assignments]
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((assignment) => [assignment.fileName, assignment.frameNo]),
  );
}

describe('buildAssignments', () => {
  it('hands the files to the frames in natural filename order', () => {
    const assignments = buildAssignments(FILES, threeFrames());

    expect(assignments).toEqual([
      { fileName: 'scan_1.jpg', sortIndex: 0, frameId: frameId(1), frameNo: 1 },
      { fileName: 'scan_2.jpg', sortIndex: 1, frameId: frameId(2), frameNo: 2 },
      { fileName: 'scan_10.jpg', sortIndex: 2, frameId: frameId(3), frameNo: 3 },
    ]);
  });

  it('leaves surplus files unassigned', () => {
    const frames = threeFrames().filter((frame) => frame.frameNo !== 3);

    expect(mapping(buildAssignments(FILES, frames))).toEqual({
      'scan_1.jpg': 1,
      'scan_2.jpg': 2,
      'scan_10.jpg': null,
    });
  });
});

describe('assignTo', () => {
  it('moves a scan onto a frame and unassigns the scan that was on it', () => {
    const frames = threeFrames();
    const assignments = buildAssignments(FILES, frames);

    expect(mapping(assignTo(assignments, frames, 0, frameId(3)))).toEqual({
      'scan_1.jpg': 3,
      'scan_2.jpg': 2,
      'scan_10.jpg': null,
    });
  });

  it('unassigns a single scan', () => {
    const frames = threeFrames();
    const assignments = buildAssignments(FILES, frames);

    expect(mapping(assignTo(assignments, frames, 1, null))).toEqual({
      'scan_1.jpg': 1,
      'scan_2.jpg': null,
      'scan_10.jpg': 3,
    });
  });

  it('keeps the frame id in step with the frame number', () => {
    const frames = threeFrames();
    const assignments = assignTo(buildAssignments(FILES, frames), frames, 0, frameId(3));

    expect(assignments[0]).toEqual({
      fileName: 'scan_1.jpg',
      sortIndex: 0,
      frameId: frameId(3),
      frameNo: 3,
    });
  });

  it('ignores a frame that does not belong to the roll any more', () => {
    const frames = threeFrames();
    const assignments = buildAssignments(FILES, frames);

    expect(assignTo(assignments, frames, 0, 'frame0000000404')).toBe(assignments);
  });
});

describe('moveAssignment', () => {
  it('shifts every assignment from the given row on by one frame', () => {
    const frames = threeFrames();
    const assignments = buildAssignments(FILES, frames);

    expect(mapping(moveAssignment(assignments, frames, 1, 1))).toEqual({
      'scan_1.jpg': 1,
      'scan_2.jpg': 3,
      'scan_10.jpg': null,
    });
  });

  it('does nothing when there is no frame left in that direction', () => {
    const frames = threeFrames();
    const assignments = buildAssignments(FILES, frames);

    expect(moveAssignment(assignments, frames, 0, -1)).toBe(assignments);
  });
});
