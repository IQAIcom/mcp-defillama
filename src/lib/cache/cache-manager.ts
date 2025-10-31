import { GoogleAICacheManager } from "@google/generative-ai/server";
import { env } from "../../env.js";
import { createChildLogger } from "../utils/index.js";
import { bridgeIds } from "../enums/bridgeIds.js";
import { chains } from "../enums/chains.js";
import { protocols } from "../enums/protocols.js";
import { stablecoins } from "../enums/stablecoinIds.js";
import {
	bridgesInstruction,
	chainsInstruction,
	protocolsInstruction,
	stablecoinsInstruction,
} from "./instructions.js";

const logger = createChildLogger("DefiLlama MCP Cache Manager");

const gemini25Flash = "gemini-2.5-flash";

export interface CacheNames {
	protocols: string | null;
	chains: string | null;
	stablecoins: string | null;
	bridges: string | null;
}

let cacheManager: GoogleAICacheManager | null = null;
export const cacheNames: CacheNames = {
	protocols: null,
	chains: null,
	stablecoins: null,
	bridges: null,
};

async function createCache(
	instruction: string,
	context: string,
	name: string,
): Promise<string | null> {
	try {
		if (!cacheManager) return null;

		const { name: cacheName } = await cacheManager.create({
			model: gemini25Flash,
			systemInstruction: instruction,
			contents: [
				{
					role: "user",
					parts: [{ text: context }],
				},
			],
			ttlSeconds: 3600,
		});

		const result = cacheName ?? null;
		logger.info(`${name} cache initialized (${result})`);
		return result;
	} catch (error) {
		logger.error(`Failed to initialize ${name} cache:`, error);
		return null;
	}
}

export async function initializeCacheManager(): Promise<void> {
	if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
		logger.warn(
			"GOOGLE_GENERATIVE_AI_API_KEY not found, caching will be disabled",
		);
		return;
	}

	try {
		cacheManager = new GoogleAICacheManager(env.GOOGLE_GENERATIVE_AI_API_KEY);

		const protocolsContext = protocols
			.map((p) => `${p.slug}|${p.name}|${p.symbol}`)
			.join("\n");

		const chainsContext = chains
			.map((c) => `${c.name}|${c.tokenSymbol || ""}|${c.gecko_id || ""}`)
			.join("\n");

		const stablecoinsContext = stablecoins
			.map((s) => `${s.id}|${s.name}|${s.symbol}`)
			.join("\n");

		const bridgesContext = bridgeIds
			.map((b) => `${b.id}|${b.name}|${b.displayName}`)
			.join("\n");

		cacheNames.protocols = await createCache(
			protocolsInstruction,
			protocolsContext,
			"Protocols",
		);
		cacheNames.chains = await createCache(
			chainsInstruction,
			chainsContext,
			"Chains",
		);
		cacheNames.stablecoins = await createCache(
			stablecoinsInstruction,
			stablecoinsContext,
			"Stablecoins",
		);
		cacheNames.bridges = await createCache(
			bridgesInstruction,
			bridgesContext,
			"Bridges",
		);

		logger.info("✅ All DefiLlama entity caches initialized successfully");
	} catch (error) {
		logger.error("Failed to initialize DefiLlama cache manager:", error);
		cacheManager = null;
		cacheNames.protocols = null;
		cacheNames.chains = null;
		cacheNames.stablecoins = null;
		cacheNames.bridges = null;
	}
}

initializeCacheManager().catch((error) => {
	logger.error("Error during cache initialization:", error);
});
