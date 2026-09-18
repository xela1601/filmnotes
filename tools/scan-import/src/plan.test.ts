import type { Frame } from '@filmnotes/domain';
import { makeFrame } from '@filmnotes/domain';

import type { ImageFile } from './files';
import { planImport, renderPlan } from './plan';

function frame(frameNo: number, overrides: Partial<Frame> = {}): Frame {
  return makeFrame({
    id: `frame${String(frameNo).padStart(10, '0')}`,
    frameNo,
    notes: '',
    ...overrides,
  });
}

function image(name: string): ImageFile {
  return { name, path: `/scans/${name}`, mimeType: 'image/jpeg' };
}

/** The cell contents of a table row, without the padding. */
function cells(line: string): string[] {
  return line.split('|').map((cell) => cell.trim());
}

describe('planImport', () => {
  it('maps the n-th file in natural order onto the n-th frame', () => {
    const files = [image('img1.jpg'), image('img2.jpg'), image('img10.jpg')];
    const frames = [frame(2), frame(1), frame(3)];

    expect(planImport(files, frames)).toEqual([
      { fileName: 'img1.jpg', sortIndex: 0, frameId: frames[1]!.id, frameNo: 1 },
      { fileName: 'img2.jpg', sortIndex: 1, frameId: frames[0]!.id, frameNo: 2 },
      { fileName: 'img10.jpg', sortIndex: 2, frameId: frames[2]!.id, frameNo: 3 },
    ]);
  });

  it('leaves surplus files unassigned and ignores deleted frames', () => {
    const files = [image('img1.jpg'), image('img2.jpg')];
    const frames = [frame(1), frame(2, { deleted: '2026-09-18T10:00:00.000Z' })];

    expect(planImport(files, frames)).toEqual([
      { fileName: 'img1.jpg', sortIndex: 0, frameId: frames[0]!.id, frameNo: 1 },
      { fileName: 'img2.jpg', sortIndex: 1, frameId: null, frameNo: null },
    ]);
  });
});

describe('renderPlan', () => {
  const files = [image('img1.jpg'), image('img2.jpg'), image('img3.jpg')];
  const frames = [frame(1, { notes: 'Sunset over the pier' }), frame(2)];

  it('renders one row per file with the frame number and the frame notes', () => {
    const lines = renderPlan(planImport(files, frames), frames).split('\n');

    expect(lines).toHaveLength(5);
    expect(cells(lines[0] as string)).toEqual(['#', 'file', 'frame', 'notes']);
    expect(lines[1]).toMatch(/^-+(\+-+)+$/);
    expect(cells(lines[2] as string)).toEqual(['1', 'img1.jpg', '#1', 'Sunset over the pier']);
    expect(cells(lines[3] as string)).toEqual(['2', 'img2.jpg', '#2', '']);
  });

  it('marks files without a frame as unassigned', () => {
    const lines = renderPlan(planImport(files, frames), frames).split('\n');

    expect(cells(lines[4] as string)).toEqual(['3', 'img3.jpg', '(unassigned)', '']);
  });

  it('aligns the columns of every row', () => {
    const lines = renderPlan(planImport([...files, image('img10.jpg')], frames), frames).split('\n');
    const separators = (line: string): number[] =>
      [...line].flatMap((character, index) => (character === '|' || character === '+' ? [index] : []));

    for (const line of lines) expect(separators(line)).toEqual(separators(lines[0] as string));
  });

  it('shortens long frame notes to 40 characters', () => {
    const long = frame(1, { notes: 'a'.repeat(80) });
    const lines = renderPlan(planImport([image('img1.jpg')], [long]), [long]).split('\n');
    const notes = cells(lines[2] as string)[3] as string;

    expect(notes).toHaveLength(40);
    expect(notes.endsWith('…')).toBe(true);
  });

  it('keeps a multi-line note on one row', () => {
    const multiline = frame(1, { notes: 'first line\nsecond line' });
    const lines = renderPlan(planImport([image('img1.jpg')], [multiline]), [multiline]).split('\n');

    expect(lines).toHaveLength(3);
    expect(cells(lines[2] as string)[3]).toBe('first line second line');
  });
});
