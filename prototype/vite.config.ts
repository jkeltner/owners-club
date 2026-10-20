import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build works from any GitHub Pages path.
// fs.allow lets the app import the YAML catalogs from ../content.
// allowedHosts lets other devices on a Tailscale tailnet reach the dev server.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { fs: { allow: ['..'] }, host: true, port: 5179, allowedHosts: ['.ts.net'] },
})
