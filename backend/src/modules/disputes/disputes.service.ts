import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DISPUTE_REASONS } from './disputes.controller';

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, transactionId: string, reason: string, details?: string) {
    if (!DISPUTE_REASONS.includes(reason as (typeof DISPUTE_REASONS)[number])) {
      throw new ConflictException('Choose a valid dispute reason');
    }
    const entries = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT le."id"
      FROM "LedgerEntry" le
      INNER JOIN "WalletAccount" wa ON wa."id" = le."walletAccountId"
      WHERE le."id" = ${transactionId} AND wa."ownerId" = ${userId}
      LIMIT 1
    `);
    const entry = entries[0];
    if (!entry) throw new NotFoundException('Transaction not found');

    const caseReference = `DSP-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      const created = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        INSERT INTO "TransactionDispute" ("id", "caseReference", "userId", "ledgerEntryId", "reason", "details", "status", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${caseReference}, ${userId}, ${entry.id}, ${reason}, ${details?.trim() || null}, 'OPEN'::"DisputeStatus", NOW(), NOW())
        RETURNING "id", "caseReference", "userId", "ledgerEntryId", "reason", "details", "status", "createdAt", "updatedAt"
      `);
      return created[0];
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A dispute already exists for this transaction');
      throw error;
    }
  }

  list(userId: string) {
    return this.prisma.$queryRaw(Prisma.sql`
      SELECT td.*, le."direction", le."amount", le."reason" AS "ledgerReason", le."createdAt" AS "transactionCreatedAt"
      FROM "TransactionDispute" td
      INNER JOIN "LedgerEntry" le ON le."id" = td."ledgerEntryId"
      WHERE td."userId" = ${userId}
      ORDER BY td."createdAt" DESC
    `);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}
