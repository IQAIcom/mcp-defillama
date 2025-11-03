/**
 * Markdown Formatter
 * Converts structured data to LLM-friendly markdown format
 */

function formatCurrency(value: number | undefined | null): string {
	if (value === undefined || value === null) return "";
	return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number | undefined | null): string {
	if (value === undefined || value === null) return "";
	return value.toLocaleString("en-US");
}

/**
 * Remove null and undefined values from object
 */
function removeNulls(obj: Record<string, unknown>): Record<string, unknown> {
	const cleaned: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== null && value !== undefined) {
			if (typeof value === "object" && !Array.isArray(value)) {
				const nested = removeNulls(value as Record<string, unknown>);
				if (Object.keys(nested).length > 0) {
					cleaned[key] = nested;
				}
			} else {
				cleaned[key] = value;
			}
		}
	}
	return cleaned;
}

/**
 * Convert camelCase or snake_case to Title Case
 */
function toTitleCase(str: string): string {
	return str
		.replace(/([A-Z])/g, " $1")
		.replace(/_/g, " ")
		.replace(/^./, (s) => s.toUpperCase())
		.trim();
}

/**
 * Format an array as a markdown table
 */
function formatTable(
	data: Record<string, unknown>[],
	options?: { currencyFields?: string[]; numberFields?: string[] },
): string {
	if (data.length === 0) return "_No data available_\n";

	const cleaned = data.map((item) => removeNulls(item));
	const keys = Array.from(
		new Set(cleaned.flatMap((item) => Object.keys(item))),
	);

	// Header
	const headers = keys.map(toTitleCase).join(" | ");
	const separator = keys.map(() => "---").join(" | ");

	// Rows
	const rows = cleaned.map((item) => {
		return keys
			.map((key) => {
				const value = item[key];

				if (value === undefined || value === null) return "";

				// Format currency fields
				if (
					options?.currencyFields?.includes(key) &&
					typeof value === "number"
				) {
					return formatCurrency(value);
				}

				// Format number fields
				if (options?.numberFields?.includes(key) && typeof value === "number") {
					return formatNumber(value);
				}

				// Handle objects and arrays
				if (typeof value === "object") {
					return JSON.stringify(value);
				}

				return String(value);
			})
			.join(" | ");
	});

	return `| ${headers} |\n| ${separator} |\n${rows.map((row) => `| ${row} |`).join("\n")}\n`;
}

/**
 * Format a single object as key-value pairs
 */
function formatObject(
	obj: Record<string, unknown>,
	options?: { currencyFields?: string[]; numberFields?: string[] },
	indent = 0,
): string {
	const cleaned = removeNulls(obj);
	const prefix = "  ".repeat(indent);
	let output = "";

	for (const [key, value] of Object.entries(cleaned)) {
		const label = toTitleCase(key);

		if (value === undefined || value === null) continue;

		if (Array.isArray(value)) {
			output += `${prefix}**${label}:**\n`;
			if (value.length > 0 && typeof value[0] === "object") {
				output += formatTable(value as Record<string, unknown>[], options);
			} else {
				output += `${value.map((v) => `${prefix}- ${v}`).join("\n")}\n`;
			}
		} else if (typeof value === "object") {
			output += `${prefix}**${label}:**\n`;
			output += formatObject(
				value as Record<string, unknown>,
				options,
				indent + 1,
			);
		} else {
			let formattedValue: string;

			// Format currency fields
			if (options?.currencyFields?.includes(key) && typeof value === "number") {
				formattedValue = formatCurrency(value);
			}
			// Format number fields
			else if (
				options?.numberFields?.includes(key) &&
				typeof value === "number"
			) {
				formattedValue = formatNumber(value);
			} else {
				formattedValue = String(value);
			}

			output += `${prefix}**${label}:** ${formattedValue}\n`;
		}
	}

	return output;
}

/**
 * Main formatter function - converts any data structure to markdown
 */
export function toMarkdown(
	data: unknown,
	options?: {
		title?: string;
		currencyFields?: string[];
		numberFields?: string[];
	},
): string {
	let output = "";

	// Add title if provided
	if (options?.title) {
		output += `# ${options.title}\n\n`;
	}

	// Handle null/undefined
	if (data === null || data === undefined) {
		return `${output}_No data available_\n`;
	}

	// Handle arrays
	if (Array.isArray(data)) {
		if (data.length === 0) {
			return `${output}_Empty list_\n`;
		}

		// If array of objects, format as table
		if (typeof data[0] === "object") {
			output += formatTable(data as Record<string, unknown>[], options);
		} else {
			output += `${data.map((item) => `- ${item}`).join("\n")}\n`;
		}
		return output;
	}

	// Handle objects
	if (typeof data === "object") {
		output += formatObject(data as Record<string, unknown>, options);
		return output;
	}

	// Handle primitives
	// If it's a number and we have formatting hints, apply them
	if (typeof data === "number") {
		let formattedValue: string;

		// Try to infer if this is currency based on context or magnitude
		const isCurrency =
			options?.currencyFields !== undefined ||
			(data > 1000 && Number.isFinite(data)); // Large numbers likely currency

		if (isCurrency) {
			formattedValue = formatCurrency(data);
		} else if (options?.numberFields !== undefined) {
			formattedValue = formatNumber(data);
		} else {
			// Format as number with commas for readability
			formattedValue = formatNumber(data);
		}

		return `${output}**Value:** ${formattedValue}\n`;
	}

	// Handle other primitives (strings, booleans)
	return `${output + String(data)}\n`;
}
