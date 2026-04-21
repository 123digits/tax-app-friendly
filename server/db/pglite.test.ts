import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDataDir } from './pglite.js';

describe('getDataDir', () => {
  let origDataDir: string | undefined;
  let origCwd: () => string;

  beforeEach(() => {
    origDataDir = process.env.DATA_DIR;
    origCwd = process.cwd;
  });

  afterEach(() => {
    if (origDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = origDataDir;
    process.cwd = origCwd;
  });

  it('uses DATA_DIR env var when set', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-'));
    process.env.DATA_DIR = tmp;
    expect(getDataDir()).toBe(path.resolve(tmp));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('falls back to project ./data when cwd has no special chars', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-'));
    delete process.env.DATA_DIR;
    process.cwd = () => tmp;
    const out = getDataDir();
    expect(out).toBe(path.resolve(tmp, 'data'));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('falls back to OS tmpdir when cwd contains special chars', () => {
    delete process.env.DATA_DIR;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "with'quote-"));
    process.cwd = () => tmp;
    const out = getDataDir();
    expect(out.startsWith(os.tmpdir())).toBe(true);
    expect(out).toContain('tax-app-');
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
