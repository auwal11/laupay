import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { MAIL_PROVIDER, MailProvider } from '../../common/mail/mail-provider.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminSupportUpdateDto, CreateSupportTicketDto } from './dto/support.dto';
import { Inject } from '@nestjs/common';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support.laupay@gmail.com';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
  ) {}

  async create(dto: CreateSupportTicketDto, userId?: string) {
    let user: { id: string; email: string; fullName: string } | null = null;
    if (userId) {
      user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, fullName: true } });
      if (!user) throw new NotFoundException('User not found');
      if (dto.relatedTransactionId) await this.assertTransactionOwnership(userId, dto.relatedTransactionId);
    } else if (dto.relatedTransactionId) {
      throw new ForbiddenException('A transaction can only be attached from an authenticated account');
    }

    const rawToken = randomBytes(32).toString('hex');
    const ticketNumber = `SUP-${new Date().getUTCFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`;
    const ticket = await (this.prisma as any).supportTicket.create({
      data: {
        id: randomUUID(), ticketNumber, trackingTokenHash: userId ? null : this.hash(rawToken),
        userId: user?.id, contactEmail: (user?.email ?? dto.contactEmail).trim().toLowerCase(),
        contactName: (user?.fullName ?? dto.contactName)?.trim() || null,
        category: dto.category, subject: dto.subject.trim(), description: dto.description.trim(),
        sourcePage: dto.sourcePage?.trim() || null, sourceUrl: this.safePath(dto.sourceUrl),
        relatedTransactionId: dto.relatedTransactionId?.trim() || null,
        transactionReference: dto.transactionReference?.trim() || null, errorCode: dto.errorCode?.trim() || null,
        attachmentMetadata: dto.attachmentMetadata ? this.safeAttachmentMetadata(dto.attachmentMetadata) : undefined,
        events: { create: { action: 'CREATED', toStatus: 'open', reason: 'Ticket submitted', actorId: userId ?? null } },
      },
    });
    await this.notifications.notifyAdmins({ title: 'New support ticket', body: `${ticket.ticketNumber}: ${ticket.subject}`, category: 'system', metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber } }).catch(() => undefined);
    await this.mail.sendSupportNotification({ to: SUPPORT_EMAIL, subject: `[${ticket.ticketNumber}] ${ticket.subject}`, html: `<p>A new LAUPAY support ticket was submitted.</p><p><strong>${this.escape(ticket.ticketNumber)}</strong><br/>${this.escape(ticket.subject)}<br/>From: ${this.escape(ticket.contactEmail)}</p>` }).catch(() => undefined);
    return { ticketNumber: ticket.ticketNumber, status: ticket.status, createdAt: ticket.createdAt, trackingToken: userId ? undefined : rawToken };
  }

  async listMine(userId: string) {
    const rows = await (this.prisma as any).supportTicket.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { messages: { where: { internal: false }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    return rows.map((row: any) => this.publicView(row));
  }

  async getMine(userId: string, id: string) {
    const row = await (this.prisma as any).supportTicket.findFirst({ where: { id, userId }, include: { messages: { where: { internal: false }, orderBy: { createdAt: 'asc' } }, events: { orderBy: { createdAt: 'asc' } } } });
    if (!row) throw new NotFoundException('Support ticket not found');
    return this.publicView(row, true);
  }

  async replyMine(userId: string, id: string, body: string) {
    const row = await (this.prisma as any).supportTicket.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Support ticket not found');
    if (row.status === 'closed') throw new ConflictException('This ticket is closed');
    await (this.prisma as any).supportMessage.create({ data: { ticketId: id, authorType: 'customer', authorId: userId, body: body.trim() } });
    const updated = await (this.prisma as any).supportTicket.update({ where: { id }, data: { status: row.status === 'awaiting_user' ? 'in_progress' : row.status } });
    await (this.prisma as any).supportEvent.create({ data: { ticketId: id, actorId: userId, action: 'CUSTOMER_REPLY', fromStatus: row.status, toStatus: updated.status } });
    await this.notifications.notifyAdmins({ title: 'Support ticket updated', body: `${row.ticketNumber} has a customer reply.`, category: 'system', metadata: { ticketId: id, ticketNumber: row.ticketNumber } }).catch(() => undefined);
    return this.getMine(userId, id);
  }

  async track(ticketNumber: string, token: string) {
    const row = await (this.prisma as any).supportTicket.findFirst({ where: { ticketNumber, trackingTokenHash: this.hash(token) }, include: { messages: { where: { internal: false }, orderBy: { createdAt: 'asc' } } } });
    if (!row) throw new NotFoundException('Ticket not found');
    return this.publicView(row, true);
  }

  async adminList(query: { search?: string; status?: string; category?: string; priority?: string }) {
    const rows = await (this.prisma as any).supportTicket.findMany({ where: { ...(query.status ? { status: query.status } : {}), ...(query.category ? { category: query.category } : {}), ...(query.priority ? { priority: query.priority } : {}), ...(query.search ? { OR: [{ ticketNumber: { contains: query.search, mode: 'insensitive' } }, { subject: { contains: query.search, mode: 'insensitive' } }, { contactEmail: { contains: query.search, mode: 'insensitive' } }, { transactionReference: { contains: query.search, mode: 'insensitive' } }] } : {}) }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 100, include: { user: { select: { id: true, fullName: true, email: true } }, assignedAdmin: { select: { id: true, fullName: true, email: true } } } });
    return rows.map(({ trackingTokenHash, ...row }: any) => row);
  }

  async adminGet(id: string) {
    const row = await (this.prisma as any).supportTicket.findUnique({ where: { id }, include: { user: { select: { id: true, fullName: true, email: true } }, assignedAdmin: { select: { id: true, fullName: true, email: true } }, messages: { orderBy: { createdAt: 'asc' } }, events: { orderBy: { createdAt: 'asc' } } } });
    if (!row) throw new NotFoundException('Support ticket not found');
    const { trackingTokenHash, ...safe } = row;
    return safe;
  }

  async adminUpdate(id: string, adminId: string, dto: AdminSupportUpdateDto) {
    const row = await (this.prisma as any).supportTicket.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Support ticket not found');
    if (dto.status && !dto.reason?.trim()) throw new ConflictException('A reason is required for a status change');
    if (dto.status === 'resolved' && !(dto.resolutionSummary?.trim() || row.resolutionSummary?.trim())) throw new ConflictException('Resolution summary is required before resolving a ticket');
    if (dto.assignedAdminId) {
      const assignee = await this.prisma.user.findFirst({ where: { id: dto.assignedAdminId, role: { in: ['ADMIN', 'SUPPORT', 'FINANCE'] }, status: 'ACTIVE' } });
      if (!assignee) throw new ConflictException('Assigned administrator is not active or authorised');
    }
    const nextStatus = dto.status ?? row.status;
    const updated = await (this.prisma as any).supportTicket.update({ where: { id }, data: { status: nextStatus, priority: dto.priority ?? row.priority, assignedAdminId: dto.assignedAdminId ?? row.assignedAdminId, adminNotes: dto.adminNotes ?? row.adminNotes, resolutionSummary: dto.resolutionSummary ?? row.resolutionSummary, firstResponseAt: row.firstResponseAt ?? (dto.reply ? new Date() : undefined), resolvedAt: nextStatus === 'resolved' ? (row.resolvedAt ?? new Date()) : row.resolvedAt, closedAt: nextStatus === 'closed' ? (row.closedAt ?? new Date()) : row.closedAt } });
    await (this.prisma as any).supportEvent.create({ data: { ticketId: id, actorId: adminId, action: 'ADMIN_UPDATE', fromStatus: row.status, toStatus: nextStatus, reason: dto.reason?.trim() || null, metadata: { priority: updated.priority } } });
    if (dto.reply?.trim()) await (this.prisma as any).supportMessage.create({ data: { ticketId: id, authorType: 'admin', authorId: adminId, body: dto.reply.trim() } });
    if (dto.adminNotes?.trim() && dto.adminNotes.trim() !== row.adminNotes?.trim()) await (this.prisma as any).supportMessage.create({ data: { ticketId: id, authorType: 'admin', authorId: adminId, body: dto.adminNotes.trim(), internal: true } });
    if (dto.reply?.trim() || nextStatus !== row.status) await this.mail.sendSupportNotification({ to: row.contactEmail, subject: `[${row.ticketNumber}] Support update`, html: `<p>Your LAUPAY support ticket <strong>${this.escape(row.ticketNumber)}</strong> has been updated.</p><p>Status: ${this.escape(nextStatus)}</p>${dto.reply ? `<p>${this.escape(dto.reply)}</p>` : ''}` }).catch(() => undefined);
    return this.adminGet(id);
  }

  private async assertTransactionOwnership(userId: string, id: string) {
    const entry = await this.prisma.ledgerEntry.findFirst({ where: { id, walletAccount: { ownerId: userId } }, select: { id: true } });
    if (!entry) throw new NotFoundException('Transaction not found');
  }
  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
  private safePath(value?: string) { return value && value.startsWith('/') && !value.startsWith('//') ? value.slice(0, 160) : null; }
  private safeAttachmentMetadata(value: Record<string, unknown>) { return { name: typeof value.name === 'string' ? value.name.slice(0, 160) : undefined, type: typeof value.type === 'string' ? value.type.slice(0, 80) : undefined, size: typeof value.size === 'number' && value.size <= 5_000_000 ? value.size : undefined }; }
  private escape(value: string) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char)); }
  private publicView(row: any, includeMessages = false) { return { id: row.id, ticketNumber: row.ticketNumber, contactEmail: row.contactEmail, contactName: row.contactName, category: row.category, subject: row.subject, description: row.description, status: row.status, priority: row.priority, sourcePage: row.sourcePage, transactionReference: row.transactionReference, errorCode: row.errorCode, resolutionSummary: row.resolutionSummary, createdAt: row.createdAt, updatedAt: row.updatedAt, resolvedAt: row.resolvedAt, messages: includeMessages ? (row.messages ?? []) : undefined }; }
}
