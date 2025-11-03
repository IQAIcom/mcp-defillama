import type { LanguageModel } from "ai";
import axios from "axios";
import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";
import { config } from "../config.js";
import { env } from "../env.js";
import { createChildLogger } from "../lib/utils/index.js";
import { toMarkdown } from "../lib/utils/markdown-formatter.js";
import { LLMDataFilter } from "../utils/data-filter.js";

const logger = createChildLogger("DefiLlama MCP Base Service");

// Initialize tiktoken encoder for token counting
const encoder = new Tiktoken(cl100k_base);

/**
 * Base Service for DefiLlama API
 * Provides common caching and data fetching functionality
 */
export abstract class BaseService {
	protected aiModel?: LanguageModel;
	protected dataFilter?: LLMDataFilter;
	protected currentQuery?: string;

	/**
	 * Set the AI model for data filtering
	 * Call this method to enable automatic filtering of large responses
	 */
	setAIModel(model: LanguageModel) {
		this.aiModel = model;
		this.dataFilter = new LLMDataFilter({ model });
	}

	/**
	 * Set the current user query for context-aware filtering
	 * This should be called before making service requests
	 */
	setQuery(query: string) {
		this.currentQuery = query;
	}

	protected readonly BASE_URL = "https://api.llama.fi";
	protected readonly COINS_URL = "https://coins.llama.fi";
	protected readonly STABLECOINS_URL = "https://stablecoins.llama.fi";
	protected readonly YIELDS_URL = "https://yields.llama.fi";
	protected readonly DEFAULT_CACHE_TTL_SECONDS = 60 * 60; // 1 hour

	protected async fetchData<T>(
		url: string,
		cacheDurationSeconds: number = this.DEFAULT_CACHE_TTL_SECONDS,
	): Promise<T> {
		// Use IQ Gateway if configured, otherwise make direct API calls
		if (env.IQ_GATEWAY_URL && env.IQ_GATEWAY_KEY) {
			return this.fetchViaGateway<T>(url, cacheDurationSeconds);
		}
		return this.fetchDirect<T>(url);
	}

	/**
	 * Fetch data via IQ Gateway (with caching and monitoring)
	 */
	private async fetchViaGateway<T>(
		url: string,
		cacheDurationSeconds: number,
	): Promise<T> {
		if (!env.IQ_GATEWAY_URL || !env.IQ_GATEWAY_KEY) {
			throw new Error(
				"IQ_GATEWAY_URL and IQ_GATEWAY_KEY must be configured to use gateway",
			);
		}

		const proxyUrl = new URL(env.IQ_GATEWAY_URL);
		proxyUrl.searchParams.append("url", url);
		proxyUrl.searchParams.append("projectName", "defillama_mcp");
		if (cacheDurationSeconds >= 0) {
			proxyUrl.searchParams.append(
				"cacheDuration",
				Math.floor(cacheDurationSeconds).toString(),
			);
		}

		try {
			const response = await axios.get<T>(proxyUrl.href, {
				headers: {
					"Content-Type": "application/json",
					"x-api-key": env.IQ_GATEWAY_KEY,
				},
			});
			return response.data;
		} catch (error: unknown) {
			if (axios.isAxiosError(error)) {
				const errorPayload = error.response?.data ?? error.message;
				const errorMessage =
					typeof errorPayload === "string"
						? errorPayload
						: JSON.stringify(errorPayload);
				throw new Error(errorMessage);
			}
			throw error instanceof Error ? error : new Error(String(error));
		}
	}

	/**
	 * Fetch data directly from DefiLlama API
	 */
	private async fetchDirect<T>(url: string): Promise<T> {
		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};

			// Add DefiLlama API key if provided
			if (env.DEFILLAMA_API_KEY) {
				headers["x-api-key"] = env.DEFILLAMA_API_KEY;
			}

			const response = await axios.get<T>(url, { headers });
			return response.data;
		} catch (error: unknown) {
			if (axios.isAxiosError(error)) {
				const errorPayload = error.response?.data ?? error.message;
				const errorMessage =
					typeof errorPayload === "string"
						? errorPayload
						: JSON.stringify(errorPayload);
				throw new Error(errorMessage);
			}
			throw error instanceof Error ? error : new Error(String(error));
		}
	}

	protected toUnixSeconds(value: string | number): number {
		if (typeof value === "number") {
			return Math.floor(value);
		}

		const trimmed = value.trim();
		if (/^\d+$/.test(trimmed)) {
			return Math.floor(Number(trimmed));
		}

		const parsed = Date.parse(trimmed);
		if (Number.isNaN(parsed)) {
			throw new Error(`Invalid timestamp value: ${value}`);
		}

		return Math.floor(parsed / 1000);
	}

	/**
	 * Format response for LLM consumption
	 * Returns MCP-compliant response with content array
	 * Automatically filters large responses if AI model is configured
	 * Uses currentQuery set via setQuery() for filtering context
	 */
	protected async formatResponse(
		data: unknown,
		options?: {
			title?: string;
			currencyFields?: string[];
			numberFields?: string[];
		},
	): Promise<string> {
		let markdownOutput = toMarkdown(data, options);

		const tokenLength = encoder.encode(markdownOutput).length;
		logger.info(`Response token length: ${tokenLength}`);
		logger.info(
			`Response token need filtering: ${tokenLength > config.maxTokens ? "Yes" : "No"}`,
		);
		logger.info(
			`User query for filtering: ${this.currentQuery ? "Yes" : "No"}`,
		);
		logger.info(`Data filter configured: ${this.dataFilter ? "Yes" : "No"}`);

		if (
			tokenLength > config.maxTokens &&
			this.dataFilter &&
			this.currentQuery
		) {
			try {
				const jsonData = JSON.stringify(data);
				const filteredJson = await this.dataFilter.filter(
					jsonData,
					this.currentQuery,
				);
				markdownOutput = toMarkdown(JSON.parse(filteredJson), {
					title: options?.title,
					currencyFields: options?.currencyFields,
					numberFields: options?.numberFields,
				});

				const tokenLength = encoder.encode(markdownOutput).length;
				logger.info(`New Response token length: ${tokenLength}`);

				return markdownOutput;
			} catch (error) {
				console.error("Error filtering response:", error);
				return markdownOutput;
			}
		}

		return markdownOutput;
	}
}
