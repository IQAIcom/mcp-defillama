import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		setupFiles: ["./tests/integration/setup.ts"],
		include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
		environment: "node",
		passWithNoTests: true,
		// Generous global ceiling for the integration tests (lazy-isolated-vm spawns a
		// child process; execute tests exercise real timeouts). Unit tests have no
		// inherently slow paths today, so the wider global won't mask hangs in practice.
		testTimeout: 60_000,
		pool: "forks", // isolated-vm + native deps behave better with fork pool
	},
});
