import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this project at github.com/<user>/Visali_CRM as
// https://<user>.github.io/Visali_CRM/, so assets must resolve under
// that subpath rather than the domain root.
export default defineConfig({ plugins: [react()], base: '/Visali_CRM/' })
