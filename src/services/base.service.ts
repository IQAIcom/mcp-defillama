import axios from "axios";
import { env } from "../env.js";
import { extractErrorMessage } from "../lib/utils/index.js";

export type RequestOptions = { signal?: AbortSignal; timeout?: number };

/**
 * Base Service for DefiLlama API
 * Provides common caching and data fetching functionality
 */
export abstract class BaseService {
	protected readonly BASE_URL = "https://api.llama.fi";
	protected readonly COINS_URL = "https://coins.llama.fi";
	protected readonly STABLECOINS_URL = "https://stablecoins.llama.fi";
	protected readonly YIELDS_URL = "https://yields.llama.fi";

	protected async fetchData<T>(
		url: string,
		cacheDurationSeconds?: number,
		options?: RequestOptions,
	): Promise<T> {
		// Use IQ Gateway if configured, otherwise make direct API calls
		if (env.IQ_GATEWAY_URL && env.IQ_GATEWAY_KEY) {
			return this.fetchViaGateway<T>(url, cacheDurationSeconds, options);
		}
		return this.fetchDirect<T>(url, options);
	}

	/**
	 * Fetch data via IQ Gateway (with caching and monitoring)
	 */
	private async fetchViaGateway<T>(
		url: string,
		cacheDurationSeconds: number | undefined,
		options?: RequestOptions,
	): Promise<T> {
		/*
		 * Re-check for TypeScript to narrow env.IQ_GATEWAY_URL/KEY to non-undefined;
		 * the caller (fetchData) has already gated on these being set.
		 */
		if (!env.IQ_GATEWAY_URL || !env.IQ_GATEWAY_KEY) {
			throw new Error(
				"IQ_GATEWAY_URL and IQ_GATEWAY_KEY must be configured to use gateway",
			);
		}

		const proxyUrl = new URL(env.IQ_GATEWAY_URL);
		proxyUrl.searchParams.append("url", url);
		proxyUrl.searchParams.append("projectName", "defillama_mcp");
		if (cacheDurationSeconds !== undefined && cacheDurationSeconds >= 0) {
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
				...(options?.signal ? { signal: options.signal } : {}),
				...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
			});
			return response.data;
		} catch (error: unknown) {
			throw extractErrorMessage(error);
		}
	}

	/**
	 * Fetch data directly from DefiLlama API
	 */
	private async fetchDirect<T>(
		url: string,
		options?: RequestOptions,
	): Promise<T> {
		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};

			// Add DefiLlama API key if provided
			if (env.DEFILLAMA_API_KEY) {
				headers["x-api-key"] = env.DEFILLAMA_API_KEY;
			}

			const response = await axios.get<T>(url, {
				headers,
				...(options?.signal ? { signal: options.signal } : {}),
				...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
			});
			return response.data;
		} catch (error: unknown) {
			throw extractErrorMessage(error);
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
}
