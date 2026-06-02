import type { createChildLogger } from "./logger.js";

type LoggerType = ReturnType<typeof createChildLogger>;

/**
 * Build a `logAndWrapError` helper bound to a specific logger.
 *
 * Returns a function that logs the given context plus error, then returns a
 * proper `Error` instance (wrapping non-Error throwables) so callers can
 * `throw` the result. Each service supplies its own child logger so per-service
 * log context is preserved.
 */
export function createLogAndWrapError(logger: LoggerType) {
	return (context: string, error: unknown): Error => {
		if (error instanceof Error) {
			logger.error(context, error);
			return error;
		}

		const wrappedError = new Error(String(error));
		logger.error(context, wrappedError);
		return wrappedError;
	};
}
