import { createChildLogger } from "../lib/utils/index.js";
import type { OptionsOverviewResponse } from "../types.js";
import { BaseService } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP Options Service");

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
 * Options Service
 * Handles options protocol data
 */
export class OptionsService extends BaseService {
	/**
	 * Get options protocol data
	 */
	async getOptionsData(args: {
		sortCondition: string;
		order: "asc" | "desc";
		dataType: string;
		chain?: string;
		protocol?: string;
		excludeTotalDataChart?: boolean;
		excludeTotalDataChartBreakdown?: boolean;
	}): Promise<string> {
		try {
			const excludeTotalDataChart =
				args.excludeTotalDataChart !== undefined
					? args.excludeTotalDataChart
					: true;
			const excludeTotalDataChartBreakdown =
				args.excludeTotalDataChartBreakdown !== undefined
					? args.excludeTotalDataChartBreakdown
					: true;
			const dataType = args.dataType ?? "dailyNotionalVolume";

			const params = new URLSearchParams({
				excludeTotalDataChart: String(excludeTotalDataChart),
				excludeTotalDataChartBreakdown: String(excludeTotalDataChartBreakdown),
				dataType,
			});

			if (args.protocol) {
				const summaryParams = new URLSearchParams({
					dataType,
				});
				const url = `${this.BASE_URL}/summary/options/${args.protocol}?${summaryParams.toString()}`;
				const data = await this.fetchData<OptionsOverviewResponse>(url);

				return await this.formatResponse(data, {
					title: `Options Protocol: ${args.protocol}`,
					currencyFields: ["total24h", "total7d", "total30d"],
					numberFields: ["change_1d", "change_7d", "change_1m"],
				});
			}

			const url = args.chain
				? `${this.BASE_URL}/overview/options/${args.chain}?${params.toString()}`
				: `${this.BASE_URL}/overview/options?${params.toString()}`;
			const data = await this.fetchData<OptionsOverviewResponse>(url);

			return await this.processOptionsResponse(data, args);
		} catch (error) {
			const target =
				args.protocol ??
				(args.chain ? `chain ${args.chain}` : "global overview");
			throw logAndWrapError(
				`Failed to fetch options data for ${target}`,
				error,
			);
		}
	}

	/**
	 * Process options response and format top protocols
	 */
	private async processOptionsResponse(
		data: OptionsOverviewResponse,
		args: { sortCondition: string; order: "asc" | "desc"; chain?: string },
	): Promise<string> {
		if (data.protocols) {
			const sorted = data.protocols.sort((a, b) => {
				const aVal = (a[args.sortCondition as keyof typeof a] as number) || 0;
				const bVal = (b[args.sortCondition as keyof typeof b] as number) || 0;
				return args.order === "asc" ? aVal - bVal : bVal - aVal;
			});

			const top10 = sorted.slice(0, 10);

			const title = args.chain
				? `Top 10 Options Protocols: ${args.chain}`
				: "Top 10 Options Protocols";

			return await this.formatResponse(top10, {
				title,
				currencyFields: ["total24h", "total7d", "total30d"],
				numberFields: ["change_1d", "change_7d", "change_1m"],
			});
		}

		return await this.formatResponse(data, {
			title: "Options Data",
		});
	}
}
