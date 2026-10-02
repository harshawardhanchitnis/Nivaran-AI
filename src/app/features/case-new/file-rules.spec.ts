import { checkFiles, formatBytes } from './file-rules';

const pdf = (name: string, size = 1000) => ({ name, type: 'application/pdf', size });

describe('checkFiles', () => {
  it('accepts allowed files', () => {
    const result = checkFiles([pdf('invoice.pdf'), { name: 'chat.png', type: 'image/png', size: 2000 }], []);
    expect(result.accepted).toHaveLength(2);
    expect(result.problems).toEqual([]);
  });

  it('refuses the wrong type, an oversized file, an empty file and a duplicate, each with a reason', () => {
    const result = checkFiles(
      [
        { name: 'notes.docx', type: 'application/msword', size: 10 },
        pdf('huge.pdf', 6 * 1024 * 1024),
        pdf('empty.pdf', 0),
        pdf('invoice.pdf'),
      ],
      [pdf('invoice.pdf')],
    );
    expect(result.accepted).toEqual([]);
    expect(result.problems).toHaveLength(4);
    expect(result.problems[0]).toContain('not a PNG, JPG or PDF');
    expect(result.problems[1]).toContain('larger than 5 MB');
    expect(result.problems[3]).toContain('already added');
  });

  it('stops at six files in total', () => {
    const existing = [1, 2, 3, 4, 5].map((n) => pdf(`old-${n}.pdf`));
    const result = checkFiles([pdf('a.pdf'), pdf('b.pdf')], existing);
    expect(result.accepted.map((file) => file.name)).toEqual(['a.pdf']);
    expect(result.problems[0]).toContain('up to 6 files');
  });
});

describe('formatBytes', () => {
  it('uses KB below one megabyte and MB above', () => {
    expect(formatBytes(500)).toBe('1 KB');
    expect(formatBytes(250_000)).toBe('244 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
