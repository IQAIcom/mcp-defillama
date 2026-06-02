/**
 * DefiLlama MCP Configuration
 */

export const config = {
	protocolTtl: 60 * 60,
	dexTtl: 60 * 60,
	feesTtl: 60 * 60,
	optionsTtl: 60 * 60,
	stablecoinTtl: 60 * 60,
	priceTtl: 5 * 60,
	yieldTtl: 30 * 60,
	blockchainTtl: 60 * 60,
} as const;
