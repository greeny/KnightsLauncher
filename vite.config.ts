import {defineConfig} from 'vite';

export default defineConfig({
	// Prevent Vite from obscuring Rust errors
	clearScreen: false,
	server: {
		// Tauri expects a fixed port; fail if already in use
		port: 1420,
		strictPort: true,
		watch: {
			// Don't trigger reloads for Rust source changes (Tauri handles that)
			ignored: ['**/src-tauri/**'],
		},
	},
	envPrefix: ['VITE_', 'TAURI_ENV_'],
	build: {
		// Match Tauri's minimum supported browsers
		target: ['es2021', 'chrome105', 'safari15'],
		minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
		sourcemap: !!process.env.TAURI_ENV_DEBUG,
	},
});
