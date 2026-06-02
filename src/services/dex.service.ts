import { config } from "../config.js";
import {
	createChildLogger,
	createLogAndWrapError,
} from "../lib/utils/index.js";
import type { DexOverviewResponse, DexSummaryResponse } from "../types.js";
import { BaseService, type RequestOptions } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP DEX Service");

const logAndWrapError = createLogAndWrapError(logger);

/**
 * DEX Service
 * Handles decentralized exchange volume data
 */
export class DexService extends BaseService {
	/**
	 * Get DEX summary for a single protocol (/summary/dexs/{protocol})
	 */
	async getDexSummaryRaw(
		args: {
			protocol: string;
			excludeTotalDataChart?: boolean;
			excludeTotalDataChartBreakdown?: boolean;
		},
		options?: RequestOptions,
	): Promise<DexSummaryResponse> {
		try {
			const excludeTotalDataChart = args.excludeTotalDataChart ?? true;
			const excludeTotalDataChartBreakdown =
				args.excludeTotalDataChartBreakdown ?? true;

			const params = new URLSearchParams({
				excludeTotalDataChart: String(excludeTotalDataChart),
				excludeTotalDataChartBreakdown: String(excludeTotalDataChartBreakdown),
			});

			const url = `${this.BASE_URL}/summary/dexs/${args.protocol}?${params.toString()}`;
			return await this.fetchData<DexSummaryResponse>(
				url,
				config.dexTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch DEX data for ${args.protocol}`,
				error,
			);
		}
	}

	/**
	 * Get DEX overview, optionally scoped to a chain (/overview/dexs[/{chain}])
	 */
	async getDexsOverviewRaw(
		args: {
			chain?: string;
			excludeTotalDataChart?: boolean;
			excludeTotalDataChartBreakdown?: boolean;
		},
		options?: RequestOptions,
	): Promise<DexOverviewResponse> {
		try {
			const excludeTotalDataChart = args.excludeTotalDataChart ?? true;
			const excludeTotalDataChartBreakdown =
				args.excludeTotalDataChartBreakdown ?? true;

			const params = new URLSearchParams({
				excludeTotalDataChart: String(excludeTotalDataChart),
				excludeTotalDataChartBreakdown: String(excludeTotalDataChartBreakdown),
			});

			const url = args.chain
				? `${this.BASE_URL}/overview/dexs/${args.chain}?${params.toString()}`
				: `${this.BASE_URL}/overview/dexs?${params.toString()}`;
			return await this.fetchData<DexOverviewResponse>(
				url,
				config.dexTtl,
				options,
			);
		} catch (error) {
			const target = args.chain ? `chain ${args.chain}` : "global overview";
			throw logAndWrapError(`Failed to fetch DEX data for ${target}`, error);
		}
	}
}
