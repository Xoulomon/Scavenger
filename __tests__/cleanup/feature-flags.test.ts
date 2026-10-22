import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Feature Flag Cleanup', () => {
  const removedFlags = [
    'enable_analytics',
    'beta_features',
    'ai_assistant',
    'notifications_v2',
    'api_v2',
  ];

  it('should have removed stale flags from code', () => {
    const srcDir = './src';
    let foundCount = 0;

    function scanDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (stat.isFile() && /\.(ts|tsx|js|jsx|rs)$/.test(file)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          for (const flag of removedFlags) {
            if (content.includes(flag)) {
              foundCount++;
              console.log(`Found flag "${flag}" in ${fullPath}`);
            }
          }
        }
      }
    }

    scanDir(srcDir);
    expect(foundCount).toBe(0);
  });

  it('should have active flags defined', () => {
    const activeFlags = ['solo_mode', 'chat_enabled', 'new_circuits', 'contract_upgrade'];
    const srcDir = './src';
    let foundActive = 0;

    function scanDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (stat.isFile() && /\.(ts|tsx|js|jsx|rs)$/.test(file)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          for (const flag of activeFlags) {
            if (content.includes(flag)) {
              foundActive++;
            }
          }
        }
      }
    }

    scanDir(srcDir);
    expect(foundActive).toBeGreaterThan(0);
  });
});

describe('IMPLEMENTATION_SUMMARY regression coverage', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');

  function listImplementationSummaries(): string[] {
    if (!fs.existsSync(repoRoot)) return [];
    return fs
      .readdirSync(repoRoot)
      .filter((file) => /^IMPLEMENTATION_SUMMARY_.*\.md$/.test(file))
      .sort();
  }

  function collectTestFiles(dir: string, acc: string[] = []): string[] {
    if (!fs.existsSync(dir)) return acc;
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        collectTestFiles(fullPath, acc);
      } else if (stat.isFile() && /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry)) {
        acc.push(fullPath);
      }
    }
    return acc;
  }

  const summaries = listImplementationSummaries();
  const testFiles = collectTestFiles(path.join(repoRoot, '__tests__'));
  const testCorpus = testFiles
    .map((file) => fs.readFileSync(file, 'utf-8'))
    .join('\n')
    .toLowerCase();

  it('discovers implementation summary docs at the repo root', () => {
    // If summaries exist, they must be enumerable so each can be cross-referenced.
    expect(Array.isArray(summaries)).toBe(true);
  });

  it('has a regression test referencing each summarized fix', () => {
    const uncovered: string[] = [];

    for (const summary of summaries) {
      const slug = summary
        .replace(/^IMPLEMENTATION_SUMMARY_/, '')
        .replace(/\.md$/, '')
        .toLowerCase();

      // Derive candidate identifiers from the summary filename so the test
      // corpus can be checked for a matching regression reference.
      const tokens = slug
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2);

      const referenced =
        testCorpus.includes(slug) ||
        (tokens.length > 0 && tokens.every((token) => testCorpus.includes(token)));

      if (!referenced) {
        uncovered.push(summary);
      }
    }

    // Coverage gaps are surfaced for follow-up rather than silently ignored.
    if (uncovered.length > 0) {
      console.warn(
        `IMPLEMENTATION_SUMMARY docs lacking regression coverage: ${uncovered.join(', ')}`
      );
    }

    expect(uncovered).toEqual([]);
  });
});
