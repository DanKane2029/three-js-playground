import { computeReferenceOrbit } from "./referenceOrbit";
import type { OrbitRequest } from "./referenceOrbit";

/**
 * Computes reference orbits off the main thread.
 *
 * At depth the orbit runs to hundreds of thousands of iterations of big-integer
 * arithmetic — comfortably long enough to drop frames if it ran inline. The
 * request carries `BigFixed` values directly; `BigInt` is structured-cloneable,
 * so no serialisation is needed.
 */

export interface OrbitJob extends OrbitRequest {
	/** Echoed back so the caller can discard results from superseded views. */
	readonly token: number;
}

export interface OrbitResult {
	readonly token: number;
	readonly points: Float32Array;
	readonly length: number;
	readonly escaped: boolean;
}

/**
 * The slice of the worker global this file uses. Declared structurally because
 * the project's `lib` is DOM rather than WebWorker, and adding WebWorker would
 * collide with DOM over the shared globals.
 */
interface WorkerScope {
	onmessage: ((event: MessageEvent<OrbitJob>) => void) | null;
	postMessage(message: OrbitResult, transfer: Transferable[]): void;
}

const ctx = self as unknown as WorkerScope;

ctx.onmessage = (event: MessageEvent<OrbitJob>) => {
	const { token, ...request } = event.data;
	const orbit = computeReferenceOrbit(request);

	// computeReferenceOrbit returns a subarray view over an oversized buffer;
	// copy it so the transfer moves only the bytes actually used.
	const points = new Float32Array(orbit.points);
	const result: OrbitResult = {
		token,
		points,
		length: orbit.length,
		escaped: orbit.escaped,
	};
	ctx.postMessage(result, [points.buffer]);
};
