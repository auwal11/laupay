import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Read-only. WalletService NEVER mutates a balance — all mutations go
 * through LedgerService. See docs/architecture/wallet-ledger-model.md.
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyWallet(userId: string) {
    const wallet = await this.prisma.walletAccount.findUnique({ where: { ownerId: userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getMyTransactions(userId: string, take = 50) {
    const wallet = await this.getMyWallet(userId);
    return this.prisma.ledgerEntry.findMany({
      where: { walletAccountId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /**
   * Object-level ownership check (IDOR/BOLA prevention) — used by any
   * endpoint that accepts a walletAccountId and must verify the requester
   * actually owns it, rather than trusting the ID alone.
   * See docs/security/security-model.md §2.
   */
  async assertOwnership(walletAccountId: string, requesterUserId: string): Promise<void> {
    const wallet = await this.prisma.walletAccount.findUnique({
      where: { id: walletAccountId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.ownerId !== requesterUserId) {
      throw new ForbiddenException('You do not have access to this wallet');
    }
  }
}
