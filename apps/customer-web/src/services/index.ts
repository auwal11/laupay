import { authService } from "./auth";
import { walletService } from "./wallet";
import { ordersService } from "./orders";
import { securityService } from "./security";
import { mockAuthService, mockWalletService, mockOrdersService, mockSecurityService } from "./mock";

/**
 * Single switch point between the real backend adapters and the isolated
 * mock layer. Components/hooks should always import `{ auth, wallet, orders, security }`
 * from here — never reach into ./auth, ./wallet, ./orders, ./security, or ./mock directly.
 *
 * This is the one line to change when the real backend is ready:
 *   VITE_USE_MOCK_API=false in .env
 */
const useMock = import.meta.env.VITE_USE_MOCK_API !== "false";

export const auth = useMock ? mockAuthService : authService;
export const wallet = useMock ? mockWalletService : walletService;
export const orders = useMock ? mockOrdersService : ordersService;
export const security = useMock ? mockSecurityService : securityService;
