import { config } from "../config.js";
import {
	createChildLogger,
	createLogAndWrapError,
} from "../lib/utils/index.js";
import type {
	StablecoinChainItem,
	StablecoinChartItem,
	StablecoinPriceItem,
	StablecoinsResponse,
} from "../types.js";
import { BaseService, type RequestOptions } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP Stablecoin Service");

const logAndWrapError = createLogAndWrapError(logger);

/**
 * Stablecoin Service
 * Handles stablecoin data and metrics
 */
export class StablecoinService extends BaseService {
	/**
	 * Get stablecoin data with circulation and prices (/stablecoins)
	 */
	async getStablecoinsRaw(
		args: { includePrices?: boolean },
		options?: RequestOptions,
	): Promise<StablecoinsResponse> {
		try {
			const includePrices = args.includePrices ?? false;
			return await this.fetchData<StablecoinsResponse>(
				`${this.STABLECOINS_URL}/stablecoins?includePrices=${includePrices}`,
				config.stablecoinTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError("Failed to fetch stablecoin overview", error);
		}
	}

	/**
	 * Get stablecoin data by chains (/stablecoinchains)
	 */
	async getStablecoinChainsRaw(
		_args?: Record<string, never>,
		options?: RequestOptions,
	): Promise<StablecoinChainItem[]> {
		try {
			return await this.fetchData<StablecoinChainItem[]>(
				`${this.STABLECOINS_URL}/stablecoinchains`,
				config.stablecoinTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError("Failed to fetch stablecoin chain data", error);
		}
	}

	/**
	 * Get historical stablecoin market cap charts (/stablecoincharts/...)
	 */
	async getStablecoinChartsRaw(
		args: { chain?: string; stablecoin?: number | string },
		options?: RequestOptions,
	): Promise<StablecoinChartItem[]> {
		try {
			const base = args.chain
				? `${this.STABLECOINS_URL}/stablecoincharts/${args.chain}`
				: `${this.STABLECOINS_URL}/stablecoincharts/all`;

			const params = new URLSearchParams();
			if (args.stablecoin !== undefined) {
				params.append("stablecoin", String(args.stablecoin));
			}

			const url = params.toString() ? `${base}?${params.toString()}` : base;

			return await this.fetchData<StablecoinChartItem[]>(
				url,
				config.stablecoinTtl,
				options,
			);
		} catch (error) {
			const target = args.chain ?? "all chains";
			throw logAndWrapError(
				`Failed to fetch stablecoin charts for ${target}`,
				error,
			);
		}
	}

	/**
	 * Get historical stablecoin price data (/stablecoinprices)
	 */
	async getStablecoinPricesRaw(
		_args?: Record<string, never>,
		options?: RequestOptions,
	): Promise<StablecoinPriceItem[]> {
		try {
			return await this.fetchData<StablecoinPriceItem[]>(
				`${this.STABLECOINS_URL}/stablecoinprices`,
				config.stablecoinTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError("Failed to fetch stablecoin prices", error);
		}
	}
}
