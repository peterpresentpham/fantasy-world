import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('generation code stays deterministic across JIT tiers', () => {
  // `sort(() => random() - 0.5)` is not a valid ordering, so its result depends on how the engine
  // sorts. Chrome's Maglev and the interpreter disagreed, and the same seed gave different worlds.
  it('never shuffles with a random sort comparator', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src/services')).filter((file) =>
      /\.sort\(\s*\([^)]*\)\s*=>\s*[^)]*(random|rng|rand)\w*\(\)/i.test(readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  it('does not call Math.random in generation code', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src/services'))
      .filter((file) => !file.endsWith('seed.ts'))
      .filter((file) => readFileSync(file, 'utf8').includes('Math.random('));
    expect(offenders).toEqual([]);
  });
});
