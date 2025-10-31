const NOT_FOUND_TOKEN = "__NOT_FOUND__";

export const isNotFoundResponse = (output: string): boolean => {
	return output.toUpperCase().includes(NOT_FOUND_TOKEN);
};

export function needsResolution(
	value: string | number | undefined,
	type: "protocol" | "chain" | "stablecoin" | "bridge" | "option",
): boolean {
	if (!value) return false;

	const str = String(value);

	if (type === "stablecoin" || type === "bridge") {
		return Number.isNaN(Number(str)) || /[A-Za-z]/.test(str);
	}

	return /[A-Z\s]/.test(str);
}
