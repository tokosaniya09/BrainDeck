import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://braindeck-4bis.onrender.com/api',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});