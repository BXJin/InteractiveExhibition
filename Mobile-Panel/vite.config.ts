import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        // SignalR Hub: 브라우저에서 같은 포트로 요청 → Vite가 ASP.NET Core로 프록시
        // CORS 없이 WebSocket 업그레이드 가능
        '/hub': {
          target: 'http://localhost:5225',
          ws: true,
          changeOrigin: true,
        },
        // REST API
        '/commands': {
          target: 'http://localhost:5225',
          changeOrigin: true,
        },
      },
    },
  };
});
