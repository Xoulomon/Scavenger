/**
 * Regression guard (#1786): environment variables are read only inside src/config.
 * Everything else must import the typed `config` object.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../src');
const CONFIG_DIR = path.join(SRC, 'config') + path.sep;

function listTsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listTsFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('no direct process.env access outside src/config (#1786)', () => {
  it('only the config module reads process.env', () => {
    const offenders = listTsFiles(SRC)
      .filter((file) => !file.startsWith(CONFIG_DIR))
      .filter((file) => /\bprocess\.env\b/.test(stripComments(fs.readFileSync(file, 'utf8'))))
      .map((file) => path.relative(SRC, file));

    expect(offenders).toEqual([]);
  });
});
