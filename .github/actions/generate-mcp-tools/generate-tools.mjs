import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const README_PATH = path.join(ROOT, "README.md");
const TOOLS_DIR = path.join(ROOT, "src", "tools");

const START = "<!-- AUTO-GENERATED TOOLS START -->";
const END = "<!-- AUTO-GENERATED TOOLS END -->";

/**
 * Check if a schema is a Zod v4 schema
 */
function isZodV4(schema) {
	return schema && typeof schema === "object" && schema._zod?.def?.type;
}

/**
 * Check if a schema is a Zod v3 schema
 */
function isZodV3(schema) {
	return (
		schema &&
		typeof schema === "object" &&
		typeof schema.safeParse === "function" &&
		!isZodV4(schema)
	);
}

/**
 * Extract the base type from a Zod v4 schema property
 */
function extractZodV4BaseType(prop) {
	if (!prop) return { type: "unknown" };

	const def = prop._zod?.def || prop.def;
	if (!def) {
		// Check if it's a direct type
		if (prop.type) return { type: prop.type };
		return { type: "unknown" };
	}

	const wrapperType = def.type;

	// Unwrap default/optional wrappers
	if (wrapperType === "default" || wrapperType === "optional") {
		const inner = def.innerType;
		const baseInfo = extractZodV4BaseType(inner);

		if (wrapperType === "default") {
			baseInfo.default = def.defaultValue;
		}
		if (wrapperType === "optional") {
			baseInfo.optional = true;
		}
		return baseInfo;
	}

	// Handle base types
	switch (wrapperType) {
		case "string":
			return { type: "string" };
		case "number":
			return { type: "number" };
		case "boolean":
			return { type: "boolean" };
		case "enum":
			return {
				type: "string",
				enum: def.entries ? Object.keys(def.entries) : [],
			};
		case "array":
			return { type: "array" };
		case "object":
			return { type: "object" };
		case "union":
			return { type: "union" };
		default:
			return { type: wrapperType || "unknown" };
	}
}

/**
 * Convert a Zod v4 schema to JSON Schema format
 */
function zodV4ToJsonSchema(schema) {
	const def = schema._zod?.def;
	if (!def || def.type !== "object") {
		return { properties: {}, required: [] };
	}

	const shape = def.shape || {};
	const properties = {};
	const required = [];

	for (const [key, prop] of Object.entries(shape)) {
		const typeInfo = extractZodV4BaseType(prop);
		const description = prop.description || "";

		properties[key] = {
			type: typeInfo.type,
			description,
		};

		if (typeInfo.enum) {
			properties[key].enum = typeInfo.enum;
		}

		if (typeInfo.default !== undefined) {
			properties[key].default = typeInfo.default;
		}

		// If not optional and no default, it's required
		if (!typeInfo.optional && typeInfo.default === undefined) {
			required.push(key);
		}
	}

	return { properties, required };
}

/**
 * Convert any Zod schema to JSON Schema format
 */
async function zodToJsonSchema(schema) {
	// Handle Zod v4
	if (isZodV4(schema)) {
		return zodV4ToJsonSchema(schema);
	}

	// Handle Zod v3 - dynamically import zod-to-json-schema
	if (isZodV3(schema)) {
		try {
			const { zodToJsonSchema: zodV3ToJsonSchema } = await import(
				"zod-to-json-schema"
			);
			return zodV3ToJsonSchema(schema);
		} catch (err) {
			console.warn("Warning: Could not use zod-to-json-schema:", err.message);
			return { properties: {}, required: [] };
		}
	}

	// Already JSON Schema or unknown format
	return schema;
}

/**
 * Check if value is an MCP tool object
 */
function isMcpTool(exp) {
	return (
		exp &&
		typeof exp === "object" &&
		typeof exp.name === "string" &&
		typeof exp.description === "string" &&
		(exp.parameters || exp.schema)
	);
}

/**
 * Load MCP tools from the tools directory
 * Supports two patterns:
 * 1. Array export (e.g., defillamaTools = [...]) in index.ts
 * 2. Individual tool exports from separate files (excluding index.ts)
 */
