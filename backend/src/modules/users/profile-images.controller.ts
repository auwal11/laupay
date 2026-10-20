import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProfileStorageService } from '../../common/storage/profile-storage.service';

/**
 * Public read path for database-backed profile photos. URLs contain an
 * unguessable UUID and are treated as public, matching the previous public
 * Supabase bucket behaviour. No auth guard on purpose: <img> tags cannot send
 * an Authorization header.
 */
@Controller('images')
export class ProfileImagesController {
  constructor(private readonly storage: ProfileStorageService) {}

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const image = await this.storage.getImage(id);
    if (!image) throw new NotFoundException('Image not found');
    res.setHeader('Content-Type', image.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // The web app is served from a different origin than the API; helmet's
    // default same-origin resource policy would block these images.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(Buffer.from(image.data));
  }
}
