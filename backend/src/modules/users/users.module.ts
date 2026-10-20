import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ProfileImagesController } from './profile-images.controller';
import { ProfileStorageService } from '../../common/storage/profile-storage.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [UsersController, ProfileImagesController],
  providers: [UsersService, ProfileStorageService],
})
export class UsersModule {}
