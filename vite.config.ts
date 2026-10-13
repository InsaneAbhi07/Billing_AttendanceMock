import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths so the build works from any sub-path (e.g. GitHub Pages /Billing_AttendanceMock/).
  // Routing uses HashRouter, so no server rewrites are needed.
  base: './',
  // 5173 is used by another local project; keep this app on its own port.
  server: { port: 5180 },
})
