import dedent from "dedent";
import { createChildLogger } from "../utils/index.js";
import { cacheNames } from "../cache/cache-manager.js";
import { bridgeIds } from "../enums/bridgeIds.js";
import { chains } from "../enums/chains.js";
import { options } from "../enums/options.js";
import { protocols } from "../enums/protocols.js";
import { stablecoins } from "../enums/stablecoinIds.js";
import { createResolver } from "./base-resolver.js";
import { sanitizeChainName, sanitizeNumericString, sanitizeSlug } from "./utils/sanitizers.js";
import { needsResolution } from "./utils/validators.js";

const logger = createChildLogger("DefiLlama MCP Entity Resolver");

export { needsResolution };

const protocolResolver = createResolver({
	entityType: "protocol slug",
	cacheName: cacheNames.protocols,
	entities: protocols,
	getContext: (entities) => entities.map((p) => `${p.slug}|${p.name}|${p.symbol}`).join("\n"),
	sanitize: sanitizeSlug,
	validate: (slug, entities) => entities.some((p) => p.slug.toLowerCase() === slug),
	fallbackPrompt: (name, context) => dedent`
		You are a protocol slug matcher for DefiLlama API.

		AVAILABLE PROTOCOLS (format: slug|name|symbol):
		${context}

		USER QUERY: "${name}"

		Your task: Find the EXACT protocol slug that best matches the user's query.

		Rules:
		1. Return ONLY the slug, nothing else
		2. Match the user's query to the most appropriate protocol from the list
		3. For protocols with multiple versions, prefer the latest/most commonly used version unless the user explicitly specifies a version
		4. If no good match exists, return the exact token "__NOT_FOUND__"
		5. Be case-insensitive and flexible with spacing and punctuation

		Examples:
		- User: "Lido" → "lido"
		- User: "Aave V3" → "aave-v3"
		- User: "Curve" → "curve-dex"
		- User: "MakerDAO" → "makerdao"
		- User: "Unknown Protocol" → "__NOT_FOUND__"

		Now find the slug for the user query above:
	`,
	fallbackSystem: dedent`
		You are a precise protocol matcher. Return ONLY the slug or __NOT_FOUND__. No explanations.
	`,
});

const chainResolver = createResolver({
	entityType: "chain name",
	cacheName: cacheNames.chains,
	entities: chains,
	getContext: (entities) =>
		entities.map((c) => `${c.name}|${c.tokenSymbol || ""}|${c.gecko_id || ""}`).join("\n"),
	sanitize: sanitizeChainName,
	validate: (chainName, entities) => entities.some((c) => c.name === chainName),
	fallbackPrompt: (name, context) => dedent`
		You are a blockchain name matcher for DefiLlama API.

		AVAILABLE CHAINS (format: name|tokenSymbol|gecko_id):
		${context}

		USER QUERY: "${name}"

		Your task: Find the EXACT chain name that best matches the user's query.

		Rules:
		1. Return ONLY the exact chain name as it appears in the list, nothing else
		2. Match the user's query to the most appropriate chain
		3. Handle variations: "BSC" = "Binance Smart Chain", "ETH" = "Ethereum", "Matic" = "Polygon"
		4. If no good match exists, return the exact token "__NOT_FOUND__"
		5. Be case-sensitive for the output - return the exact name from the list

		Examples:
		- User: "Ethereum" → "Ethereum"
		- User: "BSC" → "BSC"
		- User: "Binance Smart Chain" → "BSC"
		- User: "Polygon" → "Polygon"
		- User: "Matic" → "Polygon"
		- User: "Unknown Chain" → "__NOT_FOUND__"

		Now find the chain name for the user query above:
	`,
	fallbackSystem: dedent`
		You are a precise chain matcher. Return ONLY the exact chain name or __NOT_FOUND__. No explanations.
	`,
});

const stablecoinResolver = createResolver({
	entityType: "stablecoin ID",
	cacheName: cacheNames.stablecoins,
	entities: stablecoins,
	getContext: (entities) => entities.map((s) => `${s.id}|${s.name}|${s.symbol}`).join("\n"),
	sanitize: sanitizeNumericString,
	validate: (id, entities) => entities.some((s) => s.id === id),
	fallbackPrompt: (name, context) => dedent`
		You are a stablecoin ID matcher for DefiLlama API.

		AVAILABLE STABLECOINS (format: id|name|symbol):
		${context}

		USER QUERY: "${name}"

		Your task: Find the EXACT stablecoin ID that best matches the user's query.

		Rules:
		1. Return ONLY the numeric ID, nothing else
		2. Match the user's query to the most appropriate stablecoin by name or symbol
		3. Handle variations: "USDC" = "USD Coin" (ID: 2), "Tether" = "USDT" (ID: 1)
		4. If no good match exists, return the exact token "__NOT_FOUND__"

		Examples:
		- User: "USDC" → "2"
		- User: "USD Coin" → "2"
		- User: "Tether" → "1"
		- User: "USDT" → "1"
		- User: "DAI" → "5"
		- User: "Unknown Stablecoin" → "__NOT_FOUND__"

		Now find the ID for the user query above:
	`,
	fallbackSystem: dedent`
		You are a precise stablecoin matcher. Return ONLY the numeric ID or __NOT_FOUND__. No explanations.
	`,
});

