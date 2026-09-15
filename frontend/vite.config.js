import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // The API port lives in the root .env, shared with the backend.
  const rootEnv = loadEnv(mode, path.resolve(import.meta.dirname, '..'), '');
  const apiTarget = `http://localhost:${rootEnv.PORT || 3000}`;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Bind to IPv4 loopback explicitly. With the default "localhost", Node can pick the
      // IPv6 address ::1 only, leaving http://127.0.0.1:5173 unreachable.
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      // The browser only talks to Vite, which forwards API and upload requests to Express.
      // Same origin means no CORS, and the refresh cookie can be SameSite=Strict.
      proxy: {
        '/api': apiTarget,
        '/uploads': apiTarget,
      },
    },
  };
});
