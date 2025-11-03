import { createChildLogger } from "../lib/utils/index.js";
import type { DexOverviewResponse } from "../types.js";
import { BaseService } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP DEX Service");

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
 * DEX Service
 * Handles decentralized exchange volume data
 */
export class DexService extends BaseService {
	async getDexsData(args: {
		excludeTotalDataChart?: boolean;
		excludeTotalDataChartBreakdown?: boolean;
		chain?: string;
		protocol?: string;
		sortCondition?: string;
		order?: "asc" | "desc";
	}): Promise<string> {
		try {
			const excludeTotalDataChart =
				args.excludeTotalDataChart !== undefined ? args.excludeTotalDataChart : true;
			const excludeTotalDataChartBreakdown =
				args.excludeTotalDataChartBreakdown !== undefined
					? args.excludeTotalDataChartBreakdown
					: true;

			const params = new URLSearchParams({
				excludeTotalDataChart: String(excludeTotalDataChart),
				excludeTotalDataChartBreakdown: String(excludeTotalDataChartBreakdown),
			});

			if (args.protocol) {
				const url = `${this.BASE_URL}/summary/dexs/${args.protocol}?${params.toString()}`;
				const data = await this.fetchData<DexOverviewResponse>(url);
				return await this.formatResponse(data, {
					title: `DEX Protocol: ${args.protocol}`,
					currencyFields: ["total24h", "total7d", "total30d"],
					numberFields: ["change_1d", "change_7d", "change_1m"],
				});
			}

			const url = args.chain
				? `${this.BASE_URL}/overview/dexs/${args.chain}?${params.toString()}`
				: `${this.BASE_URL}/overview/dexs?${params.toString()}`;
			const data = await this.fetchData<DexOverviewResponse>(url);

			if (data.protocols) {
				const sortCondition = args.sortCondition || "total24h";
				const order = args.order || "desc";

				const sorted = data.protocols.sort((a, b) => {
					const aVal = (a[sortCondition as keyof typeof a] as number) || 0;
					const bVal = (b[sortCondition as keyof typeof b] as number) || 0;
					return order === "asc" ? aVal - bVal : bVal - aVal;
				});

				const top10 = sorted.slice(0, 10).map((protocol) => ({
					displayName: protocol.displayName,
					breakdown24h: protocol.breakdown24h,
					dailyVolume: protocol.dailyVolume,
					total24h: protocol.total24h,
					total7d: protocol.total7d,
					total30d: protocol.total30d,
					change_1d: protocol.change_1d,
					change_7d: protocol.change_7d,
					change_1m: protocol.change_1m,
				}));

				const title = args.chain ? `Top 10 DEXs on ${args.chain}` : "Top 10 DEXs Globally";

				return await this.formatResponse(top10, {
					title,
					currencyFields: ["total24h", "total7d", "total30d", "dailyVolume"],
					numberFields: ["change_1d", "change_7d", "change_1m"],
				});
			}

			return await this.formatResponse(data, {
				title: "DEX Data",
			});
		} catch (error) {
			const target = args.protocol ?? (args.chain ? `chain ${args.chain}` : "global overview");
			throw logAndWrapError(`Failed to fetch DEX data for ${target}`, error);
		}
	}
}
