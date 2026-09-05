import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreativeUpload } from './CreativeUpload';

function Harness({ initial = null }: { initial?: File | null }) {
  const [file, setFile] = useState<File | null>(initial);
  return <CreativeUpload file={file} onChange={setFile} />;
}

function fakeFile(name: string, type: string): File {
  return new File([new Uint8Array(32)], name, { type });
}

function pick(file: File) {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('file input missing');
  fireEvent.change(input, { target: { files: [file] } });
}

describe('CreativeUpload', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:creative-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('previews a PNG after it is chosen', () => {
    render(<Harness />);
    pick(fakeFile('summer-wrap.png', 'image/png'));

    const image = screen.getByAltText('Preview of summer-wrap.png');
    expect(image).toHaveAttribute('src', 'blob:creative-preview');
    expect(screen.getByText('summer-wrap.png')).toBeInTheDocument();
    expect(screen.getByText('PNG')).toBeInTheDocument();
  });

  it('previews a PDF in an iframe', () => {
    render(<Harness />);
    pick(fakeFile('board.pdf', 'application/pdf'));

    expect(screen.getByTitle('Preview of board.pdf')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open PDF' })).toHaveAttribute(
      'href',
      'blob:creative-preview',
    );
  });

  it('keeps the current file and shows an error for a rejected type', () => {
    render(<Harness initial={fakeFile('keep.png', 'image/png')} />);
    pick(fakeFile('photo.jpg', 'image/jpeg'));

    expect(screen.getByAltText('Preview of keep.png')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a PDF or PNG.');
  });

  it('clears the preview when the file is removed', () => {
    render(<Harness />);
    pick(fakeFile('summer-wrap.png', 'image/png'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.queryByAltText('Preview of summer-wrap.png')).not.toBeInTheDocument();
    expect(screen.getByText('Choose a PDF or PNG')).toBeInTheDocument();
  });
});
