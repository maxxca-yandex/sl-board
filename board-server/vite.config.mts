import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig(() => ({
	plugins: [react({ tsDecorators: true })],
	root: path.join(__dirname, 'src/client'),
	publicDir: 'public',
	build: {
		outDir: path.resolve(__dirname, 'dist/client'),
		emptyOutDir: true,
	},
	server: {
		port: 5757,
		proxy: {
		// Проксируем всё под /ws
		'/ws': {
			target: 'http://localhost:5858',
			changeOrigin: true,
			ws: true, // WebSocket поддержка!
			rewrite: (path) => path.replace(/^\/ws/, '/ws'), // можно опустить, но оставим
		},
		},
	},
	optimizeDeps: {
		exclude: ['@tldraw/assets'],
	},
}))
