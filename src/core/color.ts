import { Vector4 } from "three";

/**
 * Parses a `#rrggbb` hex string into a Vector4 of 0..1 display (sRGB) values
 * with alpha 1. Kept space-agnostic on purpose: the shader apps treat these as
 * literal display colors, matching how the palettes were originally authored.
 */
export function hexToVec4(hex: string): Vector4 {
	const n = parseInt(hex.replace("#", ""), 16);
	return new Vector4(
		((n >> 16) & 255) / 255,
		((n >> 8) & 255) / 255,
		(n & 255) / 255,
		1
	);
}
