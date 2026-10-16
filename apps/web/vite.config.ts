import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // 브라우저 → Vite(5173) → Node API(3000)
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});
