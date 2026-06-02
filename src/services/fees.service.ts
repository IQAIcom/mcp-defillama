import { config } from "../config.js";
import {
	createChildLogger,
	createLogAndWrapError,
} from "../lib/utils/index.js";
import type { FeesOverviewResponse, FeesSummaryResponse } from "../types.js";
import { BaseService, type RequestOptions } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP Fees Service");

const logAndWrapError = createLogAndWrapError(logger);

/**
 * Fees & Revenue Service
 * Handles protocol fees and revenue data
 */
export class FeesService extends BaseService {
	/**
	 * Get fees summary for a single protocol (/summary/fees/{protocol})
	 */
	async getFeesSummaryRaw(
		args: {
			protocol: string;
			dataType?: string;
			excludeTotalDataChart?: boolean;
			excludeTotalDataChartBreakdown?: boolean;
		},
		options?: RequestOptions,
	): Promise<FeesSummaryResponse> {
		try {
			const excludeTotalDataChart = args.excludeTotalDataChart ?? true;
			const excludeTotalDataChartBreakdown =
				args.excludeTotalDataChartBreakdown ?? true;
			const dataType = args.dataType ?? "dailyFees";

			const params = new URLSearchParams({
				excludeTotalDataChart: String(excludeTotalDataChart),
				excludeTotalDataChartBreakdown: String(excludeTotalDataChartBreakdown),
				dataType,
			});

			const url = `${this.BASE_URL}/summary/fees/${args.protocol}?${params.toString()}`;
			return await this.fetchData<FeesSummaryResponse>(
				url,
				config.feesTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch fees and revenue data for ${args.protocol}`,
				error,
			);
		}
	}

	/**
	 * Get fees overview, optionally scoped to a chain (/overview/fees[/{chain}])
	 */
	async getFeesOverviewRaw(
		args: {
			chain?: string;
			dataType?: string;
			excludeTotalDataChart?: boolean;
			excludeTotalDataChartBreakdown?: boolean;
		},
		options?: RequestOptions,
	): Promise<FeesOverviewResponse> {
		try {
			const excludeTotalDataChart = args.excludeTotalDataChart ?? true;
			const excludeTotalDataChartBreakdown =
				args.excludeTotalDataChartBreakdown ?? true;
			const dataType = args.dataType ?? "dailyFees";

			const params = new URLSearchParams({
				excludeTotalDataChart: String(excludeTotalDataChart),
				excludeTotalDataChartBreakdown: String(excludeTotalDataChartBreakdown),
				dataType,
			});

			const url = args.chain
				? `${this.BASE_URL}/overview/fees/${args.chain}?${params.toString()}`
				: `${this.BASE_URL}/overview/fees?${params.toString()}`;
			return await this.fetchData<FeesOverviewResponse>(
				url,
				config.feesTtl,
				options,
			);
		} catch (error) {
			const target = args.chain ? `chain ${args.chain}` : "global overview";
			throw logAndWrapError(
				`Failed to fetch fees and revenue data for ${target}`,
				error,
			);
		}
	}
}
