export default function (plop) {
	plop.setGenerator("app-generator", {
		description: "Generates a new Blank Application",
		prompts: [
			{
				type: "input",
				name: "name",
				message: "What is the app name?",
			},
		],
		actions: [
			{
				type: "add",
				path: "../src/apps/{{name}}.ts",
				templateFile: "plop-templates/AppTemplate.ts.hbs",
			},
			{
				type: "append",
				path: "../src/index.ts",
				pattern: /@imported-apps-marker/g,
				template:
					'import { {{pascalCase name}} } from "./apps/{{name}}";',
			},
			{
				type: "append",
				path: "../src/index.ts",
				pattern: /@app-list-marker/g,
				template: "\tnew {{pascalCase name}}(),",
			},
		],
	});

	plop.setGenerator("shader-generator", {
		description: "Generates a new Blank Application",
		prompts: [
			{
				type: "input",
				name: "name",
				message: "What is the shader name?",
			},
		],
		actions: [
			{
				type: "add",
				path: "../src/shaders/{{name}}.ts",
				templateFile: "plop-templates/ShaderTemplate.ts.hbs",
			}
		],
	});
}
