import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '..',          // load .env from monorepo root
  server: {
    host: true,          // expose on all network interfaces
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
