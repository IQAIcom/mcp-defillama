import { config } from "../config.js";
import {
	createChildLogger,
	createLogAndWrapError,
} from "../lib/utils/index.js";
import type {
	BatchHistoricalResponse,
	ChartResponse,
	CurrentPricesResponse,
	FirstPricesResponse,
	PercentageResponse,
} from "../types.js";
import { BaseService, type RequestOptions } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP Price Service");

const logAndWrapError = createLogAndWrapError(logger);

/**
 * Price Service
 * Handles cryptocurrency token price data
 */
export class PriceService extends BaseService {
	/**
	 * Get current prices for coins (/prices/current/{coins})
	 */
	async getCurrentPricesRaw(
		args: { coins: string; searchWidth?: string | number },
		options?: RequestOptions,
	): Promise<CurrentPricesResponse> {
		try {
			const coinsSegment = encodeURIComponent(args.coins);
			const params = new URLSearchParams();

			if (args.searchWidth !== undefined) {
				params.append("searchWidth", String(args.searchWidth));
			}

			const url = `${this.COINS_URL}/prices/current/${coinsSegment}${
				params.toString() ? `?${params.toString()}` : ""
			}`;

			return await this.fetchData<CurrentPricesResponse>(
				url,
				config.priceTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch current prices for coins ${args.coins}`,
				error,
			);
		}
	}

	/**
	 * Get first recorded prices for coins (/prices/first/{coins})
	 */
	async getFirstPricesRaw(
		args: { coins: string },
		options?: RequestOptions,
	): Promise<FirstPricesResponse> {
		try {
			const url = `${this.COINS_URL}/prices/first/${args.coins}`;
			return await this.fetchData<FirstPricesResponse>(
				url,
				config.priceTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch first recorded prices for coins ${args.coins}`,
				error,
			);
		}
	}

	/**
	 * Get batch historical prices (/batchHistorical)
	 */
	async getBatchHistoricalRaw(
		args: {
			coins: string | Record<string, Array<number | string>>;
			searchWidth?: string | number;
		},
		options?: RequestOptions,
	): Promise<BatchHistoricalResponse> {
		try {
			const coinsParam =
				typeof args.coins === "string"
					? args.coins
					: encodeURIComponent(JSON.stringify(args.coins));

			const params = new URLSearchParams({ coins: coinsParam });

			if (args.searchWidth !== undefined) {
				params.append("searchWidth", String(args.searchWidth));
			}

			const url = `${this.COINS_URL}/batchHistorical?${params.toString()}`;

			return await this.fetchData<BatchHistoricalResponse>(
				url,
				config.priceTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch batch historical prices for coins ${String(args.coins)}`,
				error,
			);
		}
	}

	/**
	 * Get historical prices by contract address at a specific timestamp
	 * (/prices/historical/{timestamp}/{coins})
	 */
	async getHistoricalPricesRaw(
		args: {
			coins: string;
			timestamp: string | number;
			searchWidth?: string | number;
		},
		options?: RequestOptions,
	): Promise<CurrentPricesResponse> {
		try {
			const unixTime = this.toUnixSeconds(args.timestamp);
			const coinsSegment = encodeURIComponent(args.coins);
			const params = new URLSearchParams();

			if (args.searchWidth !== undefined) {
				params.append("searchWidth", String(args.searchWidth));
			}

			const url = `${this.COINS_URL}/prices/historical/${unixTime}/${coinsSegment}${
				params.toString() ? `?${params.toString()}` : ""
			}`;

			return await this.fetchData<CurrentPricesResponse>(
				url,
				config.priceTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch historical prices for coins ${args.coins} at timestamp ${args.timestamp}`,
				error,
			);
		}
	}

	/**
	 * Get percentage price change for coins (/percentage/{coins})
	 */
	async getPercentageChangeRaw(
		args: {
			coins: string;
			period?: string;
			lookForward?: boolean;
			timestamp?: string | number;
		},
		options?: RequestOptions,
	): Promise<PercentageResponse> {
		try {
			const coinsSegment = encodeURIComponent(args.coins);
			const params = new URLSearchParams();

			if (args.period) params.append("period", args.period);
			if (args.lookForward) params.append("lookForward", "true");
			if (args.timestamp) {
				const unixTime = this.toUnixSeconds(args.timestamp);
				params.append("timestamp", unixTime.toString());
			}

			const url = `${this.COINS_URL}/percentage/${coinsSegment}${
				params.toString() ? `?${params.toString()}` : ""
			}`;
			return await this.fetchData<PercentageResponse>(
				url,
				config.priceTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch percentage changes for coins ${args.coins}`,
				error,
			);
		}
	}

	/**
	 * Get chart data for coins (/chart/{coins})
	 */
	async getPriceChartRaw(
		args: {
			coins: string;
			start?: string | number;
			end?: string | number;
			span?: number;
			period?: string;
			searchWidth?: string | number;
		},
		options?: RequestOptions,
	): Promise<ChartResponse> {
		try {
			let url = `${this.COINS_URL}/chart/${args.coins}`;
			const params = new URLSearchParams();

			if (args.start !== undefined) params.append("start", String(args.start));
			if (args.end !== undefined) params.append("end", String(args.end));
			if (args.span !== undefined) params.append("span", args.span.toString());
			if (args.period) params.append("period", args.period);
			if (args.searchWidth !== undefined)
				params.append("searchWidth", String(args.searchWidth));

			if (params.toString()) url += `?${params.toString()}`;

			return await this.fetchData<ChartResponse>(url, config.priceTtl, options);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch chart data for coins ${args.coins}`,
				error,
			);
		}
	}
}
