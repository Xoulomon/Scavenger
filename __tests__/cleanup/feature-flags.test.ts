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
