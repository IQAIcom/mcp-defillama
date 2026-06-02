// tests/integration/no-isolated-vm.hooks.mjs
//
// Resolve hook that forbids resolving `isolated-vm`, proving the execute tool
// degrades gracefully (clean {ok:false} envelope) when the native addon is
// unavailable, rather than crashing the process.
export function resolve(specifier, context, nextResolve) {
	if (specifier === "isolated-vm") {
		const err = new Error("Cannot find module 'isolated-vm'");
		err.code = "ERR_MODULE_NOT_FOUND";
		throw err;
	}
	return nextResolve(specifier, context);
}
