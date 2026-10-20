import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileStorageService } from '../../common/storage/profile-storage.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly profileStorage: ProfileStorageService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async updateProfile(userId: string, dto: { fullName?: string; phone?: string; profilePhotoData?: string; removeProfilePhoto?: string }) {
    const existing = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    let profilePhotoUrl: string | null | undefined;
    if (dto.removeProfilePhoto === 'true') profilePhotoUrl = null;
    if (dto.profilePhotoData) profilePhotoUrl = await this.profileStorage.save(dto.profilePhotoData);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fullName: dto.fullName, phone: dto.phone, ...(profilePhotoUrl !== undefined ? { profilePhotoUrl } : {}) },
    });
    if (profilePhotoUrl !== undefined && profilePhotoUrl !== existing.profilePhotoUrl) {
      await this.profileStorage.deleteByUrl(existing.profilePhotoUrl);
    }
    const { passwordHash, ...safe } = user;
    return safe;
  }

}
