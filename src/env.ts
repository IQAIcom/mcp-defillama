import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
	IQ_GATEWAY_URL: z.url().optional(),
	IQ_GATEWAY_KEY: z.string().min(1).optional(),

	DEFILLAMA_API_KEY: z.string().min(1).optional(),

	// LLM configuration (optional)
	GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);
