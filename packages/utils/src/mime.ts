export const MIME = {
  markdown: 'text/markdown',
  html: 'text/html',
  css: 'text/css',
  xml: 'text/xml',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
  otf: 'font/otf',
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  plain: 'text/plain',
} as const;

const BINARY_EXT: Record<string, string> = {
  pdf: MIME.pdf,
  png: MIME.png,
  jpg: MIME.jpeg,
  jpeg: MIME.jpeg,
  gif: MIME.gif,
  webp: MIME.webp,
  ico: MIME.ico,
  woff: MIME.woff,
  woff2: MIME.woff2,
  ttf: MIME.ttf,
  eot: MIME.eot,
  otf: MIME.otf,
  zip: MIME.zip,
  gz: MIME.gz,
  tar: MIME.tar,
};

const TEXT_EXT: Record<string, string> = {
  md: MIME.markdown,
  markdown: MIME.markdown,
  html: MIME.html,
  htm: MIME.html,
  css: MIME.css,
  xml: MIME.xml,
  svg: MIME.svg,
};

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  cs: 'csharp',
  sh: 'bash',
  bash: 'bash',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  css: 'css',
  html: 'html',
  toml: 'toml',
  sql: 'sql',
  xml: 'xml',
};

const MIME_TO_LANG: Record<string, string> = {
  [MIME.markdown]: 'markdown',
  [MIME.html]: 'html',
  [MIME.css]: 'css',
};

export function mimeForPath(filePath: string): {
  contentType: string;
  encoding: 'utf-8' | 'base64';
} {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (ext in BINARY_EXT) return { contentType: BINARY_EXT[ext] as string, encoding: 'base64' };
  if (ext in TEXT_EXT) return { contentType: TEXT_EXT[ext] as string, encoding: 'utf-8' };
  return { contentType: MIME.plain, encoding: 'utf-8' };
}

export function langForPath(filePath: string): string | undefined {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_LANG[ext];
}

export function langForMime(mimeType: string, fallbackPath: string): string | undefined {
  return MIME_TO_LANG[mimeType] ?? langForPath(fallbackPath);
}

export function isPdfMime(mimeType: string): boolean {
  return mimeType === MIME.pdf;
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isMarkdownMime(mimeType: string): boolean {
  return mimeType === MIME.markdown;
}

export function pdfDataUri(base64: string): string {
  return `data:${MIME.pdf};base64,${base64}`;
}

export function imageDataUri(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}
