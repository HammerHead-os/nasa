import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// GitHub Pages project site: https://hammerhead-os.github.io/nasa/
export default defineConfig({
  plugins: [react()],
  base: '/nasa/',
})
