import { makeFrame } from "./fixtures";
import { matchScansToFrames, naturalCompare, shiftAssignments } from "./scanMatching";
import type { Frame } from "./types";

function frame(frameNo: number, overrides: Partial<Frame> = {}): Frame {
  return makeFrame({
    id: `frame${String(frameNo).padStart(2, "0")}0000000`,
    frameNo,
    ...overrides,
  });
}

const frames = [frame(1), frame(2), frame(3)];

describe("naturalCompare", () => {
  it("sorts embedded numbers numerically", () => {
    expect(naturalCompare("img2.jpg", "img10.jpg")).toBeLessThan(0);
    expect(naturalCompare("img10.jpg", "img2.jpg")).toBeGreaterThan(0);
  });

  it("ignores case", () => {
    expect(naturalCompare("IMG10.jpg", "img2.jpg")).toBeGreaterThan(0);
    expect(naturalCompare("IMG2.jpg", "img2.jpg")).toBe(0);
  });

  it("sorts zero padded numbers", () => {
    expect(naturalCompare("000001.jpg", "000002.jpg")).toBeLessThan(0);
  });

  it("sorts a prefix before the longer name", () => {
    expect(naturalCompare("img.jpg", "img2.jpg")).toBeLessThan(0);
  });
});

describe("matchScansToFrames", () => {
  it("assigns the naturally sorted files to the frames in order", () => {
    expect(matchScansToFrames(["b10.jpg", "b2.jpg", "b1.jpg"], frames)).toEqual([
      { fileName: "b1.jpg", sortIndex: 0, frameId: frames[0]?.id, frameNo: 1 },
      { fileName: "b2.jpg", sortIndex: 1, frameId: frames[1]?.id, frameNo: 2 },
      { fileName: "b10.jpg", sortIndex: 2, frameId: frames[2]?.id, frameNo: 3 },
    ]);
  });

  it("leaves surplus scans unassigned", () => {
    const assignments = matchScansToFrames(["a1.jpg", "a2.jpg", "a3.jpg", "a4.jpg"], frames);
    expect(assignments[3]).toEqual({
      fileName: "a4.jpg",
      sortIndex: 3,
      frameId: null,
      frameNo: null,
    });
  });

  it("uses only as many frames as there are scans", () => {
    const assignments = matchScansToFrames(["a1.jpg"], frames);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.frameNo).toBe(1);
  });

  it("ignores deleted frames", () => {
    const withDeleted = [frame(1), frame(2, { deleted: "2026-09-19T00:00:00.000Z" }), frame(3)];
    const assignments = matchScansToFrames(["a1.jpg", "a2.jpg"], withDeleted);
    expect(assignments.map((assignment) => assignment.frameNo)).toEqual([1, 3]);
  });

  it("sorts the frames by frame number regardless of input order", () => {
    const shuffled = [frame(3), frame(1), frame(2)];
    const assignments = matchScansToFrames(["a1.jpg", "a2.jpg", "a3.jpg"], shuffled);
    expect(assignments.map((assignment) => assignment.frameNo)).toEqual([1, 2, 3]);
  });
});

