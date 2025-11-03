import { createChildLogger } from "../lib/utils/index.js";
import type {
	BatchHistoricalResponse,
	ChartResponse,
	CurrentPricesResponse,
	FirstPricesResponse,
	PercentageResponse,
} from "../types.js";
import { BaseService } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP Price Service");

const logAndWrapError = (context: string, error: unknown): Error => {
	if (error instanceof Error) {
		logger.error(context, error);
		return error;
	}

	const wrappedError = new Error(String(error));
	logger.error(context, wrappedError);
	return wrappedError;
};

/**
 * Price Service
 * Handles cryptocurrency token price data
 */
export class PriceService extends BaseService {
	/**
	 * Get current prices for coins
	 */
	async getPricesCurrentCoins(args: {
		coins: string;
		searchWidth?: string | number;
	}): Promise<string> {
		try {
			const coinsSegment = encodeURIComponent(args.coins);
			const params = new URLSearchParams();

			if (args.searchWidth !== undefined) {
				params.append("searchWidth", String(args.searchWidth));
			}

			const url = `${this.COINS_URL}/prices/current/${coinsSegment}${
				params.toString() ? `?${params.toString()}` : ""
			}`;

			const data = await this.fetchData<CurrentPricesResponse>(url);
			return await this.formatResponse(data, {
				title: "Current Coin Prices",
				currencyFields: ["price"],
			});
		} catch (error) {
			throw logAndWrapError(`Failed to fetch current prices for coins ${args.coins}`, error);
		}
	}

	/**
	 * Get first recorded prices for coins
	 */
	async getPricesFirstCoins(args: { coins: string }): Promise<string> {
		try {
			const url = `${this.COINS_URL}/prices/first/${args.coins}`;
			const data = await this.fetchData<FirstPricesResponse>(url);
			return await this.formatResponse(data, {
				title: "First Recorded Prices",
				currencyFields: ["price"],
			});
		} catch (error) {
			throw logAndWrapError(`Failed to fetch first recorded prices for coins ${args.coins}`, error);
		}
	}

	/**
	 * Get batch historical prices
	 */
	async getBatchHistorical(args: {
		coins: string;
		searchWidth?: string | number;
	}): Promise<string> {
		try {
			const params = new URLSearchParams({
				coins: args.coins,
			});

			if (args.searchWidth !== undefined) {
				params.append("searchWidth", String(args.searchWidth));
			}

			const url = `${this.COINS_URL}/batchHistorical?${params.toString()}`;

			const data = await this.fetchData<BatchHistoricalResponse>(url);
			return await this.formatResponse(data, {
				title: "Batch Historical Prices",
				currencyFields: ["price"],
			});
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch batch historical prices for coins ${args.coins}`,
				error,
			);
		}
	}

	/**
	 * Get historical prices by contract address at specific timestamp
	 */
	async getHistoricalPricesByContractAddress(args: {
		coins: string;
		timestamp: string | number;
		searchWidth?: string | number;
	}): Promise<string> {
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

			const data = await this.fetchData<CurrentPricesResponse>(url);
			return await this.formatResponse(data, {
				title: `Historical Prices at ${new Date(unixTime * 1000).toISOString()}`,
				currencyFields: ["price"],
			});
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch historical prices for coins ${args.coins} at timestamp ${args.timestamp}`,
				error,
			);
		}
	}

	/**
	 * Get percentage price change for coins
	 */
	async getPercentageCoins(args: {
		coins: string;
		period?: string;
		lookForward?: boolean;
		timestamp?: string | number;
	}): Promise<string> {
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
			const data = await this.fetchData<PercentageResponse>(url);
			return await this.formatResponse(data, {
				title: "Price Percentage Change",
				numberFields: ["percentage"],
			});
		} catch (error) {
			throw logAndWrapError(`Failed to fetch percentage changes for coins ${args.coins}`, error);
		}
	}

	/**
	 * Get chart data for coins
	 */
	async getChartCoins(args: {
		coins: string;
		start?: string | number;
		end?: string | number;
		span?: number;
		period?: string;
		searchWidth?: string | number;
	}): Promise<string> {
		try {
			let url = `${this.COINS_URL}/chart/${args.coins}`;
			const params = new URLSearchParams();

			if (args.start !== undefined) params.append("start", String(args.start));
			if (args.end !== undefined) params.append("end", String(args.end));
			if (args.span !== undefined) params.append("span", args.span.toString());
			if (args.period) params.append("period", args.period);
			if (args.searchWidth !== undefined) params.append("searchWidth", String(args.searchWidth));

			if (params.toString()) url += `?${params.toString()}`;

			const data = await this.fetchData<ChartResponse>(url);
			return await this.formatResponse(data, {
				title: "Price Chart Data",
				currencyFields: ["price"],
			});
		} catch (error) {
			throw logAndWrapError(`Failed to fetch chart data for coins ${args.coins}`, error);
		}
	}
}
