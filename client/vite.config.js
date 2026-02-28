import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // expose on all network interfaces
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
