# DefiLlama MCP Server

[![npm version](https://img.shields.io/npm/v/@iqai/defillama-mcp.svg)](https://www.npmjs.com/package/@iqai/defillama-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Overview

The DefiLlama MCP Server enables AI agents to interact with [DefiLlama](https://defillama.com), a comprehensive DeFi data aggregator. This server provides access to TVL metrics, DEX volumes, protocol statistics, stablecoin data, token prices, yield farming pools, and more.

By implementing the Model Context Protocol (MCP), this server allows Large Language Models (LLMs) to discover DeFi protocols, analyze market data, and track blockchain metrics directly through their context window, bridging the gap between AI and decentralized finance analytics.

## Features

*   **Protocol & TVL Data**: Access blockchain chains ranked by TVL, protocol TVL data, and historical chain TVL.
*   **DEX Data**: Fetch DEX trading volume data and metrics.
*   **Fees & Revenue**: Retrieve fees and revenue metrics for DeFi protocols.
*   **Stablecoin Analytics**: Access stablecoin data including circulation, price information, and historical charts.
*   **Token Prices**: Fetch current and historical token prices, percentage changes, and price charts.
*   **Yield Farming**: Get current and historical yield farming pool data including APY rates and TVL.
*   **Options Data**: Access options protocol data including trading volume and premium metrics.
*   **Auto-Resolution**: AI-powered entity resolution for protocols, chains, and stablecoins.

## Installation

### Using pnpm dlx (Recommended)

To use this server without installing it globally:

```bash
pnpm dlx @iqai/defillama-mcp
```

### Build from Source

```bash
git clone https://github.com/IQAIcom/defillama-mcp.git
cd defillama-mcp
pnpm install
pnpm run build
```

## Running with an MCP Client

Add the following configuration to your MCP client settings (e.g., `claude_desktop_config.json`).

### Minimal Configuration

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
        "IQ_GATEWAY_KEY": "your_iq_gateway_key",
        "OPENROUTER_API_KEY": "your_openrouter_api_key_if_needed",
        "LLM_MODEL": "openai/gpt-4.1-mini"
      }
    }
  }
}
```

## Configuration (Environment Variables)

| Variable | Required | Description | Default |
| :--- | :--- | :--- | :--- |
| `DEFILLAMA_API_KEY` | No | Your DefiLlama API key | - |
| `IQ_GATEWAY_URL` | No | Custom IQ Gateway URL for enhanced resolution | - |
| `IQ_GATEWAY_KEY` | No | API key for IQ Gateway access | - |
| `OPENROUTER_API_KEY` | No | API key for OpenRouter LLM integration | - |
| `LLM_MODEL` | No | LLM model to use for entity resolution | `openai/gpt-4.1-mini` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | Google Generative AI API key | - |

## Usage Examples

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

## MCP Tools

<!-- AUTO-GENERATED TOOLS START -->

### Protocol & TVL Data
* **`defillama_get_chains`**: Fetch blockchain chains ranked by Total Value Locked (TVL).
* **`defillama_get_protocol_data`**: Fetch TVL data for DeFi protocols with auto-resolution of protocol names.
* **`defillama_get_historical_chain_tvl`**: Fetch historical TVL data for blockchain chains over time.

### DEX Data
* **`defillama_get_dexs_data`**: Fetch DEX trading volume data and metrics.

### Fees & Revenue
* **`defillama_get_fees_and_revenue`**: Fetch fees and revenue metrics for DeFi protocols.

### Stablecoins
* **`defillama_get_stablecoin`**: Fetch stablecoin data including circulation and price information.
* **`defillama_get_stablecoin_chains`**: Fetch stablecoin data by chains.
* **`defillama_get_stablecoin_charts`**: Fetch historical market cap charts for stablecoins.
* **`defillama_get_stablecoin_prices`**: Fetch historical stablecoin price data.

### Token Prices
* **`defillama_get_prices_current_coins`**: Fetch current token prices.
* **`defillama_get_prices_first_coins`**: Fetch first recorded historical prices for tokens.
* **`defillama_get_batch_historical`**: Fetch historical price data for multiple cryptocurrencies at specific timestamps.
* **`defillama_get_historical_prices_by_contract`**: Fetch historical prices for tokens at specific timestamps.
* **`defillama_get_percentage_coins`**: Fetch percentage price change for tokens over time.
* **`defillama_get_chart_coins`**: Fetch historical price chart data for tokens.

### Yield Farming
* **`defillama_get_latest_pool_data`**: Fetch current yield farming pool data including APY rates and TVL.
* **`defillama_get_historical_pool_data`**: Fetch historical APY and TVL data for a specific pool.

### Options
* **`defillama_get_options_data`**: Fetch options protocol data including trading volume and premium metrics.

### Blockchain
* **`defillama_get_blockchain_timestamp`**: Fetch blockchain block information at a specific timestamp.

<!-- AUTO-GENERATED TOOLS END -->

## Development

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

## Resources

*   [DefiLlama API Documentation](https://defillama.com/docs/api)
*   [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
*   [DefiLlama Platform](https://defillama.com)

## Disclaimer

This project is an unofficial tool and is not directly affiliated with DefiLlama. It interacts with DeFi protocol data. Users should exercise caution and verify all data independently. DeFi involves risk.

## License

[MIT](LICENSE)
