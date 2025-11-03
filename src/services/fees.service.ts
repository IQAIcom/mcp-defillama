import { createChildLogger } from "../lib/utils/index.js";
import type { FeesOverviewResponse } from "../types.js";
import { BaseService } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP Fees Service");

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
 * Fees & Revenue Service
 * Handles protocol fees and revenue data
 */
export class FeesService extends BaseService {
	async getFeesAndRevenue(args: {
		excludeTotalDataChart?: boolean;
		excludeTotalDataChartBreakdown?: boolean;
		dataType?: string;
		chain?: string;
		protocol?: string;
		sortCondition: string;
		order: "asc" | "desc";
	}): Promise<string> {
		try {
			const excludeTotalDataChart =
				args.excludeTotalDataChart !== undefined ? args.excludeTotalDataChart : true;
			const excludeTotalDataChartBreakdown =
				args.excludeTotalDataChartBreakdown !== undefined
					? args.excludeTotalDataChartBreakdown
					: true;
			const dataType = args.dataType ?? "dailyFees";

			const params = new URLSearchParams({
				excludeTotalDataChart: String(excludeTotalDataChart),
				excludeTotalDataChartBreakdown: String(excludeTotalDataChartBreakdown),
				dataType,
			});

			if (args.protocol) {
				const url = `${this.BASE_URL}/summary/fees/${args.protocol}?${params.toString()}`;
				const data = await this.fetchData<FeesOverviewResponse>(url);

				return await this.formatResponse(data, {
					title: `Fees & Revenue: ${args.protocol}`,
					currencyFields: [
						"dailyUserFees",
						"dailyHoldersRevenue",
						"dailySupplySideRevenue",
						"holdersRevenue30d",
					],
					numberFields: ["change_1d", "change_7d", "change_1m"],
				});
			}

			const url = args.chain
				? `${this.BASE_URL}/overview/fees/${args.chain}?${params.toString()}`
				: `${this.BASE_URL}/overview/fees?${params.toString()}`;
			const data = await this.fetchData<FeesOverviewResponse>(url);

			return await this.processFeesResponse(data, args);
		} catch (error) {
			const target = args.protocol ?? (args.chain ? `chain ${args.chain}` : "global overview");
			throw logAndWrapError(`Failed to fetch fees and revenue data for ${target}`, error);
		}
	}

	/**
	 * Process fees response and format top protocols
	 */
	private async processFeesResponse(
		data: FeesOverviewResponse,
		args: { sortCondition: string; order: "asc" | "desc"; chain?: string },
	): Promise<string> {
		if (data.protocols) {
			const sorted = data.protocols.sort((a, b) => {
				const aVal = (a[args.sortCondition as keyof typeof a] as number) || 0;
				const bVal = (b[args.sortCondition as keyof typeof b] as number) || 0;
				return args.order === "asc" ? aVal - bVal : bVal - aVal;
			});

			const top10 = sorted.slice(0, 10).map((protocol) => ({
				name: protocol.name,
				change_1d: protocol.change_1d,
				change_7d: protocol.change_7d,
				change_1m: protocol.change_1m,
				dailyUserFees: protocol.dailyUserFees,
				dailyHoldersRevenue: protocol.dailyHoldersRevenue,
				dailySupplySideRevenue: protocol.dailySupplySideRevenue,
				holdersRevenue30d: protocol.holdersRevenue30d,
			}));

			const title = args.chain
				? `Top 10 Protocols by Fees: ${args.chain}`
				: "Top 10 Protocols by Fees";

			return await this.formatResponse(top10, {
				title,
				currencyFields: [
					"dailyUserFees",
					"dailyHoldersRevenue",
					"dailySupplySideRevenue",
					"holdersRevenue30d",
				],
				numberFields: ["change_1d", "change_7d", "change_1m"],
			});
		}

		return await this.formatResponse(data, {
			title: "Fees & Revenue Data",
		});
	}
}
