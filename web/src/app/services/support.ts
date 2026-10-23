import { request } from "./api";
import type { ApiResult } from "@app/types/common";

export type SupportTicket = {
  id: string; ticketNumber: string; contactEmail: string; contactName?: string | null;
  category: string; subject: string; description: string; status: string; priority: string;
  sourcePage?: string | null; transactionReference?: string | null; errorCode?: string | null;
  resolutionSummary?: string | null; createdAt: string; updatedAt: string; resolvedAt?: string | null;
  messages?: Array<{ id: string; authorType: string; body: string; createdAt: string; internal?: boolean }>;
};
export type SupportInput = { contactEmail: string; contactName?: string; category: string; subject: string; description: string; sourcePage?: string; sourceUrl?: string; relatedTransactionId?: string; transactionReference?: string; errorCode?: string };

export const supportService = {
  create(input: SupportInput, authenticated: boolean): Promise<ApiResult<{ ticketNumber: string; status: string; createdAt: string; trackingToken?: string }>> {
    return request(authenticated ? "/support/tickets/me" : "/support/tickets", { method: "POST", body: input });
  },
  list(): Promise<ApiResult<SupportTicket[]>> { return request<SupportTicket[]>("/support/tickets"); },
  detail(id: string): Promise<ApiResult<SupportTicket>> { return request<SupportTicket>(`/support/tickets/${id}`); },
  reply(id: string, body: string): Promise<ApiResult<SupportTicket>> { return request<SupportTicket>(`/support/tickets/${id}/replies`, { method: "POST", body: { body } }); },
};
