import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Stores profile photos. Object storage (Supabase) is preferred when it is
 * configured *and* working; otherwise the image is kept in Postgres and served
 * from GET /api/images/:id. That fallback matters in production because the
 * Supabase service-role key can be rotated/revoked independently of this
 * deployment — a stale key must not break profile uploads for every user.
 */
@Injectable()
export class ProfileStorageService {
  private readonly logger = new Logger(ProfileStorageService.name);
  private bucketReady = false;
  private bucketSetup?: Promise<void>;
  /** Set after the first failed storage call so we stop paying that latency. */
  private supabaseUnavailable = false;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private async ensureSupabaseBucket(): Promise<void> {
    if (this.bucketReady) return;
    if (!this.bucketSetup) {
      this.bucketSetup = (async () => {
        const baseUrl = this.config.supabaseUrl.replace(/\/$/, '');
        const bucketUrl = `${baseUrl}/storage/v1/bucket/${encodeURIComponent(this.config.supabaseStorageBucket)}`;
        const headers = {
          Authorization: `Bearer ${this.config.supabaseServiceRoleKey}`,
          apikey: this.config.supabaseServiceRoleKey,
          'Content-Type': 'application/json',
        };
        const existing = await fetch(bucketUrl, { method: 'GET', headers });
        if (existing.ok) {
          this.bucketReady = true;
          return;
        }
        if (existing.status !== 404) {
          throw new Error(`Supabase bucket check failed (${existing.status})`);
        }

        const created = await fetch(`${baseUrl}/storage/v1/bucket`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: this.config.supabaseStorageBucket,
            name: this.config.supabaseStorageBucket,
            public: true,
            file_size_limit: 2 * 1024 * 1024,
            allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
          }),
        });

        // Different Supabase Storage versions use 400 or 409 for a concurrent
        // create/already-exists response. Verify the bucket instead of
        // treating either response as a permanent outage.
        if (!created.ok && created.status !== 400 && created.status !== 409) {
          throw new Error(`Supabase bucket setup failed (${created.status})`);
        }
        const verified = await fetch(bucketUrl, { method: 'GET', headers });
        if (!verified.ok) throw new Error(`Supabase bucket verification failed (${verified.status})`);
        this.bucketReady = true;
      })().catch((error) => {
        this.bucketSetup = undefined;
        throw error;
      });
    }
    await this.bucketSetup;
  }

  async save(dataUrl: string): Promise<string> {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) throw new BadRequestException('Invalid profile image');
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 2 * 1024 * 1024) throw new BadRequestException('Profile image is too large');
    const valid = buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) || buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP');
    if (!valid) throw new BadRequestException('Invalid profile image');

    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.slice(6);
    if (this.config.supabaseUrl && this.config.supabaseServiceRoleKey && !this.supabaseUnavailable) {
      const url = await this.trySupabase(buffer, mimeType, `${randomUUID()}.${extension}`);
      if (url) return url;
    }

    // Postgres fallback: survives read-only containers and revoked storage keys.
    try {
      const id = randomUUID();
      await this.prisma.storedImage.create({ data: { id, mimeType, data: buffer } });
      return `/api/images/${id}`;
    } catch (error) {
      this.logger.error(`Database image fallback failed: ${String(error)}`);
      throw new BadRequestException('Profile image storage is unavailable. Please try again later.');
    }
  }

  private async trySupabase(buffer: Buffer, mimeType: string, filename: string): Promise<string | null> {
    const baseUrl = this.config.supabaseUrl.replace(/\/$/, '');
    const path = `profile/${filename}`;
    try {
      await this.ensureSupabaseBucket();
      const response = await fetch(`${baseUrl}/storage/v1/object/${this.config.supabaseStorageBucket}/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.supabaseServiceRoleKey}`,
          apikey: this.config.supabaseServiceRoleKey,
          'Content-Type': mimeType,
          'x-upsert': 'false',
        },
        body: new Uint8Array(buffer),
      });
      if (!response.ok) {
        this.logger.warn(`Supabase profile upload failed (${response.status}); falling back to database storage`);
        this.supabaseUnavailable = true;
        return null;
      }
      return `${baseUrl}/storage/v1/object/public/${this.config.supabaseStorageBucket}/${path}`;
    } catch (error) {
      this.logger.warn(`Supabase profile storage unavailable (${String(error)}); falling back to database storage`);
      this.supabaseUnavailable = true;
      return null;
    }
  }

  async getImage(id: string) {
    return this.prisma.storedImage.findUnique({ where: { id } });
  }

  /** Best-effort cleanup of a database-backed photo when it is replaced/removed. */
  async deleteByUrl(url: string | null | undefined): Promise<void> {
    if (!url) return;
    const match = /\/api\/images\/([0-9a-f-]{36})$/.exec(url);
    if (!match) return;
    try {
      await this.prisma.storedImage.deleteMany({ where: { id: match[1] } });
    } catch (error) {
      this.logger.warn(`Failed to delete stored profile image ${match[1]}: ${String(error)}`);
    }
  }
}
