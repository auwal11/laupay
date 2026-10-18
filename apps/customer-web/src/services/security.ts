import { request } from "./api";
import type { ApiResult } from "@/types/common";
import type { DeviceInfo, PinStatus, SecurityNotification } from "@/types/security";

/**
 * Expected backend endpoints — confirm exact paths/shapes with the backend
 * agent. PIN values are only ever sent over this layer to the backend; they
 * are never hashed/verified in the browser and never logged.
 */
export const securityService = {
  async getPinStatus(): Promise<ApiResult<{ hasPin: boolean; status: PinStatus; attemptsRemaining: number }>> {
    return request<{ hasPin: boolean; locked: boolean; lockedUntil: string | null }>("/api/security/pin/status").then((result) => result.ok ? { ok: true, data: { hasPin: result.data.hasPin, status: result.data.locked ? "locked" : result.data.hasPin ? "active" : "not_set", attemptsRemaining: 0 } } : result);
  },

  async createPin(pin: string): Promise<ApiResult<{ status: PinStatus }>> {
    return request<{ hasPin: boolean }>("/api/security/pin", { method: "POST", body: { pin } }).then((result) => result.ok ? { ok: true, data: { status: "active" } } : result);
  },

  async changePin(currentPin: string, newPin: string): Promise<ApiResult<{ status: PinStatus }>> {
    return request<{ hasPin: boolean }>("/api/security/pin/change", {
      method: "POST",
      body: { currentPin, newPin },
    }).then((result) => result.ok ? { ok: true, data: { status: "active" } } : result);
  },

  async forgotPin(): Promise<ApiResult<{ sent: true }>> {
    return request<{ sent: true }>("/api/security/pin/forgot", { method: "POST" });
  },

  async getDevices(): Promise<ApiResult<DeviceInfo[]>> {
    return request<DeviceInfo[]>("/api/security/devices");
  },

  async revokeDevice(deviceId: string): Promise<ApiResult<{ revoked: true }>> {
    return request<{ revoked: true }>(`/api/security/devices/${deviceId}/revoke`, { method: "POST" });
  },

  async getNotifications(): Promise<ApiResult<SecurityNotification[]>> {
    return request<SecurityNotification[]>("/api/security/notifications");
  },

  async markNotificationRead(id: string): Promise<ApiResult<{ read: true }>> {
    return request<{ read: true }>(`/api/security/notifications/${id}/read`, { method: "POST" });
  },
};
