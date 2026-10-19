import { request } from "./api";
import type { ApiResult } from "@app/types/common";
import type { DeviceInfo, PinStatusResponse, SecurityNotification } from "@app/types/security";

/**
 * PIN endpoints speak to the backend's security module. Responses mirror the
 * backend exactly: status is {hasPin, locked, lockedUntil}; set/change return
 * {hasPin:true}; verify returns {verified:true}. PIN values are only ever sent
 * over this layer to the backend — they are never hashed/verified in the
 * browser and never logged.
 */
export const securityService = {
  async getPinStatus(): Promise<ApiResult<PinStatusResponse>> {
    return request<PinStatusResponse>("/security/pin/status");
  },

  async createPin(pin: string): Promise<ApiResult<{ hasPin: true }>> {
    return request<{ hasPin: true }>("/security/pin", { method: "POST", body: { pin } });
  },

  async verifyPin(pin: string): Promise<ApiResult<{ verified: true }>> {
    return request<{ verified: true }>("/security/pin/verify", { method: "POST", body: { pin } });
  },

  async changePin(currentPin: string, newPin: string): Promise<ApiResult<{ hasPin: true }>> {
    return request<{ hasPin: true }>("/security/pin/change", {
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
