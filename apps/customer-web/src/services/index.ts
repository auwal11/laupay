import { authService } from "./auth";
import { walletService } from "./wallet";
import { ordersService } from "./orders";
import { securityService } from "./security";

/**
 * Single service surface for the real backend adapters.
 */
export const auth = authService;
export const wallet = walletService;
export const orders = ordersService;
export const security = securityService;