describe("matchScansToFrames with the lab's file-name pattern", () => {
  const DM = "Neg\\.Nr\\.(\\d+)";
  const roll = Array.from({ length: 36 }, (_, index) => frame(index + 1));
  // The twelve files of the first dm delivery: negatives 25-36, numbered from 0 by the lab.
  const delivery = Array.from(
    { length: 12 },
    (_, index) => `_Bild${String(index).padStart(3, "0")}_Neg.Nr.${index + 25}.jpg`,
  );

  it("puts every scan on the frame its name carries, not on the n-th frame", () => {
    const assignments = matchScansToFrames(delivery, roll, DM);

    expect(assignments.map((assignment) => assignment.frameNo)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 25),
    );
    expect(assignments[0]).toEqual({
      fileName: "_Bild000_Neg.Nr.25.jpg",
      sortIndex: 0,
      frameId: roll[24]?.id,
      frameNo: 25,
    });
  });

  it("keeps the natural order when the pattern matches no name at all", () => {
    expect(matchScansToFrames(["IMG_0002.JPG", "IMG_0001.JPG"], frames, DM)).toEqual(
      matchScansToFrames(["IMG_0002.JPG", "IMG_0001.JPG"], frames),
    );
  });

  it("leaves a name the pattern misses, and a second claim on one frame, unassigned", () => {
    const assignments = matchScansToFrames(
      ["_Bild000_Neg.Nr.2.jpg", "contact-sheet.jpg", "_Bild001_Neg.Nr.2.jpg"],
      frames,
      DM,
    );

    expect(assignments.map(({ fileName, frameNo }) => ({ fileName, frameNo }))).toEqual([
      { fileName: "_Bild000_Neg.Nr.2.jpg", frameNo: 2 },
      { fileName: "_Bild001_Neg.Nr.2.jpg", frameNo: null },
      { fileName: "contact-sheet.jpg", frameNo: null },
    ]);
  });

  it("leaves a scan unassigned whose frame the roll does not have", () => {
    expect(matchScansToFrames(["_Bild000_Neg.Nr.7.jpg"], frames, DM)[0]?.frameNo).toBeNull();
  });
});

describe("shiftAssignments", () => {
  const assignments = matchScansToFrames(["a1.jpg", "a2.jpg", "a3.jpg"], frames);

  it("moves every assignment from the given index to the next frame", () => {
    const shifted = shiftAssignments(assignments, frames, 1, 1);
    expect(shifted.map((assignment) => assignment.frameNo)).toEqual([1, 3, null]);
    expect(shifted.map((assignment) => assignment.fileName)).toEqual([
      "a1.jpg",
      "a2.jpg",
      "a3.jpg",
    ]);
  });

  it("moves them back again", () => {
    const shifted = shiftAssignments(assignments, frames, 1, 1);
    const restored = shiftAssignments(shifted, frames, 1, -1);
    expect(restored).toEqual(assignments);
  });

  it("does nothing when the previous frame is already taken", () => {
    expect(shiftAssignments(assignments, frames, 1, -1)).toBe(assignments);
  });

  it("does nothing when there is no earlier frame left", () => {
    expect(shiftAssignments(assignments, frames, 0, -1)).toBe(assignments);
  });

  it("does nothing when nothing from the given index is assigned", () => {
    const tail = matchScansToFrames(["a1.jpg", "a2.jpg", "a3.jpg", "a4.jpg"], frames);
    expect(shiftAssignments(tail, frames, 3, 1)).toBe(tail);
  });

  it("pulls an unassigned scan onto the freed frame when shifting back", () => {
    const shifted = shiftAssignments(assignments, frames, 0, 1);
    expect(shifted.map((assignment) => assignment.frameNo)).toEqual([2, 3, null]);
    expect(shiftAssignments(shifted, frames, 0, -1)).toEqual(assignments);
  });

  it("does not touch the input array", () => {
    const shifted = shiftAssignments(assignments, frames, 1, 1);
    expect(assignments.map((assignment) => assignment.frameNo)).toEqual([1, 2, 3]);
    expect(shifted).not.toBe(assignments);
  });

  it("drops the last assignment off the end of the roll, without inventing a frame", () => {
    // Documented at scanMatching.ts:80 and never asserted: shifting forward past the last frame
    // unassigns that file rather than failing - the user sees it as "unassigned" in the review.
    const shifted = shiftAssignments(assignments, frames, 0, 1);

    expect(shifted.map((assignment) => assignment.frameNo)).toEqual([2, 3, null]);
    expect(shifted[2]?.frameId).toBeNull();
    expect(shifted).toHaveLength(assignments.length);
  });
});
