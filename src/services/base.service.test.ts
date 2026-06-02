import axios from "axios";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

/**
 * Direct-fetch branch: with no IQ_GATEWAY_* env configured (the test default),
 * fetchData routes through fetchDirect and hits the real upstream URL, which
 * msw intercepts. Asserts the FULL upstream array is returned unmodified.
 *
 * Hermetic: each test resets modules + clears env stubs so this block is
 * independent of run order relative to the gateway block.
 */
describe("BaseService direct fetch branch", () => {
	const server = setupServer();

	beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
	afterEach(() => {
		server.resetHandlers();
		vi.unstubAllEnvs();
	});
	afterAll(() => server.close());

	// Reset module registry and env stubs before each test so we always get a
	// fresh env.ts parse with NO gateway vars set, regardless of run order.
	beforeEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("getChainsRaw returns the full upstream array unmodified (no sort/slice)", async () => {
		const payload = [
			{ name: "Ethereum", tvl: 100, gecko_id: "ethereum", chainId: 1 },
			{ name: "SmallChain", tvl: 5, gecko_id: null, chainId: null },
			{ name: "BSC", tvl: 50, gecko_id: "binancecoin", chainId: 56 },
		];

		let capturedRequestUrl: string | undefined;

		server.use(
			http.get("https://api.llama.fi/v2/chains", ({ request }) => {
				capturedRequestUrl = request.url;
				return HttpResponse.json(payload);
			}),
		);

		// Import INSIDE the test (after beforeEach reset) so env.ts re-parses
		// process.env without any gateway vars.
		const { protocolService } = await import("./index.js");
		const result = await protocolService.getChainsRaw();

		expect(result).toEqual(payload);
		// Order preserved — not re-sorted by tvl, not truncated.
		expect(result.map((c) => c.name)).toEqual([
			"Ethereum",
			"SmallChain",
			"BSC",
		]);

		// Prove we hit the upstream llama.fi host directly, NOT any gateway proxy.
		expect(capturedRequestUrl).toBeDefined();
		if (capturedRequestUrl) {
			expect(new URL(capturedRequestUrl).hostname).toBe("api.llama.fi");
		}
	});
});

/**
 * Verifies the IQ Gateway branch of BaseService. env.ts parses process.env at
 * module load, so we MUST set IQ_GATEWAY_URL/KEY, then vi.resetModules() and
 * dynamic-import the service module so the fresh env is observed.
 *
 * Hermetic: env stubs and module resets are scoped to each test so this block
 * cannot pollute others regardless of run order.
 */
describe("BaseService IQ Gateway branch", () => {
	const server = setupServer();

	beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
	afterEach(() => {
		server.resetHandlers();
		vi.unstubAllEnvs();
		vi.resetModules();
	});
	afterAll(() => server.close());

	beforeEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("routes through the gateway proxy URL with url + projectName + cacheDuration params", async () => {
		vi.stubEnv("IQ_GATEWAY_URL", "https://gateway.test/proxy");
		vi.stubEnv("IQ_GATEWAY_KEY", "gw-test-key");
		vi.resetModules();

		let capturedUrl: URL | undefined;
		let capturedApiKey: string | null = null;

		server.use(
			http.get("https://gateway.test/proxy", ({ request }) => {
				capturedUrl = new URL(request.url);
				capturedApiKey = request.headers.get("x-api-key");
				return HttpResponse.json([{ name: "Ethereum", tvl: 1 }]);
			}),
		);

		const { protocolService } = await import("./index.js");
		const result = await protocolService.getChainsRaw();

		expect(result).toEqual([{ name: "Ethereum", tvl: 1 }]);
		expect(capturedApiKey).toBe("gw-test-key");
		expect(capturedUrl?.searchParams.get("url")).toBe(
			"https://api.llama.fi/v2/chains",
		);
		expect(capturedUrl?.searchParams.get("projectName")).toBe("defillama_mcp");
		expect(capturedUrl?.searchParams.get("cacheDuration")).toBe(
			String(60 * 60),
		);
	});
});

/**
 * Verifies RequestOptions (signal + timeout) are forwarded onto the axios
 * request config, and that the `!== undefined` spread-guard treats `timeout: 0`
 * as a real value (passed through) while omitting the key entirely when no
 * timeout is supplied. Spies on axios.get to inspect the config it receives.
 *
 * Hermetic: module registry and env stubs are reset before each test so the
 * direct-fetch path (no gateway vars) is exercised, regardless of run order.
 */
describe("BaseService forwards RequestOptions to axios", () => {
	beforeEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("forwards signal and honors timeout: 0 (not omitted)", async () => {
		// Import INSIDE the test (after beforeEach reset) so env.ts re-parses
		// process.env without any gateway vars, exercising the direct-fetch path.
		const { protocolService } = await import("./index.js");

		const getSpy = vi
			.spyOn(axios, "get")
			.mockResolvedValue({ data: [] } as never);

		const controller = new AbortController();
		await protocolService.getChainsRaw(undefined, {
			signal: controller.signal,
			timeout: 0,
		});

		expect(getSpy).toHaveBeenCalledTimes(1);
		const config = getSpy.mock.calls[0]?.[1];
		expect(config?.signal).toBe(controller.signal);
		// timeout: 0 must survive the `!== undefined` guard.
		expect(config).toHaveProperty("timeout", 0);
	});

	it("omits the timeout key when no timeout is supplied", async () => {
		// Import INSIDE the test (after beforeEach reset) so env.ts re-parses
		// process.env without any gateway vars, exercising the direct-fetch path.
		const { protocolService } = await import("./index.js");

		const getSpy = vi
			.spyOn(axios, "get")
			.mockResolvedValue({ data: [] } as never);

		await protocolService.getChainsRaw();

		const config = getSpy.mock.calls[0]?.[1];
		expect(config && "timeout" in config).toBe(false);
	});
});
