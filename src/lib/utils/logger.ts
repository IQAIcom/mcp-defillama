import winston from "winston";
import { z } from "zod";

export const LogLevelSchema = z.enum(["error", "warn", "info", "debug"]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const parseLogLevel = (level?: string): LogLevel => {
	const result = LogLevelSchema.safeParse(level);
	return result.success ? result.data : "info";
};

export const getLogLevelFromEnv = (): LogLevel => {
	return parseLogLevel(process.env.LOG_LEVEL);
};

export interface LoggerOptions {
	service: string;
	level?: LogLevel;
	colorize?: boolean;
	timestamp?: boolean;
}

/**
 * Create a Winston logger instance with consistent formatting
 *
 * @param options - Logger configuration options
 * @returns Configured Winston logger instance
 *
 * @example
 * ```typescript
 * import { createLogger } from './lib/utils/logger';
 *
 * const logger = createLogger({ service: 'DefiLlama MCP' });
 * logger.info('Server started');
 * logger.debug('Debug information');
 * logger.error('Error occurred', { error });
 * ```
 */
export const createLogger = (options: LoggerOptions): winston.Logger => {
	const { service, level = getLogLevelFromEnv(), colorize = true, timestamp = true } = options;

	const formats: winston.Logform.Format[] = [];

	if (timestamp) {
		formats.push(winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }));
	}

	formats.push(winston.format.errors({ stack: true }));

	if (colorize) {
		formats.push(winston.format.colorize());
	}

	// Custom format for consistent output
	formats.push(
		winston.format.printf(({ level, message, timestamp, stack }) => {
			const ts = timestamp ? `${timestamp} ` : "";
			const prefix = `[${service}]`;
			let logMessage = `${ts}${prefix} ${level}: ${message}`;

			// Add stack trace for errors
			if (stack) {
				logMessage += `\n${stack}`;
			}

			return logMessage;
		}),
	);

	return winston.createLogger({
		level,
		format: winston.format.combine(...formats),
		transports: [
			new winston.transports.Console({
				// Use stderr for all logs to avoid interfering with STDOUT
				stderrLevels: ["error", "warn", "info", "debug"],
			}),
		],
	});
};

/**
 * Default application logger
 * Can be used across the application for general logging
 */
export const logger = createLogger({
	service: "DefiLlama MCP",
});

/**
 * Create a child logger with a specific service name
 *
 * @param service - Service name for the child logger
 * @returns Logger instance for the specific service
 *
 * @example
 * ```typescript
 * const mcpLogger = createChildLogger('DefiLlama MCP');
 * mcpLogger.info('Server started');
 * ```
 */
export const createChildLogger = (service: string): winston.Logger => {
	return createLogger({
		service,
	});
};

export type { Logger } from "winston";
