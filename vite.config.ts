/// <reference types="vitest/config" />
import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

/**
 * D41: hash'li dosya listesini kendi ~30 satırlık eklentimizle SW'ye gömüyoruz
 * (vite-plugin-pwa DEĞİL; o yalnızca mimar onayıyla, geri çekilme hattı).
 * Derleme sonrası ön-önbellek listesi + içerikten türeyen sürüm damgası.
 */
function serviceWorker(): Plugin {
  return {
    name: 'trainlog-sw',
    apply: 'build',
    async generateBundle(_options, bundle) {
      const emitted = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const assets = [
        './',
        ...emitted.map((f) => './' + f),
        './manifest.webmanifest',
        './icons/icon-192.png',
        './icons/icon-512.png',
        './icons/apple-touch-icon-180.png',
      ];
      // Sürüm içerikten türer → hash değişince yeni SW, elle artırma yok (D36)
      const version = createHash('sha1').update(assets.join('|')).digest('hex').slice(0, 8);
      const srcPath = fileURLToPath(new URL('./src/pwa/sw.ts', import.meta.url));
      const filled = (await readFile(srcPath, 'utf8'))
        .replace("['__PRECACHE__']", JSON.stringify(assets))
        .replace("'__CACHE_VERSION__'", JSON.stringify(version));
      const { code } = await transformWithEsbuild(filled, 'sw.ts', {
        loader: 'ts',
        target: 'es2020',
        minify: true,
      });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code });
    },
  };
}

export default defineConfig({
  base: './', // D2 — herhangi bir statik hosta taşınabilir kal
  plugins: [serviceWorker()],
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: { target: 'es2020' },
  test: {
    environment: 'node', // domain saf; DOM gerektirmez (D34)
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true, // S0'da domain testi yok; S1'de gelir
  },
});
