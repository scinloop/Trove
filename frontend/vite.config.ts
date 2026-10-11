import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 同时监听 IPv4/IPv6，并开放局域网访问（手机测试移动端 UI）
    host: true,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/static': 'http://127.0.0.1:8000', // 上传的图片由后端托管
    },
  },
})
