import axios from "axios";

/**
 * Extracts a user-friendly error message from an unknown error.
 * Preserves the previous behavior: axios errors surface
 * `error.response?.data ?? error.message`.
 */
export function extractErrorMessage(error: unknown): Error {
	if (axios.isAxiosError(error)) {
		const errorPayload = error.response?.data ?? error.message;
		const errorMessage =
			typeof errorPayload === "string"
				? errorPayload
				: JSON.stringify(errorPayload);
		return new Error(errorMessage);
	}
	return error instanceof Error ? error : new Error(String(error));
}
