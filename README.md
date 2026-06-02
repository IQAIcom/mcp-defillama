# 📊 DefiLlama MCP Server

[![npm version](https://img.shields.io/npm/v/@iqai/defillama-mcp.svg)](https://www.npmjs.com/package/@iqai/defillama-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 📖 Overview

The DefiLlama MCP Server enables AI agents to interact with [DefiLlama](https://defillama.com), a comprehensive DeFi data aggregator. This server provides access to TVL metrics, DEX volumes, protocol statistics, stablecoin data, token prices, yield farming pools, and more.

By implementing the Model Context Protocol (MCP), this server allows Large Language Models (LLMs) to discover DeFi protocols, analyze market data, and track blockchain metrics directly through their context window, bridging the gap between AI and decentralized finance analytics.

## ✨ Features

*   **Protocol & TVL Data**: Access blockchain chains ranked by TVL, protocol TVL data, and historical chain TVL.
*   **DEX Data**: Fetch DEX trading volume data and metrics.
*   **Fees & Revenue**: Retrieve fees and revenue metrics for DeFi protocols.
*   **Stablecoin Analytics**: Access stablecoin data including circulation, price information, and historical charts.
*   **Token Prices**: Fetch current and historical token prices, percentage changes, and price charts.
*   **Yield Farming**: Get current and historical yield farming pool data including APY rates and TVL.
*   **Options Data**: Access options protocol data including trading volume and premium metrics.
*   **Auto-Resolution**: AI-powered entity resolution for protocols, chains, and stablecoins.

## 📦 Installation

### 🚀 Using pnpm dlx (Recommended)

To use this server without installing it globally:

```bash
pnpm dlx @iqai/defillama-mcp
```

### 🔧 Build from Source

```bash
git clone https://github.com/IQAIcom/defillama-mcp.git
cd defillama-mcp
pnpm install
pnpm run build
```

## ⚡ Running with an MCP Client

Add the following configuration to your MCP client settings (e.g., `claude_desktop_config.json`).

### 📋 Minimal Configuration

```json
{
  "mcpServers": {
    "defillama": {
      "command": "pnpm",
      "args": ["dlx", "@iqai/defillama-mcp"],
      "env": {}
    }
  }
}
```

### Basic Configuration (With API Key)

```json
{
  "mcpServers": {
    "defillama": {
      "command": "pnpm",
      "args": ["dlx", "@iqai/defillama-mcp"],
      "env": {
        "DEFILLAMA_API_KEY": "your_defillama_api_key_here"
      }
    }
  }
}
```

### Advanced Configuration (With IQ Gateway)

```json
{
  "mcpServers": {
    "defillama": {
      "command": "pnpm",
      "args": ["dlx", "@iqai/defillama-mcp"],
      "env": {
        "IQ_GATEWAY_URL": "your_iq_gateway_url",
        "IQ_GATEWAY_KEY": "your_iq_gateway_key"
      }
    }
  }
}
```

## 🔐 Configuration (Environment Variables)

| Variable | Required | Description | Default |
| :--- | :--- | :--- | :--- |
| `DEFILLAMA_API_KEY` | No | Your DefiLlama API key | - |
| `IQ_GATEWAY_URL` | No | Custom IQ Gateway URL for caching/proxying upstream requests | - |
| `IQ_GATEWAY_KEY` | No | API key for IQ Gateway access | - |

## 💡 Usage Examples

### Protocol & TVL Data
*   "What are the top 10 DeFi protocols by TVL?"
*   "Show me the historical TVL for Ethereum."
*   "Get TVL data for Uniswap."

### DEX Data
*   "What are the top DEXs by trading volume?"
*   "Show me DEX volume data for Arbitrum."

### Stablecoin Analytics
*   "What is the current market cap of USDC?"
*   "Show me stablecoin distribution across chains."
*   "Get historical price data for Tether."

### Token Prices
*   "What is the current price of ETH?"
*   "Show me the 24h price change for BTC."
*   "Get historical prices for multiple tokens."

### Yield Farming
*   "What are the highest APY yield farming pools?"
*   "Show me pool data for Aave on Ethereum."

## 🛠️ MCP Tools

<!-- AUTO-GENERATED TOOLS START -->

### `defillama_get_batch_historical`
Fetches historical price data for multiple cryptocurrencies at specific timestamps. Useful for getting prices of multiple coins at the same or different points in time

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `coins` | union | Yes |  | Coin identifiers with timestamps. Use object format: { 'chain:address': [timestamp1, timestamp2, ...] }. Examples: { 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7': [1648680149] } for USDT on Ethereum, or { 'coingecko:bitcoin': [1648680149, 1648766549] } for Bitcoin at multiple times. Chain names should match format from defillama_get_chains (e.g., 'ethereum', 'bsc', 'polygon'). For well-known coins, use 'coingecko:' prefix with coin ID. Timestamps are Unix timestamps in seconds. If you're unsure about the correct chain:address format for a token, you may need to search for the token's contract address first |
| `searchWidth` | union | No | "6h" | Time range around each timestamp to search for price data. Accepts duration strings (e.g., '4h', '1d', '30m') or seconds as a number (e.g., 600 for 10 minutes). Defaults to '6h' (6 hours). Wider ranges increase chances of finding data but may be less precise |

### `defillama_get_blockchain_timestamp`
Fetches blockchain block information for a specific chain at a given timestamp. Returns the block number, timestamp, and height that existed at that point in time. This is essential for historical DeFi queries - many blockchain APIs require a specific block number to retrieve historical state (e.g., 'What was the TVL on date X?' requires knowing which block number corresponded to date X). Use this tool to convert human-readable dates into block numbers. **AUTO-RESOLUTION ENABLED:** Chain names are automatically matched.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chain` | string | Yes | Blockchain name - auto-resolved (e.g., 'Ethereum', 'Polygon', 'Arbitrum', 'Avalanche', 'BSC'). Common variations are handled automatically |
| `timestamp` | union | Yes | Time to query block data for. Accepts both Unix timestamp in seconds (e.g., 1640000000) or ISO 8601 date string (e.g., '2024-01-15T10:30:00Z', '2024-01-15'). Relative dates work too - the converter will handle them. Will be automatically converted to Unix timestamp for the API call |

### `defillama_get_chains`
Fetches blockchain chains ranked by Total Value Locked (TVL), returning the top 20. Use this tool to: (1) answer user queries about leading DeFi blockchains, or (2) discover valid chain name formats before calling other tools. The returned chain names (e.g., 'Ethereum', 'Arbitrum', 'Polygon') can be used directly in the 'chain' parameter of defillama_get_dexs_data, defillama_get_fees_and_revenue, and defillama_get_historical_chain_tvl

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `order` | string | No | "desc" | Sort order by TVL. Use 'desc' (default) for highest TVL first (e.g., Ethereum, BSC, Tron), or 'asc' for lowest TVL first |

### `defillama_get_chart_coins`
Fetches historical price chart data for one or more cryptocurrency tokens across different blockchains. Returns time-series price data with customizable time range and data point frequency

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `coins` | string | Yes |  | Comma-separated list of tokens in the format '{chain}:{contractAddress}'. Each token must be specified with its blockchain and contract address. Examples: 'ethereum:0xdF574c24545E5FfEcb9a659c229253D4111d87e1' (single token), 'ethereum:0xdF574c24545E5FfEcb9a659c229253D4111d87e1,bsc:0x762539b45a1dcce3d36d080f74d1aed37844b878' (multiple tokens). You can also use CoinGecko IDs like 'coingecko:ethereum'. If you don't know the contract address for a token, search for it first using other available tools or use the CoinGecko ID format |
| `start` | union | No |  | Unix timestamp (in seconds) for the earliest data point. If omitted, defaults to earliest available data. Example: 1640995200 (Jan 1, 2022) |
| `end` | union | No |  | Unix timestamp (in seconds) for the latest data point. If omitted, defaults to current time. Example: 1672531200 (Jan 1, 2023) |
| `span` | number | No |  | Number of data points to return in the chart. Higher values provide more granular data. If omitted, returns all available points within the time range. Example: 10 returns 10 evenly-spaced data points |
| `period` | string | No |  | Time interval between data points. Determines chart granularity. Format: number + unit (h for hours, d for days). Examples: '1h' (hourly data), '8h' (every 8 hours), '1d' (daily data), '7d' (weekly data). If omitted, defaults to 24 hours (daily) |
| `searchWidth` | union | No | "6h" | Time window for finding price data around each period point. Can be specified as seconds (number) or duration string. Wider search windows are more forgiving but may be less precise. Examples: '600' (10 minutes), '6h' (6 hours). Defaults to 6 hours |

### `defillama_get_dexs_data`
Fetches DEX (decentralized exchange) trading volume data and metrics. Returns different levels of data based on parameters: specific protocol data (most detailed), chain-specific overview, or global overview (all DEXs). **AUTO-RESOLUTION ENABLED:** Protocol and chain names are automatically matched.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `excludeTotalDataChart` | boolean | No | true | Whether to exclude total data chart from response |
| `excludeTotalDataChartBreakdown` | boolean | No | true | Whether to exclude chart breakdown from response |
| `protocol` | string | No |  | DEX protocol name - auto-resolved (e.g., 'Uniswap', 'PancakeSwap', 'Curve'). When provided, returns detailed data for that protocol only. Takes priority over chain parameter |
| `chain` | string | No |  | Blockchain name - auto-resolved (e.g., 'Ethereum', 'BSC', 'Polygon', 'Arbitrum'). Returns overview of all DEXs operating on that chain. Only used when protocol is not specified. If both protocol and chain are omitted, returns global overview of all DEXs |
| `sortCondition` | string | No | "total24h" | Field to sort results by |
| `order` | string | No | "desc" | Sort order (ascending or descending) |

### `defillama_get_fees_and_revenue`
Fetches fees and revenue metrics for DeFi protocols. Can filter by specific protocol and/or chain. **AUTO-RESOLUTION ENABLED:** Protocol and chain names are automatically matched.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `excludeTotalDataChart` | boolean | No | true | Whether to exclude total data chart |
| `excludeTotalDataChartBreakdown` | boolean | No | true | Whether to exclude chart breakdown |
| `dataType` | string | No | "dailyFees" | Type of metric to retrieve |
| `chain` | string | No |  | Chain name - auto-resolved (e.g., 'Ethereum', 'Polygon', 'BSC'). If omitted, includes all chains |
| `protocol` | string | No |  | Protocol name - auto-resolved (e.g., 'Uniswap', 'Aave'). If omitted, includes all protocols |
| `sortCondition` | string | No | "total24h" | Field to sort results by |
| `order` | string | No | "desc" | Sort order |

### `defillama_get_historical_chain_tvl`
Fetches historical TVL (Total Value Locked) data for blockchain chains over time. Returns the last 10 data points showing TVL evolution. Can return data for a specific chain or aggregated data across all chains. **AUTO-RESOLUTION ENABLED:** Chain names are automatically matched (e.g., 'Ethereum', 'BSC', 'Polygon', 'Avalanche').

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chain` | string | No | Blockchain name - auto-resolved (e.g., 'Ethereum', 'Arbitrum', 'Polygon', 'BSC', 'Avalanche'). Common variations are handled automatically. If omitted, returns aggregated historical TVL across all chains combined |

### `defillama_get_historical_pool_data`
Fetches historical APY and TVL data for a specific yield farming pool over time. Returns the last 10 data points showing how the pool's metrics have changed

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pool` | string | Yes | Unique pool identifier (UUID format). **IMPORTANT: Always call defillama_get_latest_pool_data first** to discover available pools and their IDs. The pool ID is returned in the 'pool' property of each result (e.g., '742c4e8f-1f3d-4c3e-9c1e-2a3b4c5d6e7f') |

### `defillama_get_historical_prices_by_contract`
Fetches historical prices for tokens at a specific point in time using their contract addresses. Useful for getting price data at exact timestamps for analysis or backtesting

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `coins` | string | Yes |  | Comma-separated list of tokens in format '{chain}:{contractAddress}'. Each token must specify its blockchain and contract address. Examples: 'ethereum:0xdF574c24545E5FfEcb9a659c229253D4111d87e1' (single token) or 'ethereum:0xdF574c24545E5FfEcb9a659c229253D4111d87e1,bsc:0x762539b45a1dcce3d36d080f74d1aed37844b878' (multiple tokens). **IMPORTANT: If user mentions a chain name, call defillama_get_chains first to get the correct chain identifier. For contract addresses, ensure you have the exact address for the token on that specific chain** |
| `timestamp` | union | Yes |  | Point in time to query prices for. Accepts Unix timestamp (seconds) or ISO 8601 format (e.g., '2024-01-15T12:00:00Z'). Example: 1705320000 or '2024-01-15T12:00:00Z' |
| `searchWidth` | union | No | "6h" | Time window to search for price data around the timestamp if exact data unavailable. Accepts duration string (e.g., '4h', '1d') or seconds (e.g., 600). Defaults to 6 hours. Larger windows increase chances of finding data but may be less accurate |

### `defillama_get_latest_pool_data`
Fetches current yield farming pool data including APY rates, TVL, and rewards. Returns a list of pools that can be filtered and sorted by various metrics

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sortCondition` | string | No | "tvlUsd" | Field to sort results by (e.g., tvlUsd for total value locked, apy for annual percentage yield) |
| `order` | string | No | "desc" | Sort order (ascending or descending) |
| `limit` | number | No | 10 | Number of pools to return (between 1-100) |

### `defillama_get_options_data`
Fetches options protocol data including trading volume and premium metrics. Returns different levels of data: specific protocol data (most detailed), chain-specific overview, or global overview (all options protocols). **AUTO-RESOLUTION ENABLED:** Protocol and chain names are automatically matched.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dataType` | string | No | "dailyNotionalVolume" | Type of volume data to retrieve: premium volume (actual premiums paid) or notional volume (value of underlying assets) |
| `protocol` | string | No |  | Options protocol name - auto-resolved (e.g., 'Lyra', 'Hegic', 'Aevo'). When provided, returns detailed data for that protocol only. Takes priority over chain parameter |
| `chain` | string | No |  | Blockchain name - auto-resolved (e.g., 'Ethereum', 'Arbitrum', 'Optimism'). Returns overview of all options protocols operating on that chain. Only used when protocol is not specified. If both protocol and chain are omitted, returns global overview of all options protocols |
| `sortCondition` | string | No | "total24h" | Field to sort results by |
| `order` | string | No | "desc" | Sort order (ascending or descending) |
| `excludeTotalDataChart` | boolean | No | true | Whether to exclude aggregated chart data from response |
| `excludeTotalDataChartBreakdown` | boolean | No | true | Whether to exclude broken down chart data from response |

### `defillama_get_percentage_coins`
Fetches percentage price change for tokens over a specified time period. Calculates how much token prices changed from a starting point, either looking backward (default) or forward in time

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `coins` | string | Yes |  | Comma-separated list of tokens in format '{chain}:{contractAddress}'. Each token must specify its blockchain and contract address. Examples: 'ethereum:0xdF574c24545E5FfEcb9a659c229253D4111d87e1' (single token) or 'ethereum:0xdF574c24545E5FfEcb9a659c229253D4111d87e1,bsc:0x762539b45a1dcce3d36d080f74d1aed37844b878,ethereum:0xdB25f211AB05b1c97D595516F45794528a807ad8' (multiple tokens). **IMPORTANT: If user mentions a chain name, call defillama_get_chains first to get the correct chain identifier. For contract addresses, ensure you have the exact address for the token on that specific chain** |
| `timestamp` | union | No |  | Starting point in time for percentage calculation. Accepts Unix timestamp (seconds) or ISO 8601 format. If omitted, uses current time. Examples: 1705320000 or '2024-01-15T12:00:00Z' |
| `period` | string | No | "1d" | Time period over which to calculate percentage change. Format: number + unit (h=hours, d=days). Examples: '1h' (1 hour), '8h' (8 hours), '2d' (2 days), '7d' (7 days). Defaults to '1d' (24 hours) |
| `lookForward` | boolean | No | false | Direction to calculate change. If false (default), calculates change from [timestamp - period] to [timestamp] (looking backward). If true, calculates change from [timestamp] to [timestamp + period] (looking forward). Use true for historical predictions/projections |

### `defillama_get_prices_current_coins`
Fetches current token prices from DefiLlama. Requires token addresses in the format chain:address (e.g., 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7' for USDT). Can fetch multiple tokens at once by comma-separating them

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `coins` | string | Yes |  | Comma-separated list of tokens in the format {chain}:{contractAddress}. Examples: 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7' (single token), 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7,bsc:0x55d398326f99059ff775485246999027b3197955' (multiple tokens). If the user mentions a token but you don't know its contract address, you may need to search for it first or ask the user. If unsure about the exact chain name format, call defillama_get_chains to see available chains (e.g., 'ethereum', 'bsc', 'polygon', 'arbitrum') |
| `searchWidth` | union | No | "4h" | Time window to search for price data. Accepts duration strings (e.g., '4h', '1d', '30m') or seconds as a number (e.g., 600 for 10 minutes). Defaults to 4 hours. Use larger values if recent price data might not be available |

### `defillama_get_prices_first_coins`
Fetches the first recorded historical prices for specified cryptocurrency tokens. Useful for finding when a token was first listed/tracked or its initial price point

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `coins` | string | Yes | Comma-separated list of tokens in the format '{chain}:{tokenAddress}'. Each token must specify its blockchain and contract address. Examples: 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7' (USDT), 'bsc:0x55d398326f99059ff775485246999027b3197955' (USDT on BSC), or multiple tokens: 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7,ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'. Chain names must match exactly - if unsure about the correct chain name format, call defillama_get_chains first to discover valid chain names (e.g., 'ethereum' not 'Ethereum', 'bsc' not 'BSC'). Token addresses are checksummed contract addresses on the specified chain |

### `defillama_get_protocol_data`
Fetches TVL (Total Value Locked) data for DeFi protocols. **AUTO-RESOLUTION ENABLED:** Pass protocol names as users mention them (e.g., 'Lido', 'Uniswap', 'Aave', 'MakerDAO') - they're automatically resolved to correct slugs via AI. For multiple versions, specify the version (e.g., 'Aave V3') or the most common version is matched. If protocol parameter is omitted, returns top 10 protocols sorted by your chosen criteria.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `protocol` | string | No |  | Protocol name as mentioned by the user - auto-resolved via AI (e.g., 'Lido', 'Uniswap', 'Aave V3', 'Curve', 'MakerDAO'). Exact slugs also work. Flexible matching handles name variations. If omitted, returns top 10 protocols sorted by the specified condition. |
| `sortCondition` | string | No | "tvl" | Field to sort results by. Only used when protocol parameter is omitted. |
| `order` | string | No | "desc" | Sort order. Only used when protocol parameter is omitted. |

### `defillama_get_stablecoin`
Fetches stablecoin data including circulation and price information. Returns top 20 stablecoins

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includePrices` | boolean | No | Whether to include price data |

### `defillama_get_stablecoin_chains`
Fetches stablecoin data by chains. Returns last 3 chains with market cap data

_No parameters_

### `defillama_get_stablecoin_charts`
Fetches historical market cap charts for stablecoins over time. Returns the last 10 data points showing circulation, USD values, and bridged amounts. Can filter by blockchain or specific stablecoin, or show global aggregated data

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `stablecoin` | union | No | Stablecoin ID or name (e.g., 1 for USDT, 2 for USDC, or 'USDC', 'Tether', 'DAI'). **AUTO-RESOLUTION ENABLED:** You can now pass stablecoin names directly (like 'USDC', 'Tether', 'DAI') and they will be automatically resolved to their numeric IDs. Numeric IDs are also still accepted. Can be combined with chain parameter to show that stablecoin's data on a specific chain |
| `chain` | string | No | Blockchain name to filter stablecoin data by (e.g., 'Ethereum', 'Polygon', 'Arbitrum'). Returns stablecoin market cap data for that specific chain. **If the user mentions a blockchain but you're unsure of the exact name format, call defillama_get_chains first to discover valid chain names**. If omitted, returns global aggregated data across all chains |

### `defillama_get_stablecoin_prices`
Fetches historical stablecoin price data. Returns last 3 data points

_No parameters_

<!-- AUTO-GENERATED TOOLS END -->

## 👨‍💻 Development

### Build Project
```bash
pnpm run build
```

### Development Mode (Watch)
```bash
pnpm run watch
```

### Linting & Formatting
```bash
pnpm run lint
pnpm run format
```

### Release Management
```bash
pnpm changeset          # Create a release note
pnpm version-packages   # Apply pending changesets
pnpm release            # Build and publish
```

### Project Structure
*   `src/tools/`: Individual tool definitions
*   `src/services/`: API client and business logic
*   `src/lib/`: Shared utilities
*   `src/index.ts`: Server entry point

## 📚 Resources

*   [DefiLlama API Documentation](https://defillama.com/docs/api)
*   [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
*   [DefiLlama Platform](https://defillama.com)

## ⚠️ Disclaimer

This project is an unofficial tool and is not directly affiliated with DefiLlama. It interacts with DeFi protocol data. Users should exercise caution and verify all data independently. DeFi involves risk.

## 📄 License

[MIT](LICENSE)
