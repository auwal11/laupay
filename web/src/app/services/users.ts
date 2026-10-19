import { request } from "./api";
import type { ApiResult } from "@app/types/common";
import type { AuthUser } from "@app/types/auth";

export const usersService = {
  async updateProfile(payload: { fullName?: string; phone?: string; profilePhotoData?: string; removeProfilePhoto?: string }): Promise<ApiResult<AuthUser>> {
    return request<AuthUser>("/users/me", { method: "PATCH", body: payload });
  },
};
