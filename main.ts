// main.ts — hands the Skyline Courier game in to make.fun.
// One clear job: copy game/ and screenshots/ from this repository into the
// output directory and write the dossier the kit's library builds from them.
// Runs twice in the grader; both runs write the same bytes.
// It never removes the output directory: in the grader /output is a mount
// whose parent filesystem is read-only, so deleting it fails outright.
// Follows the kit starter's pattern exactly: mkdir, then copy.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The directory holding this file is the repository root.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly, before writing anything, when the entry is incomplete.
for (const needed of ['game', 'screenshots']) {
  if (!existsSync(join(repoRoot, needed))) {
    throw new Error(`main.ts: ${needed}/ is missing from the repository`);
  }
}

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// A short line on stdout so a local run shows it worked; the grader reads
// the files, not this line.
console.log(`skyline-courier: wrote ${outDir} (dossier ${dossier.length} bytes)`);
