import { request } from "./api";
import type { ApiResult } from "@/types/common";
import type { DeviceInfo, PinStatus, SecurityNotification } from "@/types/security";

/**
 * Expected backend endpoints — confirm exact paths/shapes with the backend
 * agent. PIN values are only ever sent over this layer to the backend; they
 * are never hashed/verified in the browser and never logged.
 */
export const securityService = {
  async getPinStatus(): Promise<ApiResult<{ status: PinStatus; attemptsRemaining: number }>> {
    return request<{ status: PinStatus; attemptsRemaining: number }>("/security/pin/status");
  },

  async createPin(pin: string): Promise<ApiResult<{ status: PinStatus }>> {
    return request<{ status: PinStatus }>("/security/pin", { method: "POST", body: { pin } });
  },

  async changePin(currentPin: string, newPin: string): Promise<ApiResult<{ status: PinStatus }>> {
    return request<{ status: PinStatus }>("/security/pin/change", {
      method: "POST",
      body: { currentPin, newPin },
    });
  },

  async forgotPin(): Promise<ApiResult<{ sent: true }>> {
    return request<{ sent: true }>("/security/pin/forgot", { method: "POST" });
  },

  async getDevices(): Promise<ApiResult<DeviceInfo[]>> {
    return request<DeviceInfo[]>("/security/devices");
  },

  async revokeDevice(deviceId: string): Promise<ApiResult<{ revoked: true }>> {
    return request<{ revoked: true }>(`/security/devices/${deviceId}/revoke`, { method: "POST" });
  },

  async getNotifications(): Promise<ApiResult<SecurityNotification[]>> {
    return request<SecurityNotification[]>("/security/notifications");
  },

  async markNotificationRead(id: string): Promise<ApiResult<{ read: true }>> {
    return request<{ read: true }>(`/security/notifications/${id}/read`, { method: "POST" });
  },
};
