import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverPort = Number(process.env.PORT ?? 8787);

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: { outDir: 'dist/client', emptyOutDir: true },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': `http://localhost:${serverPort}`,
      '/health': `http://localhost:${serverPort}`,
      '/ws': { target: `ws://localhost:${serverPort}`, ws: true },
    },
  },
});
