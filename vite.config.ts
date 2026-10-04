import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// GitHub Pages serves the repo at /<repo-name>/.
const BASE = '/cq3/';

/** After build, write dist/sw.js with the list of every built file and a content hash as the cache version. */
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
          else if (name !== 'sw.js') files.push(relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      files.sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const urls = ['./', ...files.map((f) => `./${f}`)];
      const tpl = readFileSync('scripts/sw-template.js', 'utf8');
      writeFileSync(join(outDir, 'sw.js'), tpl.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(urls)));
    },
  };
}

export default defineConfig({
  base: BASE,
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
  plugins: [serviceWorker()],
  server: { host: true },
});
