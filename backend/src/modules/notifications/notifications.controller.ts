import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PushTokenDto, RemovePushTokenDto } from './dto/push-token.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.list(user.userId);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user.userId);
  }

  @Put('push-token')
  registerPushToken(@CurrentUser() user: AuthenticatedUser, @Body() body: PushTokenDto) {
    return this.notifications.registerPushToken(user.userId, body.token, body.platform);
  }

  @Delete('push-token')
  unregisterPushToken(@CurrentUser() user: AuthenticatedUser, @Body() body: RemovePushTokenDto) {
    return this.notifications.unregisterPushToken(user.userId, body.token);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.userId);
  }

  @Post(':id/read')
  read(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.userId, id);
  }
}
