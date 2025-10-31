/**
 * DefiLlama Services
 * Centralized exports for all service classes and singleton instances
 */

import { env } from "../env.js";
import { openrouter } from "../lib/integrations/openrouter.js";
import { BlockchainService } from "./blockchain.service.js";
import { DexService } from "./dex.service.js";
import { FeesService } from "./fees.service.js";
import { OptionsService } from "./options.service.js";
import { PriceService } from "./price.service.js";
import { ProtocolService } from "./protocol.service.js";
import { StablecoinService } from "./stablecoin.service.js";
import { YieldService } from "./yield.service.js";

// Export service classes
export { BaseService } from "./base.service.js";
export { BlockchainService } from "./blockchain.service.js";
export { DexService } from "./dex.service.js";
export { FeesService } from "./fees.service.js";
export { OptionsService } from "./options.service.js";
export { PriceService } from "./price.service.js";
export { ProtocolService } from "./protocol.service.js";
export { StablecoinService } from "./stablecoin.service.js";
export { YieldService } from "./yield.service.js";

// Create and export singleton instances
export const blockchainService = new BlockchainService();
export const dexService = new DexService();
export const feesService = new FeesService();
export const optionsService = new OptionsService();
export const priceService = new PriceService();
export const protocolService = new ProtocolService();
export const stablecoinService = new StablecoinService();
export const yieldService = new YieldService();

// Initialize AI model for data filtering
const aiModel = openrouter(env.LLM_MODEL);
blockchainService.setAIModel(aiModel);
dexService.setAIModel(aiModel);
feesService.setAIModel(aiModel);
optionsService.setAIModel(aiModel);
priceService.setAIModel(aiModel);
protocolService.setAIModel(aiModel);
stablecoinService.setAIModel(aiModel);
yieldService.setAIModel(aiModel);
