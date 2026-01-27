import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const README_PATH = path.join(ROOT, "README.md");
const TOOLS_DIR = path.join(ROOT, "src", "tools");

const START = "<!-- AUTO-GENERATED TOOLS START -->";
const END = "<!-- AUTO-GENERATED TOOLS END -->";

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

function renderSchema(schema) {
	if (!schema) {
		return "_No parameters_";
	}

	// If this is a Zod schema, convert it to JSON Schema
	const jsonSchema =
		typeof schema.safeParse === "function" ? zodToJsonSchema(schema) : schema;

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

function renderMarkdown(tools) {
	let md = "";

	for (const tool of tools) {
		const schema = tool.parameters || tool.schema;

		md += `### \`${tool.name}\`\n`;
		md += `${tool.description}\n\n`;
		md += `${renderSchema(schema)}\n\n`;
	}

	return md.trim();
}

function updateReadme({ readme, tools }) {
	if (!readme.includes(START) || !readme.includes(END)) {
		throw new Error("README missing AUTO-GENERATED TOOLS markers");
	}

	const toolsMd = renderMarkdown(tools);

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

		const updated = updateReadme({ readme, tools });

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
