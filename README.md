# DefiLlama MCP: Model Context Protocol Server for DefiLlama

This project implements a Model Context Protocol (MCP) server to interact with the DefiLlama API. It allows MCP-compatible clients (like AI assistants, IDE extensions, or custom applications) to access DeFi data including TVL metrics, DEX volumes, protocol statistics, stablecoin data, token prices, yield farming pools, and more.

This server is built using TypeScript and `fastmcp`.

## Features (MCP Tools)

The server exposes the following tools that MCP clients can utilize:

### Protocol & TVL Data
* **`defillama_get_chains`**: Fetch blockchain chains ranked by Total Value Locked (TVL).
  * Parameters: `order` (asc/desc)
* **`defillama_get_protocol_data`**: Fetch TVL data for DeFi protocols with auto-resolution of protocol names.
  * Parameters: `protocol` (string, optional), `sortCondition`, `order`
* **`defillama_get_historical_chain_tvl`**: Fetch historical TVL data for blockchain chains over time.
  * Parameters: `chain` (string, optional)

### DEX Data
* **`defillama_get_dexs_data`**: Fetch DEX trading volume data and metrics.
  * Parameters: `protocol` (optional), `chain` (optional), `sortCondition`, `order`, `excludeTotalDataChart`, `excludeTotalDataChartBreakdown`

### Fees & Revenue
* **`defillama_get_fees_and_revenue`**: Fetch fees and revenue metrics for DeFi protocols.
  * Parameters: `dataType`, `chain` (optional), `protocol` (optional), `sortCondition`, `order`, `excludeTotalDataChart`, `excludeTotalDataChartBreakdown`

### Stablecoins
* **`defillama_get_stablecoin`**: Fetch stablecoin data including circulation and price information.
  * Parameters: `includePrices` (boolean, optional)
* **`defillama_get_stablecoin_chains`**: Fetch stablecoin data by chains.
* **`defillama_get_stablecoin_charts`**: Fetch historical market cap charts for stablecoins.
  * Parameters: `stablecoin` (number/string, optional), `chain` (string, optional)
* **`defillama_get_stablecoin_prices`**: Fetch historical stablecoin price data.

### Token Prices
* **`defillama_get_prices_current_coins`**: Fetch current token prices.
  * Parameters: `coins` (string), `searchWidth` (string/number)
* **`defillama_get_prices_first_coins`**: Fetch first recorded historical prices for tokens.
  * Parameters: `coins` (string)
* **`defillama_get_batch_historical`**: Fetch historical price data for multiple cryptocurrencies at specific timestamps.
  * Parameters: `coins` (string/object), `searchWidth` (optional)
* **`defillama_get_historical_prices_by_contract`**: Fetch historical prices for tokens at specific timestamps.
  * Parameters: `coins` (string), `timestamp` (number/string), `searchWidth` (optional)
* **`defillama_get_percentage_coins`**: Fetch percentage price change for tokens over time.
  * Parameters: `coins` (string), `timestamp` (optional), `period` (string), `lookForward` (boolean)
* **`defillama_get_chart_coins`**: Fetch historical price chart data for tokens.
  * Parameters: `coins` (string), `start` (optional), `end` (optional), `span` (optional), `period` (optional), `searchWidth` (optional)

### Yield Farming
* **`defillama_get_latest_pool_data`**: Fetch current yield farming pool data including APY rates and TVL.
  * Parameters: `sortCondition`, `order`, `limit`
* **`defillama_get_historical_pool_data`**: Fetch historical APY and TVL data for a specific pool.
  * Parameters: `pool` (string)

### Options
* **`defillama_get_options_data`**: Fetch options protocol data including trading volume and premium metrics.
  * Parameters: `dataType`, `protocol` (optional), `chain` (optional), `sortCondition`, `order`, `excludeTotalDataChart`, `excludeTotalDataChartBreakdown`

### Blockchain
* **`defillama_get_blockchain_timestamp`**: Fetch blockchain block information at a specific timestamp.
  * Parameters: `chain` (string), `timestamp` (number/string)

## Prerequisites

