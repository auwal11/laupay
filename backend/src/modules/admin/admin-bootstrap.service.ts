import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AuditAction, UserRole, UserStatus, WalletOwnerType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { AuthService } from '../auth/auth.service';
import { PasswordHasher } from '../auth/password-hasher.service';

/**
 * Bootstraps the configured initial admin separately from every allowlisted
 * Super Admin identity. Newly-created Super Admins receive an emailed reset
 * link; their random initial credential is never returned or logged.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly passwordHasher: PasswordHasher,
    private readonly auth: AuthService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bootstrapConfiguredAdmin();
    await this.bootstrapAllowlistedSuperAdmins();
  }

  private async bootstrapConfiguredAdmin(): Promise<void> {
    const rawEmail = this.config.adminBootstrapEmail;
    const password = this.config.adminBootstrapPassword;
    if (!rawEmail || !password) return;

    const email = rawEmail.toLowerCase().trim();
    try {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) {
        // Matching an email from deployment configuration is not proof of
        // ownership. Bootstrap is create-only and must never promote or
        // reactivate an existing customer or staff account. Explicit Super
        // Admin allowlist handling is performed separately below.
        this.logger.warn('Admin bootstrap skipped: configured email already belongs to an account');
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
      this.logger.log('Admin bootstrap: created configured ADMIN account');
    } catch (err) {
      this.logger.error(`Configured admin bootstrap failed: ${String(err)}`);
    }
  }

  private async bootstrapAllowlistedSuperAdmins(): Promise<void> {
    for (const email of this.config.superAdminEmails) {
      try {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) {
          if (existing.role !== UserRole.ADMIN || existing.status !== UserStatus.ACTIVE) {
            await this.prisma.user.update({
              where: { id: existing.id },
              data: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
            });
            this.logger.log('Super Admin bootstrap: restored allowlisted account access');
          }
          await this.ensureWallet(existing.id);
          continue;
        }

        const unknownInitialPassword = randomBytes(48).toString('base64url');
        const passwordHash = await this.passwordHasher.hash(unknownInitialPassword);
        const created = await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email,
              passwordHash,
              fullName: 'LAUPAY Super Admin',
              role: UserRole.ADMIN,
              status: UserStatus.ACTIVE,
              mustChangePassword: true,
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
              metadata: { bootstrap: true, superAdmin: true },
            },
          });
          return user;
        });

        // Reuse the normal single-use, expiring password reset flow. This sends
        // the reset link to this allowlisted account, never ADMIN_EMAIL.
        await this.auth.forgotPassword(email);
        this.logger.log(`Super Admin bootstrap: created account and sent reset email for user ${created.id}`);
      } catch (err) {
        this.logger.error(`Super Admin bootstrap failed for configured allowlist entry: ${String(err)}`);
      }
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
