import { defineConfig, searchForWorkspaceRoot } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), fileURLToPath(new URL("../../shared", import.meta.url))] } },
})
