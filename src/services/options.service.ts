import { config } from "../config.js";
import {
	createChildLogger,
	createLogAndWrapError,
} from "../lib/utils/index.js";
import type {
	OptionsOverviewResponse,
	OptionsSummaryResponse,
} from "../types.js";
import { BaseService, type RequestOptions } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP Options Service");

const logAndWrapError = createLogAndWrapError(logger);

/**
 * Options Service
 * Handles options protocol data
 */
export class OptionsService extends BaseService {
	/**
	 * Get options summary for a single protocol (/summary/options/{protocol})
	 */
	async getOptionsSummaryRaw(
		args: { protocol: string; dataType?: string },
		options?: RequestOptions,
	): Promise<OptionsSummaryResponse> {
		try {
			const dataType = args.dataType ?? "dailyNotionalVolume";

			const params = new URLSearchParams({ dataType });

			const url = `${this.BASE_URL}/summary/options/${args.protocol}?${params.toString()}`;
			return await this.fetchData<OptionsSummaryResponse>(
				url,
				config.optionsTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch options data for ${args.protocol}`,
				error,
			);
		}
	}

	/**
	 * Get options overview, optionally scoped to a chain (/overview/options[/{chain}])
	 */
	async getOptionsOverviewRaw(
		args: {
			chain?: string;
			dataType?: string;
			excludeTotalDataChart?: boolean;
			excludeTotalDataChartBreakdown?: boolean;
		},
		options?: RequestOptions,
	): Promise<OptionsOverviewResponse> {
		try {
			const excludeTotalDataChart = args.excludeTotalDataChart ?? true;
			const excludeTotalDataChartBreakdown =
				args.excludeTotalDataChartBreakdown ?? true;
			const dataType = args.dataType ?? "dailyNotionalVolume";

			const params = new URLSearchParams({
				excludeTotalDataChart: String(excludeTotalDataChart),
				excludeTotalDataChartBreakdown: String(excludeTotalDataChartBreakdown),
				dataType,
			});

			const url = args.chain
				? `${this.BASE_URL}/overview/options/${args.chain}?${params.toString()}`
				: `${this.BASE_URL}/overview/options?${params.toString()}`;
			return await this.fetchData<OptionsOverviewResponse>(
				url,
				config.optionsTtl,
				options,
			);
		} catch (error) {
			const target = args.chain ? `chain ${args.chain}` : "global overview";
			throw logAndWrapError(
				`Failed to fetch options data for ${target}`,
				error,
			);
		}
	}
}
