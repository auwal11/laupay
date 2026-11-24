import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DisputesService } from '../disputes/disputes.service';
import { ProoftrailClient } from './prooftrail.client';

@Injectable()
export class ProoftrailService {
  constructor(private readonly prisma: PrismaService, private readonly disputes: DisputesService, private readonly client: ProoftrailClient) {}

  async create(userId: string, transactionId: string, reason: string, details?: string) {
    const existing = await this.prisma.prooftrailCaseMapping.findFirst({ where: { dispute: { userId, ledgerEntryId: transactionId } } });
    if (existing) return { mapping: existing, alreadyCreated: true };
    const dispute = await this.disputes.create(userId, transactionId, reason, details) as { id: string; ledgerEntryId: string; reason: string; details?: string };
    const entry = await this.prisma.ledgerEntry.findFirst({ where: { id: dispute.ledgerEntryId, walletAccount: { ownerId: userId } }, include: { walletAccount: true } });
    if (!entry) throw new NotFoundException('Transaction not found');

    let provider: string | undefined;
    let transactionReference: string | undefined;
    let type: 'airtime' | 'data' | 'other' = 'other';
    if (entry.referenceType === 'Order' && entry.referenceId) {
      const order = await this.prisma.order.findUnique({ where: { id: entry.referenceId }, include: { vtuTransaction: true } });
      type = order?.type === 'AIRTIME' ? 'airtime' : order?.type === 'DATA' ? 'data' : 'other';
      provider = order?.vtuTransaction?.provider;
      transactionReference = order?.vtuTransaction?.providerReference ?? order?.id;
    } else if (entry.referenceType === 'Payment' && entry.referenceId) {
      const payment = await this.prisma.payment.findUnique({ where: { id: entry.referenceId } });
      provider = payment?.providerName ?? undefined;
      transactionReference = payment?.providerReference ?? payment?.id;
    }

    const externalTransactionId = `laupay:${entry.id}`;
    const idempotencyKey = `laupay-dispute:${dispute.id}`;
    const remote = await this.client.createDispute({
      externalTransactionId,
      transaction: { amount: entry.amount.toString(), currency: 'NGN', type, ...(provider ? { provider } : {}), transactionStatus: 'disputed', transactionReference, transactionDate: entry.createdAt.toISOString() },
      customer: { externalCustomerId: userId },
      dispute: { reason, ...(details?.trim() ? { description: details.trim() } : {}) },
    }, idempotencyKey);
    const mapping = await this.prisma.prooftrailCaseMapping.create({ data: { disputeId: dispute.id, prooftrailCaseId: remote.caseId, externalTransactionId: remote.externalTransactionId, prooftrailStatus: remote.status, lastSyncedAt: new Date(remote.createdAt) } });
    return { mapping, alreadyCreated: false };
  }

  async status(userId: string, caseId: string) {
    const mapping = await this.prisma.prooftrailCaseMapping.findFirst({ where: { prooftrailCaseId: caseId, dispute: { userId } } });
    if (!mapping) throw new NotFoundException('ProofTrail dispute not found');
    const remote = await this.client.getStatus(caseId);
    const updated = await this.prisma.prooftrailCaseMapping.update({ where: { id: mapping.id }, data: { prooftrailStatus: remote.status, lastSyncedAt: new Date(remote.updatedAt), evidenceCount: remote.evidenceCount, findingsCount: remote.findingsCount, reportAvailable: remote.reportAvailable, reportSha256: remote.report?.sha256 ?? null, reportVersion: remote.report?.version ?? null } });
    return { ...remote, mappingId: updated.id };
  }

  async evidence(userId: string, caseId: string, file: { buffer: Buffer; originalname: string; mimetype: string }) {
    const mapping = await this.prisma.prooftrailCaseMapping.findFirst({ where: { prooftrailCaseId: caseId, dispute: { userId } } });
    if (!mapping) throw new NotFoundException('ProofTrail dispute not found');
    if (!file?.buffer?.length) throw new ConflictException('Choose a non-empty evidence file');
    if (file.buffer.length > 10 * 1024 * 1024) throw new ConflictException('Evidence file is too large');
    return this.client.uploadEvidence(caseId, { buffer: file.buffer, filename: file.originalname, mimetype: file.mimetype }, `laupay-evidence:${mapping.id}:${randomUUID()}`);
  }

  async receiveWebhook(eventId: string, payload: Record<string, unknown>) {
    try {
      await this.prisma.prooftrailWebhookEvent.create({ data: { eventId, event: typeof payload.event === 'string' ? payload.event : null, payload: payload as Prisma.InputJsonValue } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { duplicate: true };
      throw error;
    }
    const caseId = typeof payload.caseId === 'string' ? payload.caseId : '';
    const status = typeof payload.status === 'string' ? payload.status : '';
    if (!caseId || !status) return { duplicate: false, updated: false };
    const mapping = await this.prisma.prooftrailCaseMapping.findUnique({ where: { prooftrailCaseId: caseId } });
    if (!mapping) return { duplicate: false, updated: false };
    await this.prisma.prooftrailCaseMapping.update({ where: { id: mapping.id }, data: { prooftrailStatus: status, lastSyncedAt: new Date() } });
    const localStatus = mapLocalDisputeStatus(status);
    if (localStatus) await this.prisma.transactionDispute.update({ where: { id: mapping.disputeId }, data: { status: localStatus } });
    return { duplicate: false, updated: true };
  }
}

function mapLocalDisputeStatus(status: string): 'IN_REVIEW' | 'RESOLVED' | 'REJECTED' | 'CLOSED' | null {
  const normalized = status.toLowerCase();
  if (['under_review', 'in_review', 'investigating'].includes(normalized)) return 'IN_REVIEW';
  if (['resolved', 'report_ready', 'completed'].includes(normalized)) return 'RESOLVED';
  if (['rejected', 'declined'].includes(normalized)) return 'REJECTED';
  if (normalized === 'closed') return 'CLOSED';
  return null;
}
