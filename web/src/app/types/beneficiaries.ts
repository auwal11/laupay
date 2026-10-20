export type BeneficiaryNetwork = "MTN" | "AIRTEL" | "GLO" | "9MOBILE";

/** A saved recipient, scoped to the signed-in user by the backend. */
export interface Beneficiary {
  id: string;
  label: string;
  phoneNumber: string;
  network: BeneficiaryNetwork;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BeneficiaryPayload {
  label?: string;
  phoneNumber: string;
  network: BeneficiaryNetwork;
}
