import { config } from "../config.js";
import {
	createChildLogger,
	createLogAndWrapError,
} from "../lib/utils/index.js";
import type { HistoricalPoolResponse, PoolsResponse } from "../types.js";
import { BaseService, type RequestOptions } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP Yield Service");

const logAndWrapError = createLogAndWrapError(logger);

/**
 * Yield Service
 * Handles yield farming pool data
 */
export class YieldService extends BaseService {
	/**
	 * Get the full list of latest yield pools (/pools)
	 */
	async getLatestPoolsRaw(
		_args?: Record<string, never>,
		options?: RequestOptions,
	): Promise<PoolsResponse> {
		try {
			return await this.fetchData<PoolsResponse>(
				`${this.YIELDS_URL}/pools`,
				config.yieldTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError("Failed to fetch latest yield pool data", error);
		}
	}

	/**
	 * Get historical pool data (/chart/{pool})
	 */
	async getHistoricalPoolDataRaw(
		args: { pool: string },
		options?: RequestOptions,
	): Promise<HistoricalPoolResponse> {
		try {
			return await this.fetchData<HistoricalPoolResponse>(
				`${this.YIELDS_URL}/chart/${args.pool}`,
				config.yieldTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch historical pool data for ${args.pool}`,
				error,
			);
		}
	}
}
