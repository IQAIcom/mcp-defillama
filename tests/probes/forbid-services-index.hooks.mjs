export async function resolve(specifier, context, nextResolve) {
	const r = await nextResolve(specifier, context);
	if (r.url.endsWith("/services/index.js")) {
		throw new Error(
			"FORBIDDEN: services/index.js was loaded during tool-metadata import",
		);
	}
	return r;
}
