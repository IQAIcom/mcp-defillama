import { config } from "../config.js";
import {
	createChildLogger,
	createLogAndWrapError,
} from "../lib/utils/index.js";
import type {
	ChainData,
	HistoricalChainTvlItem,
	ProtocolData,
} from "../types.js";
import { BaseService, type RequestOptions } from "./base.service.js";

const logger = createChildLogger("DefiLlama MCP Protocol Service");

const logAndWrapError = createLogAndWrapError(logger);

/**
 * Protocol & TVL Service
 * Handles protocol data, chain information, and historical TVL data
 */
export class ProtocolService extends BaseService {
	/**
	 * Get the full list of chains with TVL data (/v2/chains)
	 */
	async getChainsRaw(
		_args?: Record<string, never>,
		options?: RequestOptions,
	): Promise<ChainData[]> {
		try {
			return await this.fetchData<ChainData[]>(
				`${this.BASE_URL}/v2/chains`,
				config.protocolTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError("Failed to fetch chain rankings", error);
		}
	}

	/**
	 * Get the full list of protocols (/protocols)
	 */
	async getProtocolsRaw(
		_args?: Record<string, never>,
		options?: RequestOptions,
	): Promise<ProtocolData[]> {
		try {
			return await this.fetchData<ProtocolData[]>(
				`${this.BASE_URL}/protocols`,
				config.protocolTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError("Failed to fetch protocols", error);
		}
	}

	/**
	 * Get full data for a single protocol (/protocol/{protocol})
	 */
	async getProtocolRaw(
		args: { protocol: string },
		options?: RequestOptions,
	): Promise<ProtocolData> {
		try {
			return await this.fetchData<ProtocolData>(
				`${this.BASE_URL}/protocol/${args.protocol}`,
				config.protocolTtl,
				options,
			);
		} catch (error) {
			throw logAndWrapError(
				`Failed to fetch protocol data for ${args.protocol}`,
				error,
			);
		}
	}

	/**
	 * Get historical chain TVL data (/v2/historicalChainTvl[/{chain}])
	 */
	async getHistoricalChainTvlRaw(
		args: { chain?: string },
		options?: RequestOptions,
	): Promise<HistoricalChainTvlItem[]> {
		try {
			const url = args.chain
				? `${this.BASE_URL}/v2/historicalChainTvl/${args.chain}`
				: `${this.BASE_URL}/v2/historicalChainTvl`;

			return await this.fetchData<HistoricalChainTvlItem[]>(
				url,
				config.protocolTtl,
				options,
			);
		} catch (error) {
			const target = args.chain ?? "all chains";
			throw logAndWrapError(
				`Failed to fetch historical TVL for ${target}`,
				error,
			);
		}
	}
}
