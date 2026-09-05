import { describe, expect, it } from 'vitest';
import { acceptCreative, creativeKind, formatFileSize } from './creativeFile';

function fakeFile(name: string, type: string, size = 1024): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe('creativeKind', () => {
  it('reads PNG and PDF from the MIME type', () => {
    expect(creativeKind(fakeFile('wrap.png', 'image/png'))).toBe('png');
    expect(creativeKind(fakeFile('wrap.pdf', 'application/pdf'))).toBe('pdf');
  });

  it('falls back to the extension when the type is empty', () => {
    expect(creativeKind(fakeFile('wrap.PNG', ''))).toBe('png');
    expect(creativeKind(fakeFile('deck.pdf', ''))).toBe('pdf');
  });

  it('rejects other images', () => {
    expect(creativeKind(fakeFile('photo.jpg', 'image/jpeg'))).toBeNull();
  });
});

describe('acceptCreative', () => {
  it('accepts a PNG under the size cap', () => {
    const file = fakeFile('wrap.png', 'image/png', 2048);
    expect(acceptCreative(file)).toEqual({ ok: true, file, kind: 'png' });
  });

  it('rejects oversize files', () => {
    const file = fakeFile('huge.png', 'image/png', 1);
    Object.defineProperty(file, 'size', { value: 26 * 1024 * 1024 });
    expect(acceptCreative(file)).toEqual({
      ok: false,
      error: 'File must be 25 MB or smaller.',
    });
  });

  it('rejects a type the wrap shop cannot use', () => {
    expect(acceptCreative(fakeFile('photo.jpg', 'image/jpeg'))).toEqual({
      ok: false,
      error: 'Choose a PDF or PNG.',
    });
  });
});

describe('formatFileSize', () => {
  it('uses the smallest useful unit', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(12 * 1024)).toBe('12 KB');
    expect(formatFileSize(3.2 * 1024 * 1024)).toBe('3.2 MB');
  });
});
