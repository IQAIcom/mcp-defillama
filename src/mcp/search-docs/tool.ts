// src/mcp/search-docs/tool.ts
import MiniSearch from "minisearch";
import { z } from "zod";
import { ENTRIES, type IndexEntry } from "./embedded-index.js";

const PARAMS = z.object({
	query: z
		.string()
		.describe(
			"Free-text query, e.g. 'top protocols by tvl' or 'stablecoin circulating supply by chain'.",
		),
	detail: z
		.enum(["default", "verbose"])
		.optional()
		.describe(
			"'default' returns structured entries; 'verbose' returns markdown blobs.",
		),
});

const STOPWORDS = new Set([
	"a",
	"an",
	"the",
	"for",
	"of",
	"on",
	"in",
	"to",
	"is",
	"are",
	"by",
	"with",
	"and",
	"or",
	"it",
	"its",
	"has",
	"have",
	"be",
	"at",
	"from",
	"this",
	"that",
	"these",
	"those",
	"as",
	"no",
	"not",
	"per",
]);

/** Split camelCase and underscore/dot identifiers into individual tokens. */
function nameTokenize(text: string): string[] {
	if (!text) return [];
	return text
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.toLowerCase()
		.split(/[\s._]+/)
		.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Standard word tokenizer with stopword removal. */
function defaultTokenize(text: string): string[] {
	if (!text) return [];
	return text
		.toLowerCase()
		.split(/\W+/)
		.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

const mini = new MiniSearch<IndexEntry & { id: string }>({
	fields: ["name", "qualified", "description", "title", "content"],
	storeFields: [
		"kind",
		"name",
		"qualified",
		"description",
		"params",
		"exampleCall",
		"title",
		"content",
	],
	tokenize: (text: string, fieldName?: string) => {
		if (fieldName === "name" || fieldName === "qualified") {
			return nameTokenize(text);
		}
		return defaultTokenize(text);
	},
	searchOptions: {
		prefix: true,
		fuzzy: 0.1,
		boost: { name: 5, qualified: 4, description: 2 },
		tokenize: defaultTokenize,
		boostDocument: (_docId, _term, storedFields) =>
			(storedFields as { kind?: string }).kind === "method" ? 2.0 : 0.5,
	},
});
mini.addAll(
	ENTRIES.map((e) => ({
		...e,
		id: e.kind === "method" ? e.name : e.id,
		name: e.kind === "method" ? e.name : undefined,
		qualified: e.kind === "method" ? e.qualified : undefined,
		description: e.kind === "method" ? e.description : undefined,
		title: e.kind === "prose" ? e.title : undefined,
		content: e.kind === "prose" ? e.content : undefined,
	})) as (IndexEntry & { id: string })[],
);

export const searchDocsTool = {
	name: "search_docs",
	description:
		"Search DefiLlama SDK docs to find the right methods, parameters, and example code. Use before writing execute() code when you're unsure of the API.",
	parameters: PARAMS,
	annotations: { readOnlyHint: true },
	execute: async (args: z.infer<typeof PARAMS>) => {
		const q = args.query.trim();
		if (!q) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({
							results: [],
							hint: "Provide a query like 'top protocols by tvl' or 'yield pools by apy'.",
						}),
					},
				],
				isError: false,
			};
		}
		const hits = mini.search(q).slice(0, 10);
		if (hits.length === 0) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({
							results: [],
							hint: "No matches. Try broader terms, or call list_endpoints to discover what's available, or defillama_resolve for chain grounding.",
						}),
					},
				],
				isError: false,
			};
		}
		const verbose = args.detail === "verbose";
		const results = hits.map((h) =>
			verbose
				? { ...h }
				: {
						kind: h.kind,
						qualified: h.qualified,
						name: h.name,
						description: h.description,
						params: h.params,
						exampleCall: h.exampleCall,
						title: h.title,
						/*
						 * Prose entries are short cookbook recipes whose value is the
						 * embedded code; include content here so agents don't have to
						 * re-run the same query with detail:"verbose" just to read one.
						 */
						content: h.kind === "prose" ? h.content : undefined,
					},
		);
		return {
			content: [{ type: "text" as const, text: JSON.stringify({ results }) }],
			isError: false,
		};
	},
};
