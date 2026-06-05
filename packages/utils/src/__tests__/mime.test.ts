import { describe, expect, it } from 'vitest';
import {
  imageDataUri,
  isImageMime,
  isMarkdownMime,
  isPdfMime,
  langForMime,
  langForPath,
  MIME,
  mimeForPath,
  pdfDataUri,
} from '../mime.ts';

describe('MIME', () => {
  it('exports standard MIME type strings', () => {
    expect(MIME.pdf).toBe('application/pdf');
    expect(MIME.markdown).toBe('text/markdown');
    expect(MIME.plain).toBe('text/plain');
    expect(MIME.png).toBe('image/png');
  });
});

describe('mimeForPath', () => {
  it('returns pdf as base64', () => {
    expect(mimeForPath('report.pdf')).toEqual({
      contentType: 'application/pdf',
      encoding: 'base64',
    });
  });

  it('returns markdown as utf-8', () => {
    expect(mimeForPath('README.md')).toEqual({ contentType: 'text/markdown', encoding: 'utf-8' });
  });

  it('returns plain text for unknown extension', () => {
    expect(mimeForPath('file.xyz')).toEqual({ contentType: 'text/plain', encoding: 'utf-8' });
  });

  it('handles uppercase extension', () => {
    expect(mimeForPath('IMAGE.PNG')).toEqual({ contentType: 'image/png', encoding: 'base64' });
  });
});

describe('langForPath', () => {
  it('returns typescript for .ts', () => {
    expect(langForPath('foo.ts')).toBe('typescript');
  });

  it('returns python for .py', () => {
    expect(langForPath('script.py')).toBe('python');
  });

  it('returns undefined for unknown extension', () => {
    expect(langForPath('file.xyz')).toBeUndefined();
  });
});

describe('langForMime', () => {
  it('returns markdown for text/markdown mime', () => {
    expect(langForMime('text/markdown', 'any.txt')).toBe('markdown');
  });

  it('falls back to path-based detection', () => {
    expect(langForMime('text/plain', 'script.py')).toBe('python');
  });

  it('returns undefined when neither mime nor path match', () => {
    expect(langForMime('text/plain', 'file.xyz')).toBeUndefined();
  });
});

describe('isPdfMime', () => {
  it('returns true for application/pdf', () => {
    expect(isPdfMime('application/pdf')).toBe(true);
  });

  it('returns false for other types', () => {
    expect(isPdfMime('text/plain')).toBe(false);
  });
});

describe('isMarkdownMime', () => {
  it('returns true for text/markdown', () => {
    expect(isMarkdownMime('text/markdown')).toBe(true);
  });

  it('returns false for other types', () => {
    expect(isMarkdownMime('text/html')).toBe(false);
  });
});

describe('isImageMime', () => {
  it('returns true for image/png', () => {
    expect(isImageMime('image/png')).toBe(true);
  });

  it('returns true for image/jpeg', () => {
    expect(isImageMime('image/jpeg')).toBe(true);
  });

  it('returns true for image/gif', () => {
    expect(isImageMime('image/gif')).toBe(true);
  });

  it('returns false for application/pdf', () => {
    expect(isImageMime('application/pdf')).toBe(false);
  });

  it('returns false for text/plain', () => {
    expect(isImageMime('text/plain')).toBe(false);
  });
});

describe('pdfDataUri', () => {
  it('produces a valid data URI', () => {
    expect(pdfDataUri('abc123')).toBe('data:application/pdf;base64,abc123');
  });
});

describe('imageDataUri', () => {
  it('produces a valid data URI for image/png', () => {
    expect(imageDataUri('image/png', 'abc123')).toBe('data:image/png;base64,abc123');
  });

  it('produces a valid data URI for image/jpeg', () => {
    expect(imageDataUri('image/jpeg', 'xyz')).toBe('data:image/jpeg;base64,xyz');
  });
});
