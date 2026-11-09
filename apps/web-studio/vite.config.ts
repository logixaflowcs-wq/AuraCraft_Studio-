import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    host: true,
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'three-core':  ['three'],
          'three-vrm':   ['@pixiv/three-vrm'],
          'react-core':  ['react', 'react-dom'],
          'lucide':      ['lucide-react'],
        },
      },
    },
  },
});
