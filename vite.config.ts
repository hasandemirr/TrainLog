/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // D2 — herhangi bir statik hosta taşınabilir kal
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: { target: 'es2020' },
  test: {
    environment: 'node', // domain saf; DOM gerektirmez (D34)
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true, // S0'da domain testi yok; S1'de gelir
  },
});
