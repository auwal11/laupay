import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:\+234|0)[789]\d{9}$/, { message: 'phone must be a valid Nigerian phone number' })
  phone?: string;

  @IsOptional()
  @IsString()
  profilePhotoData?: string;

  @IsOptional()
  @IsString()
  removeProfilePhoto?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }
}
