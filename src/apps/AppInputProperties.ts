import { Color } from "three";

/**
 * A float number input to an App.
 */
class NumberInput {
	name: string;
	minValue: number;
	maxValue: number;
	curValue: number;
	htmlElement: HTMLElement;

	constructor(name: string, min: number, max: number, value?: number) {
		this.name = name;
		this.minValue = min;
		this.maxValue = max;
		this.curValue = value
			? value
			: (this.maxValue - this.minValue) * 0.5 + this.minValue;
	}

	/**
	 * A function that generates an HTML component that controls the number input.
	 *
	 * @param withLabel - If false does not generate the labe  HTML.
	 * @returns - The HTML component that controls the input.
	 */
	generateHTMLElement(withLabel = true): HTMLElement {
		const htmlElement = document.createElement("div");
		htmlElement.className = "app-prop";

		if (withLabel) {
			const label = document.createElement("label");
			label.innerText = this.name;
			htmlElement.appendChild(label);
		}

		const input = document.createElement("input");
		input.type = "range";
		input.min = this.minValue.toString();
		input.max = this.maxValue.toString();
		input.value = this.curValue.toString();
		input.step = "0.001";
		input.addEventListener(
			"input",
			((e: Event) => {
				this.curValue = Number.parseFloat(
					(e.target as HTMLInputElement).value
				);
				console.log(this.curValue);
			}).bind(this)
		);
		htmlElement.appendChild(input);

		return htmlElement;
	}
}

/**
 * A color input to an app
 */
class ColorInput {
	name: string;
	color: Color;

	constructor(
		name: string,
		color: Color = new Color().setRGB(0.5, 0.5, 0.5)
	) {
		this.name = name;
		this.color = color;
	}

	/**
	 * A function that generates an HTML component that controls the color input.
	 *
	 * @param withLabel - If false does not generate the labe  HTML.
	 * @returns - The HTML component that controls the input.
	 */
	generateHTMLElement(withLabel = true): HTMLElement {
		const htmlElement = document.createElement("div");

		if (withLabel) {
			const label = document.createElement("label");
			label.innerText = this.name;
			htmlElement.appendChild(label);
		}

		const inputElement = document.createElement("input");
		inputElement.type = "color";
		inputElement.value = `#${this.color.getHexString()}`;
		inputElement.addEventListener("input", (e: Event) => {
			this.color = new Color((e.target as HTMLInputElement).value);
		});
		htmlElement.appendChild(inputElement);

		return htmlElement;
	}
}

/**
 * A button to control an action of an app.
 */
class ButtonInput {
	name: string;
	clickCallback: CallableFunction;

	constructor(name: string, clickCallback: CallableFunction) {
		this.name = name;
		this.clickCallback = clickCallback;
	}

	/**
	 * A function that generates an HTML component for a button that controls an action.
	 *
	 * @param withLabel - If false does not generate the labe  HTML.
	 * @param clickCallback - The function called when the button is clicked.
	 * @returns - The HTML component that controls the input.
	 */
	generateHTMLElement(withLabel = true): HTMLElement {
		const htmlElement = document.createElement("div");

		const buttonElement = document.createElement("button");
		buttonElement.className = "prop-button";
		buttonElement.innerHTML = this.name;
		buttonElement.addEventListener("click", () => {
			this.clickCallback();
		});
		htmlElement.appendChild(buttonElement);

		return htmlElement;
	}
}

type PrimaryInputDataType = ColorInput | NumberInput | ButtonInput;

/**
 * A list of Input that are an input to an app.
 */
class ListType {
	name: string;
	list: PrimaryInputDataType[];

	constructor(name: string, listData: PrimaryInputDataType[] = []) {
		this.name = name;
		this.list = listData;
	}

	/**
	 * A function that generates an HTML component that controls the list input.
	 *
	 * @param withLabel - If false does not generate the labe  HTML.
	 * @returns
	 */
	generateHTMLElement(withLabel = true): HTMLElement {
		const listHTMLElement = document.createElement("div");

		if (withLabel) {
			const label = document.createElement("label");
			label.innerText = this.name;
			listHTMLElement.appendChild(label);
		}

		this.list.forEach((elementData: PrimaryInputDataType) => {
			const element = elementData.generateHTMLElement(false);
			listHTMLElement.appendChild(element);
		});

		return listHTMLElement;
	}
}

type InputDataType = ListType | PrimaryInputDataType;

/**
 * Holds the names and values of the inputs for an app.
 */
class AppInputProperties {
	inputMap: { [name: string]: InputDataType };

	constructor(inputMap: { [name: string]: InputDataType } = {}) {
		this.inputMap = inputMap;
	}

	/**
	 * Generates the HTML for the inputs that controll an app.
	 *
	 * @returns - The HTML element containing the HTML that controlls the inputs to the app.
	 */
	generateHTMLElement(): HTMLElement {
		const htmlElement = document.createElement("div");
		for (const inputName in this.inputMap) {
			htmlElement.appendChild(
				this.inputMap[inputName].generateHTMLElement()
			);
		}
		return htmlElement;
	}
}

export { AppInputProperties, NumberInput, ColorInput, ListType, ButtonInput };