async function loadTools() {
	const tools = [];

	// First, try to load tools from index.ts (array pattern)
	const indexPath = path.join(TOOLS_DIR, "index.ts");
	if (fs.existsSync(indexPath)) {
		try {
			const mod = await import(indexPath);

			// Look for array exports containing tool objects
			for (const [key, value] of Object.entries(mod)) {
				if (Array.isArray(value)) {
					const arrayTools = value.filter(isMcpTool);
					if (arrayTools.length > 0) {
						console.log(
							`Found ${arrayTools.length} tools in array export '${key}'`,
						);
						tools.push(...arrayTools);
					}
				} else if (isMcpTool(value)) {
					tools.push(value);
				}
			}
		} catch (err) {
			console.warn(`Warning: Could not load index.ts: ${err.message}`);
		}
	}

	// If no tools found in index.ts, try individual files
	if (tools.length === 0) {
		const files = fs
			.readdirSync(TOOLS_DIR)
			.filter((f) => f.endsWith(".ts") && f !== "index.ts");

		const toolPromises = files.map(async (file) => {
			try {
				const mod = await import(path.join(TOOLS_DIR, file));

				const matches = Object.values(mod).filter(isMcpTool);

				if (matches.length === 0) {
					return null;
				}

				if (matches.length > 1) {
					console.warn(
						`Warning: ${file} exports multiple MCP-like tools. Using the first one.`,
					);
				}

				return matches[0];
			} catch (err) {
				console.warn(`Warning: Could not load ${file}: ${err.message}`);
				return null;
			}
		});

		const loadedTools = await Promise.all(toolPromises);
		tools.push(...loadedTools.filter(Boolean));
	}

	return tools.sort((a, b) => a.name.localeCompare(b.name));
}

async function renderSchema(schema) {
	if (!schema) {
		return "_No parameters_";
	}

	const jsonSchema = await zodToJsonSchema(schema);

	const properties = jsonSchema.properties ?? {};
	const required = new Set(jsonSchema.required ?? []);

	if (Object.keys(properties).length === 0) {
		return "_No parameters_";
	}

	// Filter out internal parameters (starting with _)
	const publicProperties = Object.entries(properties).filter(
		([key]) => !key.startsWith("_"),
	);

	if (publicProperties.length === 0) {
		return "_No parameters_";
	}

	// Check if any param has a default value to determine table columns
	const hasDefaults = publicProperties.some(
		([, prop]) => prop.default !== undefined,
	);

	// Build table header
	let table = hasDefaults
		? "| Parameter | Type | Required | Default | Description |\n|-----------|------|----------|---------|-------------|\n"
		: "| Parameter | Type | Required | Description |\n|-----------|------|----------|-------------|\n";

	// Build table rows
	for (const [key, prop] of publicProperties) {
		const type = Array.isArray(prop.type)
			? prop.type.join(" | ")
			: (prop.type ?? "unknown");

		const requiredStr = required.has(key) ? "Yes" : "No";
		const description = prop.description ?? "";
		const defaultVal =
			prop.default !== undefined ? JSON.stringify(prop.default) : "";

		if (hasDefaults) {
			table += `| \`${key}\` | ${type} | ${requiredStr} | ${defaultVal} | ${description} |\n`;
		} else {
			table += `| \`${key}\` | ${type} | ${requiredStr} | ${description} |\n`;
		}
	}

	return table.trim();
}

async function renderMarkdown(tools) {
	let md = "";

	for (const tool of tools) {
		const schema = tool.parameters || tool.schema;

		md += `### \`${tool.name}\`\n`;
		md += `${tool.description}\n\n`;
		md += `${await renderSchema(schema)}\n\n`;
	}

	return md.trim();
}

function updateReadme({ readme, toolsMd }) {
	if (!readme.includes(START) || !readme.includes(END)) {
		throw new Error("README missing AUTO-GENERATED TOOLS markers");
	}

	return readme.replace(
		new RegExp(`${START}[\\s\\S]*?${END}`, "m"),
		`${START}\n\n${toolsMd}\n\n${END}`,
	);
}

async function main() {
	try {
		const readme = fs.readFileSync(README_PATH, "utf8");
		const tools = await loadTools();

		if (tools.length === 0) {
			console.warn("Warning: No tools found!");
		}

		const toolsMd = await renderMarkdown(tools);
		const updated = updateReadme({ readme, toolsMd });

		fs.writeFileSync(README_PATH, updated);
		console.log(`Synced ${tools.length} MCP tools to README.md`);
	} catch (error) {
		console.error("Error updating README:", error);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
