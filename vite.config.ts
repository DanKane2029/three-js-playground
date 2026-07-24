import { defineConfig } from "vite";

// GitHub Pages serves this project site under /three-js-playground/.
// `base` makes built asset URLs resolve correctly there; in dev it's ignored.
export default defineConfig({
	base: "/three-js-playground/",
	build: {
		outDir: "dist",
		target: "es2022",
		sourcemap: true,
	},
	server: {
		port: 8080,
		host: true,
	},
});
