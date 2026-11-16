import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Sends /api calls to the Express server, so the admin's
      // httpOnly JWT cookie works as same-origin in development
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});