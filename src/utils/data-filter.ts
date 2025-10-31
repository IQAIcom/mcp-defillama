import type { LanguageModel } from "ai";
import { generateText } from "ai";
import dedent from "dedent";
import jq from "jqts";
import { createChildLogger } from "../lib/utils/index.js";

const logger = createChildLogger("LLM Data Filter");

/**
 * List of JQ functions NOT supported by jqts v0.0.8
 * These will cause runtime errors if used in queries
 */
const UNSUPPORTED_JQTS_FUNCTIONS = [
	// String case conversion
	"ascii_downcase",
	"ascii_upcase",
	// String manipulation
	"split",
	"join",
	"ltrimstr",
	"rtrimstr",
	"explode",
	"implode",
	"tojson",
	"fromjson",
	// Advanced string operations
	"test",
	"match",
	"capture",
	"scan",
	"splits",
	"sub",
	"gsub",
	// Date/time
	"now",
	"gmtime",
	"mktime",
	"strftime",
	"strptime",
	// Other advanced functions
	"limit",
	"until",
	"recurse",
	"walk",
	"env",
	"$ENV",
];

/**
 * Validates a JQ query to ensure it only uses jqts-supported functions
 * @param query - The JQ query string to validate
 * @returns Validation result with error message if invalid
 */
function validateJqQuery(query: string): { valid: boolean; error?: string } {
	for (const func of UNSUPPORTED_JQTS_FUNCTIONS) {
		// Check if function name appears in query (with word boundary to avoid partial matches)
		const regex = new RegExp(`\\b${func}\\b`);
		if (regex.test(query)) {
			return {
				valid: false,
				error: `Unsupported jqts function: '${func}'. jqts is a limited JavaScript JQ port and doesn't support this function.`,
			};
		}
	}

	return { valid: true };
}

interface DataFilterConfig {
	model: LanguageModel;
}

export class LLMDataFilter {
	private readonly model: LanguageModel;

	constructor(config: DataFilterConfig) {
		this.model = config.model;
	}

	/**
	 * Filter large JSON data based on a query
	 * @param data - The JSON data to filter (as string)
	 * @param query - The query describing what data to extract
	 * @returns Filtered JSON data as string
	 */
	async filter(data: string, query: string): Promise<string> {
		const parsedData = JSON.parse(data);
		const schema = this.getJSONSchema(parsedData);

		const prompt = dedent`
			You are a JSON data filtering expert. Your task is to generate a JQ query that will filter the JSON data based on the user's request.

			## Schema of the data:
			${JSON.stringify(schema, null, 2)}

			## Is the root data an array or object?
			${Array.isArray(parsedData) ? "ARRAY" : "OBJECT"}

			## User's request:
			${query}

			## CRITICAL: jqts Function Limitations
			**WARNING**: This system uses jqts (JavaScript JQ port), NOT full JQ. Many functions are NOT supported.

			**SUPPORTED Functions (you can use these):**
			- Basic filtering: select, map, sort_by, group_by, unique, unique_by, flatten, reverse
			- Aggregation: add, min, max, min_by, max_by, length
			- Comparison: ==, !=, >, <, >=, <=, and, or, not
			- Object operations: keys, has, to_entries, from_entries, with_entries
			- Type checking: type, arrays, objects, strings, numbers, booleans, nulls
			- Math: floor, sqrt, tonumber, tostring
			- String checking: contains, startswith, endswith, index, indices, inside

			**NOT SUPPORTED (DO NOT USE - will cause errors):**
			- ❌ String case conversion: ascii_downcase, ascii_upcase
			- ❌ String manipulation: split, join, ltrimstr, rtrimstr, explode, implode
			- ❌ Regex operations: test, match, capture, scan, sub, gsub
			- ❌ Date/time functions: now, gmtime, mktime, strftime
			- ❌ Advanced control flow: limit, until, recurse, walk, env

			**General Filtering Principles:**
			- Work with data as-is from the schema - avoid trying to transform or normalize strings
			- Focus on structural filtering: selecting fields, filtering by numeric/boolean conditions
			- Use simple string operations if needed: contains, startswith, endswith (not case conversion)
			- When uncertain about a function, prefer simpler queries with basic select/map operations
			- If you cannot filter precisely due to limitations, select broader data and let post-processing handle it

			## Critical Instructions:
			1. Analyze the schema to understand the structure of the data
			2. IMPORTANT: Check if the root is an array or object before using array operations
			3. Generate a JQ query that will filter the data to match the user's request
			4. **NEVER RETURN BARE PRIMITIVES**: Your query MUST always return an object or array, never a bare number/string
			5. **ALWAYS USE DESCRIPTIVE KEYS**: Include field names that describe what the value represents
			6. **INCLUDE UNITS IN KEY NAMES**: e.g., "tvl_usd", "price_usd", "volume_24h", "total_locked_value"
			7. The query should:
			   - Select only the relevant fields mentioned in the user's request
			   - Filter arrays to include only relevant items
			   - Return objects with descriptive keys, not bare values
			   - Return meaningful data (not empty arrays or objects)
			8. If the user wants to limit results, use JQ's limit or array slicing
			9. If the user wants to sort, use JQ's sort_by function

			## Examples for ARRAYS:
			- To get top 10 items: ".[0:10] | map({name, tvl_usd: .tvl})"
			- To sort by a field: "sort_by(.field_name) | map({name, value})"
			- To filter by condition: "map(select(.value > 100)) | map({name, value})"
			- To get specific fields: "map({name, value, price_usd: .price})"

			## Examples for OBJECTS:
			- To select specific fields: "{protocol_name: .name, total_value_usd: .value, market_cap: .price}"
			- To filter nested arrays: "{items: .items | map(select(.value > 100))}"
			- To limit nested array: "{top_items: .items[0:10]}"
			- To extract single computed value: "{ethereum_tvl_usd: (.chainTvls.Ethereum.tvl | map(.totalLiquidityUSD) | add)}"

			## BAD Examples (DON'T DO THIS):
			- ❌ ".chainTvls.Ethereum.tvl | map(.totalLiquidityUSD) | add" (returns bare number)
			- ❌ ".name" (returns bare string)
			- ❌ ".[0].price" (returns bare number)

			## GOOD Examples (DO THIS):
			- ✅ "{ethereum_tvl_usd: (.chainTvls.Ethereum.tvl | map(.totalLiquidityUSD) | add)}"
			- ✅ "{protocol_name: .name}"
			- ✅ "{first_item_price_usd: .[0].price}"

			IMPORTANT: Respond with ONLY the JQ query, nothing else. No explanation, no markdown, just the query. The query MUST return an object or array, NEVER a bare primitive.
		`;

		try {
			const result = await generateText({
				model: this.model,
				prompt,
			});

			const jqQuery = result.text.trim();
			logger.info(`Generated JQ query: ${jqQuery}`);

			// Validate query before compilation
			const validation = validateJqQuery(jqQuery);
			if (!validation.valid) {
				logger.warn(`Invalid JQ query detected: ${validation.error}`);
				logger.info(`Problematic query: ${jqQuery}`);
				logger.info("Falling back to smart data summary");
				return this.getFallbackData(parsedData);
			}

			const pattern = jq.compile(jqQuery);
			let filteredData: JSONValue = pattern.evaluate(parsedData);

			if (
				!filteredData ||
				(Array.isArray(filteredData) && filteredData.length === 0)
			) {
				logger.debug("Filter returned empty data, using fallback");
				return this.getFallbackData(parsedData);
			}

			// Safety net: If filtered data is a primitive, wrap it in an object
			if (
				typeof filteredData === "number" ||
				typeof filteredData === "string" ||
				typeof filteredData === "boolean"
			) {
				logger.info(
					`JQ query returned bare primitive (${typeof filteredData}), wrapping in object`,
				);
				filteredData = { result: filteredData } as JSONValue;
			}

			logger.info(`Successfully filtered data`);
			return JSON.stringify(filteredData);
		} catch (error) {
			logger.error("Error filtering data:", error);
			logger.info("Filter failed, using fallback");
			return this.getFallbackData(parsedData);
		}
	}

