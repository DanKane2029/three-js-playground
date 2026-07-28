import { defineConfig } from "vite";

// GitHub Pages serves this project site under /three-js-playground/.
// `base` makes built asset URLs resolve correctly there; in dev it's ignored.
export default defineConfig({
	base: "/three-js-playground/",
	build: {
		outDir: "dist",
		target: "es2022",
		sourcemap: true,
		// Three.js core is deliberately isolated in its own vendor chunk below;
		// don't warn about its size.
		chunkSizeWarningLimit: 700,
		rollupOptions: {
			output: {
				// Keep Three.js core in its own long-lived chunk so shipping
				// app changes doesn't invalidate it in users' caches.
				manualChunks(id) {
					if (id.includes("node_modules/three/")) return "three";
				},
			},
		},
	},
	server: {
		port: 8080,
		host: true,
	},
});
