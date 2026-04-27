import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path is configurable so the same build works on:
//   - storyscope.pplx.app and the dev server (root: '/')
//   - GitHub Pages project site at https://<user>.github.io/storyscope/
// The deploy.yml workflow sets VITE_BASE='/storyscope/' before building.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  server: {
    headers: {
      // Helps WASM SharedArrayBuffer when present; harmless otherwise.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
});