	/**
	 * Get fallback data when filtering fails or returns empty results
	 * For arrays: return first 10 items
	 * For objects: return a summary with top-level keys and truncated nested objects
	 */
	private getFallbackData(parsedData: JSONValue): string {
		if (Array.isArray(parsedData)) {
			return JSON.stringify(parsedData.slice(0, 10));
		}

		if (typeof parsedData === "object" && parsedData !== null) {
			// For objects, create a summary with limited data
			const summary: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(parsedData)) {
				if (Array.isArray(value)) {
					// Include first 5 items of arrays
					summary[key] = value.slice(0, 5);
				} else if (typeof value === "object" && value !== null) {
					// For nested objects, just include keys
					summary[key] = `[Object with ${Object.keys(value).length} keys]`;
				} else {
					// Include primitive values as-is
					summary[key] = value;
				}
			}
			return JSON.stringify(summary);
		}

		return JSON.stringify(parsedData);
	}

	private getJSONSchema(value: JSONValue): JSONSchema {
		if (typeof value === "string") {
			return { type: "string" };
		}
		if (typeof value === "number") {
			return { type: Number.isInteger(value) ? "integer" : "number" };
		}
		if (typeof value === "boolean") {
			return { type: "boolean" };
		}
		if (value === null) {
			return { type: "null" };
		}
		if (Array.isArray(value)) {
			return {
				type: "array",
				items: value.length > 0 ? this.getJSONSchema(value[0]) : undefined,
			};
		}
		if (typeof value === "object") {
			const properties: { [key: string]: JSONSchema } = {};
			for (const [key, val] of Object.entries(value)) {
				properties[key] = this.getJSONSchema(val);
			}
			return { type: "object", properties };
		}

		throw new Error("Unsupported data type");
	}
}

interface JSONSchema {
	type: string;
	properties?: { [key: string]: JSONSchema };
	items?: JSONSchema;
}

type JSONValue =
	| string
	| number
	| boolean
	| null
	| JSONValue[]
	| { [key: string]: JSONValue };
