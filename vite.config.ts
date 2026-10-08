import { defineConfig, type Plugin } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Dev-only endpoint that stores frames posted by window.__capture into .shots/. */
function shots(): Plugin {
  return {
    name: 'gitar-shots',
    apply: 'serve',
    configureServer(server) {
      // booth-video frames: POST /__frame?dir=name&i=N  → .video/<name>/00000N.jpg
      server.middlewares.use('/__frame', (req, res) => {
        const q = new URL(req.url ?? '', 'http://x').searchParams;
        const dir = resolve(__dirname, '.video', (q.get('dir') ?? 'booth').replace(/[^\w-]/g, ''));
        const i = String(Number(q.get('i') ?? 0)).padStart(6, '0');
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          mkdirSync(dir, { recursive: true });
          const body = Buffer.concat(chunks).toString();
          writeFileSync(resolve(dir, `${i}.jpg`), Buffer.from(body.split(',')[1] ?? '', 'base64'));
          res.end('ok');
        });
      });
      server.middlewares.use('/__shot', (req, res) => {
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name')?.replace(/[^\w.-]/g, '') || 'shot';
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const dir = resolve(__dirname, '.shots');
          mkdirSync(dir, { recursive: true });
          writeFileSync(resolve(dir, `${name}.jpg`), Buffer.from(body.split(',')[1] ?? '', 'base64'));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  base: './', // relative asset paths: works on any Pages URL or sub-path
  plugins: [shots()],
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1200 },
});