const bridgeResolver = createResolver({
	entityType: "bridge ID",
	cacheName: cacheNames.bridges,
	entities: bridgeIds,
	getContext: (entities) => entities.map((b) => `${b.id}|${b.name}|${b.displayName}`).join("\n"),
	sanitize: (output) => {
		const id = sanitizeNumericString(output);
		return Number(id);
	},
	validate: (id, entities) => entities.some((b) => b.id === id),
	fallbackPrompt: (name, context) => dedent`
		You are a bridge ID matcher for DefiLlama API.

		AVAILABLE BRIDGES (format: id|name|displayName):
		${context}

		USER QUERY: "${name}"

		Your task: Find the EXACT bridge ID that best matches the user's query.

		Rules:
		1. Return ONLY the numeric ID, nothing else
		2. Match the user's query to the most appropriate bridge by name or display name
		3. Handle variations in naming
		4. If no good match exists, return the exact token "__NOT_FOUND__"

		Examples:
		- User: "Polygon Bridge" → "1"
		- User: "Stargate" → "12"
		- User: "Arbitrum" → "2"
		- User: "Fictional Bridge" → "__NOT_FOUND__"

		Now find the ID for the user query above:
	`,
	fallbackSystem: dedent`
		You are a precise bridge matcher. Return ONLY the numeric ID or __NOT_FOUND__. No explanations.
	`,
});

export async function resolveProtocol(name: string): Promise<string | null> {
	const resolver = await protocolResolver;
	const result = await resolver(name);
	return typeof result === "string" ? result : null;
}

export async function resolveChain(name: string): Promise<string | null> {
	const resolver = await chainResolver;
	const result = await resolver(name);
	return typeof result === "string" ? result : null;
}

export async function resolveStablecoin(name: string): Promise<string | null> {
	const resolver = await stablecoinResolver;
	const result = await resolver(name);
	return typeof result === "string" ? result : null;
}

export async function resolveBridge(name: string): Promise<number | null> {
	const resolver = await bridgeResolver;
	const result = await resolver(name);
	return typeof result === "number" ? result : null;
}

export async function resolveOption(name: string): Promise<string | null> {
	try {
		const exactMatch = options.find(
			(o) =>
				o.name.toLowerCase() === name.toLowerCase() || o.slug.toLowerCase() === name.toLowerCase(),
		);

		if (exactMatch) {
			logger.info(`Resolved option "${name}" → "${exactMatch.slug}"`);
			return exactMatch.slug;
		}

		const partialMatch = options.find(
			(o) =>
				o.name.toLowerCase().includes(name.toLowerCase()) ||
				name.toLowerCase().includes(o.name.toLowerCase()),
		);

		if (partialMatch) {
			logger.info(`Resolved option "${name}" → "${partialMatch.slug}" (partial match)`);
			return partialMatch.slug;
		}

		logger.warn(`Could not resolve option: ${name}`);
		return null;
	} catch (error) {
		logger.error("Error resolving option:", error);
		return null;
	}
}

export async function resolveEntities(request: {
	protocols?: string[];
	chains?: string[];
	stablecoins?: string[];
	bridges?: string[];
	options?: string[];
}): Promise<{
	protocols: Record<string, string | null>;
	chains: Record<string, string | null>;
	stablecoins: Record<string, string | null>;
	bridges: Record<string, number | null>;
	options: Record<string, string | null>;
}> {
	const results: {
		protocols: Record<string, string | null>;
		chains: Record<string, string | null>;
		stablecoins: Record<string, string | null>;
		bridges: Record<string, number | null>;
		options: Record<string, string | null>;
	} = {
		protocols: {},
		chains: {},
		stablecoins: {},
		bridges: {},
		options: {},
	};

	const promises: Promise<void>[] = [];

	if (request.protocols) {
		for (const protocol of request.protocols) {
			promises.push(
				(async () => {
					results.protocols[protocol] = await resolveProtocol(protocol);
				})(),
			);
		}
	}

	if (request.chains) {
		for (const chain of request.chains) {
			promises.push(
				(async () => {
					results.chains[chain] = await resolveChain(chain);
				})(),
			);
		}
	}

	if (request.stablecoins) {
		for (const stablecoin of request.stablecoins) {
			promises.push(
				(async () => {
					results.stablecoins[stablecoin] = await resolveStablecoin(stablecoin);
				})(),
			);
		}
	}

	if (request.bridges) {
		for (const bridge of request.bridges) {
			promises.push(
				(async () => {
					results.bridges[bridge] = await resolveBridge(bridge);
				})(),
			);
		}
	}

	if (request.options) {
		for (const option of request.options) {
			promises.push(
				(async () => {
					results.options[option] = await resolveOption(option);
				})(),
			);
		}
	}

	await Promise.all(promises);

	return results;
}
