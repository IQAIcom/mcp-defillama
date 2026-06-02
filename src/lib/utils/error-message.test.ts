import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { extractErrorMessage } from "./index.js";

describe("extractErrorMessage", () => {
	it("JSON-stringifies an axios error with an object response body", () => {
		const axiosError = new AxiosError("Request failed");
		// biome-ignore lint/suspicious/noExplicitAny: minimal axios response stub
		axiosError.response = { data: { error: "rate limited", code: 429 } } as any;

		const result = extractErrorMessage(axiosError);

		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe(
			JSON.stringify({ error: "rate limited", code: 429 }),
		);
	});

	it("passes through an axios error with a string response body", () => {
		const axiosError = new AxiosError("Request failed");
		// biome-ignore lint/suspicious/noExplicitAny: minimal axios response stub
		axiosError.response = { data: "Not Found" } as any;

		const result = extractErrorMessage(axiosError);

		expect(result.message).toBe("Not Found");
	});

	it("preserves the message of a non-axios Error", () => {
		const error = new Error("boom");

		const result = extractErrorMessage(error);

		expect(result).toBe(error);
		expect(result.message).toBe("boom");
	});
});
