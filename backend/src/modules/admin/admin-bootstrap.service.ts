import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AuditAction, UserRole, UserStatus, WalletOwnerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { PasswordHasher } from '../auth/password-hasher.service';

/**
 * Ensures a first ADMIN account exists on a fresh deployment where we have
 * no shell/DB access. Idempotent and no-op unless ADMIN_EMAIL + ADMIN_PASSWORD
 * are both set. Never creates anything when they are unset, so it is safe to
 * leave the code in place permanently. See docs/security/security-model.md §2.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const rawEmail = this.config.adminBootstrapEmail;
    const password = this.config.adminBootstrapPassword;
    if (!rawEmail || !password) return;

    const email = rawEmail.toLowerCase().trim();

    try {
      const existing = await this.prisma.user.findUnique({ where: { email } });

      if (existing) {
        if (existing.role !== UserRole.ADMIN || existing.status !== UserStatus.ACTIVE) {
          await this.prisma.user.update({
            where: { id: existing.id },
            data: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
          });
          this.logger.log(`Admin bootstrap: promoted existing user ${email} to ADMIN/ACTIVE`);
        }
        await this.ensureWallet(existing.id);
        return;
      }

      const passwordHash = await this.passwordHasher.hash(password);
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            fullName: this.config.adminBootstrapName,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
          },
        });
        await tx.walletAccount.create({
          data: { ownerId: user.id, ownerType: WalletOwnerType.USER },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: AuditAction.CREATE,
            entityType: 'User',
            entityId: user.id,
            metadata: { bootstrap: true },
          },
        });
      });
      this.logger.log(`Admin bootstrap: created ADMIN account ${email}`);
    } catch (err) {
      // Never crash the app because bootstrap failed — an operator can retry
      // by redeploying once env vars are correct.
      this.logger.error(`Admin bootstrap failed for ${email}: ${String(err)}`);
    }
  }

  private async ensureWallet(userId: string): Promise<void> {
    const wallet = await this.prisma.walletAccount.findUnique({ where: { ownerId: userId } });
    if (!wallet) {
      await this.prisma.walletAccount.create({
        data: { ownerId: userId, ownerType: WalletOwnerType.USER },
      });
    }
  }
}
