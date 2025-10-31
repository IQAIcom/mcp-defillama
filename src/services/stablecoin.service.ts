import { createChildLogger } from "../lib/utils/index.js";
import type {
	StablecoinChainItem,
	StablecoinChartItem,
	StablecoinPriceItem,
	StablecoinsResponse,
} from "../types.js";
import { BaseService } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP Stablecoin Service");

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
 * Stablecoin Service
 * Handles stablecoin data and metrics
 */
export class StablecoinService extends BaseService {
	/**
	 * Get stablecoin data with circulation and prices
	 */
	async getStableCoin(args: { includePrices?: boolean }): Promise<string> {
		try {
			const includePrices = args.includePrices ?? false;
			const data = await this.fetchData<StablecoinsResponse>(
				`${this.STABLECOINS_URL}/stablecoins?includePrices=${includePrices}`,
			);

			const sorted = data.peggedAssets.sort(
				(a, b) => b.circulating.peggedUSD - a.circulating.peggedUSD,
			);

			const top20 = sorted.slice(0, 20).map((coin) => ({
				id: coin.id,
				name: coin.name,
				symbol: coin.symbol,
				circulating: coin.circulating,
				circulatingPrevDay: coin.circulatingPrevDay,
				circulatingPrevWeek: coin.circulatingPrevWeek,
				circulatingPrevMonth: coin.circulatingPrevMonth,
				price: coin.price,
			}));

			return await this.formatResponse(top20, {
				title: "Top 20 Stablecoins",
				currencyFields: ["price"],
			});
		} catch (error) {
			throw logAndWrapError("Failed to fetch stablecoin overview", error);
		}
	}

	/**
	 * Get stablecoin data by chains
	 */
	async getStableCoinChains(): Promise<string> {
		try {
			const data = await this.fetchData<StablecoinChainItem[]>(
				`${this.STABLECOINS_URL}/stablecoinchains`,
			);

			const last3 = data.slice(-3).map((item) => ({
				chainName: item.name,
				mcapsum: item.totalCirculating.peggedUSD,
			}));

			return await this.formatResponse(last3, {
				title: "Stablecoin Chains (Last 3)",
				currencyFields: ["mcapsum"],
			});
		} catch (error) {
			throw logAndWrapError("Failed to fetch stablecoin chain data", error);
		}
	}

	/**
	 * Get historical stablecoin market cap charts
	 */
	async getStableCoinCharts(args: {
		chain?: string;
		stablecoin?: number | string;
	}): Promise<string> {
		try {
			let url: string;
			const params = new URLSearchParams();

			if (args.stablecoin !== undefined) {
				params.append("stablecoin", String(args.stablecoin));
			}

			if (args.chain) {
				url = `${this.STABLECOINS_URL}/stablecoincharts/${args.chain}`;
			} else {
				url = `${this.STABLECOINS_URL}/stablecoincharts/all`;
			}

			const data = await this.fetchData<StablecoinChartItem[]>(
				params.toString() ? `${url}?${params.toString()}` : url,
			);

			const last10 = data.slice(-10).map((item) => ({
				date: item.date,
				totalCirculatingPeggedUSD: item.totalCirculating.peggedUSD,
				totalUnreleased: item.totalUnreleased,
				totalCirculatingUSD: item.totalCirculatingUSD,
				totalMintedUSD: item.totalMintedUSD,
				totalBridgedToUSD: item.totalBridgedToUSD,
			}));

			const title = args.chain
				? `Stablecoin Charts: ${args.chain}`
				: "Stablecoin Charts (All Chains)";

			return await this.formatResponse(last10, {
				title,
				currencyFields: [
					"totalCirculatingPeggedUSD",
					"totalCirculatingUSD",
					"totalMintedUSD",
					"totalBridgedToUSD",
				],
			});
		} catch (error) {
			const target = args.chain ?? "all chains";
			throw logAndWrapError(
				`Failed to fetch stablecoin charts for ${target}`,
				error,
			);
		}
	}

	/**
	 * Get historical stablecoin price data
	 */
	async getStableCoinPrices(): Promise<string> {
		try {
			const data = await this.fetchData<StablecoinPriceItem[]>(
				`${this.STABLECOINS_URL}/stablecoinprices`,
			);

			const last3 = data.slice(-3).map((item) => ({
				date: item.date,
				prices: item.prices,
			}));

			return await this.formatResponse(last3, {
				title: "Stablecoin Prices (Last 3)",
			});
		} catch (error) {
			throw logAndWrapError("Failed to fetch stablecoin prices", error);
		}
	}
}
