import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@web': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Port and host are handled by the NestJS wrapper in dev
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
