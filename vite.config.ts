import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
  plugins: [
    presetsApiPlugin(),
  ],
});

/** Плагин: сохранение пресетов в public/presets и динамический манифест (только в dev) */
function presetsApiPlugin() {
  return {
    name: 'presets-api',
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void }; config: { root?: string } }) {
      const root = server.config.root || process.cwd();
      const presetsDir = path.join(root, 'public', 'presets');

      server.middlewares.use((req: any, res: any, next: () => void) => {
        const url = req.url?.split('?')[0] ?? '';

        // Динамический манифест: все .json в папке presets (кроме manifest.json)
        if (url === '/presets/manifest.json' && req.method === 'GET') {
          try {
            const files = fs.readdirSync(presetsDir).filter((f) => f.endsWith('.json') && f !== 'manifest.json');
            const presets: Array<{ file: string; name: string }> = [];
            for (const file of files) {
              try {
                const raw = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
                const data = JSON.parse(raw);
                const name = typeof data?.name === 'string' ? data.name : file.replace(/\.json$/i, '');
                presets.push({ file, name });
              } catch {
                presets.push({ file, name: file.replace(/\.json$/i, '') });
              }
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ presets }));
          } catch {
            res.statusCode = 500;
            res.end();
          }
          return;
        }

        // Сохранение пресета в public/presets
        if (url === '/__presets__/save' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const data = JSON.parse(body) as { name?: string; config?: unknown };
              const name = (data?.name && String(data.name).trim()) || 'preset-' + Date.now();
              const config = data?.config ?? {};
              const filename = name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase() || 'preset';
              const safeFile = (filename || 'preset') + '.json';
              const preset = { name, config };
              fs.mkdirSync(presetsDir, { recursive: true });
              fs.writeFileSync(path.join(presetsDir, safeFile), JSON.stringify(preset, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 201;
              res.end(JSON.stringify({ ok: true, file: safeFile }));
            } catch (e) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
