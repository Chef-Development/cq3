import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { GAME_NAME, GAME_SHORT } from './src/data/brand';

// GitHub Pages serves the repo at /<repo-name>/.
const BASE = '/cq3/';

/** Which build this is ("a6bab32 Oct 6 03:01" UTC), shown at the foot of the gear panel: the playtester can tell
 *  whether the phone has picked up the latest deploy. */
function buildLabel(): string {
  let sha = process.env.GITHUB_SHA?.slice(0, 7);
  if (!sha)
    try {
      sha = execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      sha = 'dev';
    }
  const d = new Date();
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${sha} ${month} ${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

const BUILD = buildLabel();

/** After build, write dist/sw.js with the list of every built file and a content hash as the cache version, and
 *  dist/version.txt with the build's label (never cached: a running app compares it with its own to find a newer
 *  deploy, src/main.ts). */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'cq3-sw',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name);
          if (statSync(p).isDirectory()) walk(p);
          else if (name !== 'sw.js' && name !== 'version.txt') files.push(relative(outDir, p).split('\\').join('/'));
        }
      };
      // the install name from src/data/brand.ts (public/ is copied as is: the built manifest gets the game's name)
      const mf = join(outDir, 'manifest.webmanifest');
      try {
        const m = JSON.parse(readFileSync(mf, 'utf8')) as Record<string, unknown>;
        writeFileSync(mf, `${JSON.stringify({ ...m, name: GAME_NAME, short_name: GAME_SHORT }, null, 2)}\n`);
      } catch {
        /* no manifest */
      }
      walk(outDir);
      files.sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const urls = ['./', ...files.map((f) => `./${f}`)];
      const tpl = readFileSync('scripts/sw-template.js', 'utf8');
      writeFileSync(join(outDir, 'sw.js'), tpl.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(urls)));
      writeFileSync(join(outDir, 'version.txt'), BUILD);
    },
  };
}

/** The page's title and the home-screen label from src/data/brand.ts (one place names the game). */
function brand(): Plugin {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return {
    name: 'cq3-brand',
    transformIndexHtml: (html) =>
      html
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(GAME_NAME)}</title>`)
        .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/, `$1${esc(GAME_SHORT)}$2`),
  };
}

export default defineConfig({
  base: BASE,
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    // Phaser in a chunk of its own (docs/perf.md): it never changes between deploys, so a phone that has it keeps it
    // and a new build downloads only the game's own code; the two download side by side on a first visit.
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser[\\/]/ }] } } },
  },
  plugins: [brand(), serviceWorker()],
  define: { __BUILD__: JSON.stringify(BUILD) },
  server: { host: true },
});
