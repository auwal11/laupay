export interface WebhookVerifier {
  /** Returns true only if the signature is valid for the given raw body. */
  verify(rawBody: string, signatureHeader: string | undefined): boolean;
}

/**
 * For the mock provider, "verification" checks a shared-secret header
 * rather than a real HMAC signature — sufficient for local development.
 * A real provider's verifier (e.g. PaystackWebhookVerifier) would compute
 * an HMAC-SHA512 of the raw body using the provider's webhook secret and
 * compare it to the signature header, per that provider's documentation.
 */
export class MockWebhookVerifier implements WebhookVerifier {
  verify(rawBody: string, signatureHeader: string | undefined): boolean {
    return signatureHeader === 'mock-shared-secret';
  }
}
