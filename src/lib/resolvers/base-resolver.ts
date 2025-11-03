import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { env } from "../../env.js";
import { createChildLogger } from "../utils/index.js";
import { isNotFoundResponse } from "./utils/validators.js";

const logger = createChildLogger("DefiLlama MCP Entity Resolver");

const google = createGoogleGenerativeAI({
	apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const gemini25Flash = "gemini-2.5-flash";

interface ResolverConfig<T> {
	entityType: string;
	cacheName: string | null;
	entities: T[];
	getContext: (entities: T[]) => string;
	sanitize: (output: string) => string | number;
	validate: (sanitized: string | number, entities: T[]) => boolean;
	fallbackPrompt: (name: string, context: string) => string;
	fallbackSystem?: string;
}

export async function createResolver<T>(
	config: ResolverConfig<T>,
): Promise<(name: string) => Promise<string | number | null>> {
	return async (name: string) => {
		try {
			const result = config.cacheName
				? await generateText({
						model: google(gemini25Flash),
						prompt: `USER QUERY: "${name}"\n\nReturn ONLY the ${config.entityType} or __NOT_FOUND__:`,
						providerOptions: {
							google: {
								cachedContent: config.cacheName,
							},
						},
					})
				: await generateText({
						model: google(gemini25Flash),
						prompt: config.fallbackPrompt(
							name,
							config.getContext(config.entities),
						),
						...(config.fallbackSystem && {
							system: config.fallbackSystem,
						}),
					});

			const rawOutput = result.text.trim();

			if (isNotFoundResponse(rawOutput)) {
				logger.warn(`Could not resolve ${config.entityType}: ${name}`);
				return null;
			}

			const sanitized = config.sanitize(rawOutput);

			if (!sanitized) {
				logger.warn(`Gemini returned empty ${config.entityType} for: ${name}`);
				return null;
			}

			if (config.validate(sanitized, config.entities)) {
				return typeof sanitized === "string" ? sanitized : sanitized;
			}

			logger.warn(`Gemini returned invalid ${config.entityType}: ${sanitized}`);
			return null;
		} catch (error) {
			logger.error(`Error resolving ${config.entityType}:`, error);
			return null;
		}
	};
}
