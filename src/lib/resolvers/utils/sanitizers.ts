const stripDecorations = (output: string): string => {
	return output
		.trim()
		.replace(/^[`"'""'']+/, "")
		.replace(/[`"'""'']+$/, "")
		.replace(/[.!?]+$/, "")
		.trim();
};

export const sanitizeSlug = (output: string): string => {
	return stripDecorations(output)
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, "");
};

export const sanitizeChainName = (output: string): string => {
	return stripDecorations(output);
};

export const sanitizeNumericString = (output: string): string => {
	return stripDecorations(output).replace(/[^0-9]/g, "");
};
