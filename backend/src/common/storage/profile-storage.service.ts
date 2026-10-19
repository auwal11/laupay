import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class ProfileStorageService {
  constructor(private readonly config: AppConfigService) {}
  async save(dataUrl: string): Promise<string> {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) throw new BadRequestException('Invalid profile image');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 2 * 1024 * 1024) throw new BadRequestException('Profile image is too large');
    const valid = buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) || buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP');
    if (!valid) throw new BadRequestException('Invalid profile image');
    const extension = match[1] === 'image/jpeg' ? 'jpg' : match[1].slice(6); const filename = `${randomUUID()}.${extension}`;
    if (this.config.supabaseUrl && this.config.supabaseServiceRoleKey) {
      const path = `profile/${filename}`;
      let response: Response;
      try {
        response = await fetch(`${this.config.supabaseUrl}/storage/v1/object/${this.config.supabaseStorageBucket}/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${this.config.supabaseServiceRoleKey}`, apikey: this.config.supabaseServiceRoleKey, 'Content-Type': match[1], 'x-upsert': 'false' }, body: buffer });
      } catch (err) {
        // Never let a transport failure escape as an opaque 500.
        throw new ServiceUnavailableException(`Profile image storage is unavailable: ${String(err)}`);
      }
      if (!response.ok) throw new ServiceUnavailableException('Profile image storage is unavailable');
      return `${this.config.supabaseUrl}/storage/v1/object/public/${this.config.supabaseStorageBucket}/${path}`;
    }
    try {
      const directory = join(process.cwd(), 'uploads', 'profile'); await mkdir(directory, { recursive: true }); await writeFile(join(directory, filename), buffer, { flag: 'wx' }); return `/uploads/profile/${filename}`;
    } catch (err) {
      throw new ServiceUnavailableException(`Profile image storage is unavailable: ${String(err)}`);
    }
  }
}
