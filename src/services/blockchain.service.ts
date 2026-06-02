import { config } from "../config.js";
import {
	createChildLogger,
	createLogAndWrapError,
} from "../lib/utils/index.js";
import type { BlockResponse } from "../types.js";
import { BaseService, type RequestOptions } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP Blockchain Service");

const logAndWrapError = createLogAndWrapError(logger);

/**
 * Blockchain Service
 * Handles blockchain block and timestamp data
 */
export class BlockchainService extends BaseService {
	/**
	 * Get the block at a given timestamp (/block/{chain}/{timestamp})
	 */
	async getBlockAtTimestampRaw(
		args: { chain: string; timestamp: string | number },
		options?: RequestOptions,
	): Promise<BlockResponse> {
		try {
			const unixTime = this.toUnixSeconds(args.timestamp);
			const url = `${this.COINS_URL}/block/${args.chain}/${unixTime}`;

			return await this.fetchData<BlockResponse>(
				url,
				config.blockchainTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch block data for chain ${args.chain} at timestamp ${args.timestamp}`,
				error,
			);
		}
	}
}
