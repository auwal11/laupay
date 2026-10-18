import { authService } from "./auth";
import { walletService } from "./wallet";
import { ordersService } from "./orders";
import { securityService } from "./security";

/**
 * Single service surface for the real backend adapters. The mock layer has
 * been removed now that the backend is the source of truth — there is no
 * VITE_USE_MOCK_API switch any more.
 */
export const auth = authService;
export const wallet = walletService;
export const orders = ordersService;
export const security = securityService;
