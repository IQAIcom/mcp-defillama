import { createChildLogger } from "../lib/utils/index.js";
import { BaseService } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP Blockchain Service");

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
 * Blockchain Service
 * Handles blockchain block and timestamp data
 */
export class BlockchainService extends BaseService {
	async getBlockChainTimestamp(args: {
		chain: string;
		timestamp: string | number;
	}): Promise<string> {
		try {
			const unixTime = this.toUnixSeconds(args.timestamp);
			const url = `${this.COINS_URL}/block/${args.chain}/${unixTime}`;

			const data = await this.fetchData(url);
			return await this.formatResponse(data, {
				title: `Block Data: ${args.chain} at ${new Date(unixTime * 1000).toISOString()}`,
				numberFields: ["height", "timestamp"],
			});
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch block data for chain ${args.chain} at timestamp ${args.timestamp}`,
				error,
			);
		}
	}
}
