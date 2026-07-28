import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
	{
		ignores: ["dist", "node_modules", "code-generators/plop-templates"],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			globals: { ...globals.browser },
		},
		rules: {
			semi: "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
		},
	},
	{
		files: ["*.js", "*.mjs", "code-generators/**/*.mjs"],
		languageOptions: {
			globals: { ...globals.node },
		},
	},
	prettier
);
