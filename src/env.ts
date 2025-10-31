import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
	IQ_GATEWAY_URL: z.url(),
	IQ_GATEWAY_KEY: z.string().min(1),
	OPENROUTER_API_KEY: z.string().min(1),
	LLM_MODEL: z.string().default("openai/gpt-4.1-mini"),
	GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
