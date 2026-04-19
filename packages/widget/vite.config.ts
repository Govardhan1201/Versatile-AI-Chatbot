import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'VersatileAIBot',
      fileName: 'widget',
      formats: ['iife'], // Single self-executing file for script-tag embed
    },
    rollupOptions: {
      external: [], // Bundle everything — zero runtime deps
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: false,
    target: 'es2018',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