* Node.js (v18 or newer recommended)
* pnpm (See <https://pnpm.io/installation>)

## Installation

There are a few ways to use `defillama-mcp`:

**1. Using `pnpm dlx` (Recommended for most MCP client setups):**

   You can run the server directly using `pnpm dlx` without needing a global installation. This is often the easiest way to integrate with MCP clients. See the "Running the Server with an MCP Client" section for examples.
   (`pnpm dlx` is pnpm's equivalent of `npx`)

**2. Global Installation from npm (via pnpm):**

   Install the package globally to make the `defillama-mcp` command available system-wide:

   ```bash
   pnpm add -g @iqai/defillama-mcp
   ```

**3. Building from Source (for development or custom modifications):**

   1. **Clone the repository:**

      ```bash
      git clone https://github.com/IQAIcom/defillama-mcp.git
      cd defillama-mcp
      ```

   2. **Install dependencies:**

      ```bash
      pnpm install
      ```

   3. **Build the server:**
      This compiles the TypeScript code to JavaScript in the `dist` directory.

      ```bash
      pnpm run build
      ```

      The `prepare` script also runs `pnpm run build`, so dependencies are built upon installation if you clone and run `pnpm install`.

## Configuration (Environment Variables)

This MCP server can be configured with environment variables set by the MCP client that runs it. These are typically configured in the client's MCP server definition (e.g., in a `mcp.json` file for Cursor, or similar for other clients).

**All environment variables are optional**, but you may want to configure one of the following for API access:

### DefiLlama API Configuration (Choose One)

1. **Direct DefiLlama API Access** (Recommended for most users):
   * **`DEFILLAMA_API_KEY`**: Your DefiLlama API key (get one at [https://defillama.com](https://defillama.com))
   * If not provided, the server will make unauthenticated requests to DefiLlama (subject to rate limits)

2. **IQ Gateway** (For advanced caching and monitoring):
   * **`IQ_GATEWAY_URL`**: Custom IQ Gateway URL for enhanced resolution capabilities
   * **`IQ_GATEWAY_KEY`**: API key for IQ Gateway access
   * This option is primarily for IQAI internal use but available for users with their own gateway infrastructure

### Enhanced Features (Optional)

* **`OPENROUTER_API_KEY`**: API key for OpenRouter LLM integration for enhanced entity resolution
* **`LLM_MODEL`**: LLM model to use for entity resolution (default: `openai/gpt-4.1-mini`)
* **`GOOGLE_GENERATIVE_AI_API_KEY`**: Google Generative AI API key for alternative LLM integration

## Running the Server with an MCP Client

MCP clients (like AI assistants, IDE extensions, etc.) will run this server as a background process. You need to configure the client to tell it how to start your server.

Below are example configuration snippets that an MCP client might use (e.g., in a `mcp_servers.json` or similar configuration file). These examples show how to run the server using the published npm package via `pnpm dlx`.

**Basic Configuration (Recommended for most users):**

```json
{
  "mcpServers": {
    "defillama-mcp-server": {
      "command": "pnpm",
      "args": [
        "dlx",
        "@iqai/defillama-mcp"
      ],
      "env": {
        "DEFILLAMA_API_KEY": "your_defillama_api_key_here"
      }
    }
  }
}
```

**Minimal Configuration (No API key - uses unauthenticated requests):**

```json
{
  "mcpServers": {
    "defillama-mcp-server": {
      "command": "pnpm",
      "args": [
        "dlx",
        "@iqai/defillama-mcp"
      ],
      "env": {}
    }
  }
}
```

**Advanced Configuration (With IQ Gateway):**

```json
{
  "mcpServers": {
    "defillama-mcp-server": {
      "command": "pnpm",
      "args": [
        "dlx",
        "@iqai/defillama-mcp"
      ],
      "env": {
        "IQ_GATEWAY_URL": "your_iq_gateway_url",
        "IQ_GATEWAY_KEY": "your_iq_gateway_key",
        "OPENROUTER_API_KEY": "your_openrouter_api_key_if_needed",
        "LLM_MODEL": "openai/gpt-4.1-mini",
        "GOOGLE_GENERATIVE_AI_API_KEY": "your_google_api_key_if_needed"
      }
    }
  }
}
```

**Alternative if Globally Installed:**

If you have installed `defillama-mcp` globally (`pnpm add -g @iqai/defillama-mcp`), you can simplify the `command` and `args`:

```json
{
  "mcpServers": {
    "defillama-mcp-server": {
      "command": "defillama-mcp",
      "args": [],
      "env": {
        "DEFILLAMA_API_KEY": "your_defillama_api_key_here"
      }
    }
  }
}
```

* **`command`**: The executable to run.
  * For `pnpm dlx`: `"pnpm"` (with `"dlx"` as the first arg)
  * For global install: `"defillama-mcp"`
* **`args`**: An array of arguments to pass to the command.
  * For `pnpm dlx`: `["dlx", "@iqai/defillama-mcp"]`
  * For global install: `[]`
* **`env`**: An object containing environment variables to be set when the server process starts. All environment variables are optional.

## Development

- `pnpm run watch` – compile on change
- `pnpm run format` – format with Biome
- `pnpm run lint` – lint with Biome

## Features

### Auto-Resolution
Many tools support automatic resolution of human-friendly names to API-compatible identifiers:
- **Protocols**: Pass names like 'Uniswap', 'Aave', 'Lido' directly
- **Chains**: Use names like 'Ethereum', 'BSC', 'Polygon', 'Arbitrum'
- **Stablecoins**: Use names like 'USDC', 'Tether', 'DAI'

The server uses AI-powered entity resolution to match common variations and names to correct API identifiers.
