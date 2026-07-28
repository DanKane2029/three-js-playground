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
				path: "../src/main.ts",
				pattern: /@app-list-marker/g,
				template:
					'\t{\n\t\tname: "{{sentenceCase name}}",\n\t\tload: () => import("./apps/{{name}}").then((m) => new m.{{pascalCase name}}()),\n\t},',
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
