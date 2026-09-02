# ADR 0001: Backend Framework — NestJS

**Status**: Accepted
**Date**: Phase 1

## Context
The brief allows NestJS or Fastify. LAUPAY has many bounded contexts (auth,
wallet, ledger, orders, payments, vtu, webhooks, admin) that benefit from
enforced module boundaries, dependency injection, and guard/interceptor
patterns for cross-cutting concerns (auth, validation, rate limiting).

## Decision
Use **NestJS** (on top of Express by default) as the backend framework.

## Rationale
- First-class module system maps directly onto the module boundaries in
  `docs/architecture/overview.md §4`.
- Built-in DI makes the provider-abstraction pattern (`PaymentProvider`,
  `VTUProvider`) easy to bind/swap via injection tokens without service
  locator anti-patterns.
- Guards/Interceptors/Pipes give a clean, declarative place for auth,
  validation, and rate limiting — reducing the chance of a route
  accidentally skipping a security check.
- Larger ecosystem of maintained modules (`@nestjs/throttler`,
  `@nestjs/jwt`, `@nestjs/config`) that map directly onto brief requirements.

## Consequences
- Slightly more boilerplate than Fastify-direct for simple CRUD, judged
  worth it for a financial system where explicit structure reduces the
  chance of an unguarded endpoint.
