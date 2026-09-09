import fs from 'node:fs';

try {
  fs.rmSync('dist', { recursive: true, force: true });
} catch {}
