import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBeneficiaryDto, UpdateBeneficiaryDto } from './dto/beneficiary.dto';

@Injectable()
export class BeneficiariesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.beneficiary.findMany({
      where: { userId },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Saves a recipient. Re-saving the same number + network updates the label
   * and refreshes lastUsedAt instead of creating a duplicate, so the purchase
   * flow can call this unconditionally when "save this number" is ticked.
   */
  async create(userId: string, dto: CreateBeneficiaryDto) {
    const label = dto.label?.trim() || dto.network;
    try {
      return await this.prisma.beneficiary.upsert({
        where: {
          userId_phoneNumber_network: {
            userId,
            phoneNumber: dto.phoneNumber,
            network: dto.network,
          },
        },
        create: { userId, label, phoneNumber: dto.phoneNumber, network: dto.network, lastUsedAt: new Date() },
        update: { label, lastUsedAt: new Date() },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This beneficiary already exists');
      }
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateBeneficiaryDto) {
    const existing = await this.prisma.beneficiary.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Beneficiary not found');

    const phoneNumber = dto.phoneNumber ?? existing.phoneNumber;
    const network = dto.network ?? existing.network;
    if (phoneNumber === existing.phoneNumber && network === existing.network) {
      if (dto.label === undefined) return existing;
      return this.prisma.beneficiary.update({ where: { id }, data: { label: dto.label.trim() } });
    }

    try {
      return await this.prisma.beneficiary.update({
        where: { id },
        data: {
          ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
          phoneNumber,
          network,
          lastUsedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A beneficiary with this number and network already exists');
      }
      throw error;
    }
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.beneficiary.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new NotFoundException('Beneficiary not found');
    return { deleted: true };
  }
}
