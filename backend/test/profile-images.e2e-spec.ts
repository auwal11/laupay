import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MockMailProvider } from '../src/common/mail/mock-mail.provider';

const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function registerVerified(server: App, user: { email: string; password: string; fullName: string }): Promise<string> {
  await request(server)
    .post('/api/auth/register')
    .send({ ...user, phone: '080' + String(Math.floor(Math.random() * 90_000_000) + 10_000_000), termsAccepted: true, termsVersion: 'e2e' })
    .expect(201);
  const code = MockMailProvider.lastCodeFor(user.email);
  if (!code) throw new Error('No verification code captured for ' + user.email);
  const res = await request(server).post('/api/auth/verify-otp').send({ email: user.email, code }).expect(201);
  return res.body.accessToken as string;
}

describe('Profile images (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const user = { email: `photo-${Date.now()}@test.local`, password: 'Password123!', fullName: 'Photo User' };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    token = await registerVerified(app.getHttpServer(), user);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an invalid data URL', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ profilePhotoData: 'data:text/plain;base64,aGVsbG8=' })
      .expect(400);
  });

  it('stores the photo when object storage is unavailable and serves it publicly', async () => {
    const upload = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ profilePhotoData: ONE_PIXEL_PNG })
      .expect(200);

    const url = upload.body.profilePhotoUrl as string;
    expect(url).toMatch(/^\/api\/images\/[0-9a-f-]{36}$/);

    const image = await request(app.getHttpServer()).get(url).expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(image.headers['cache-control']).toContain('immutable');
    expect(Buffer.from(image.body).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  it('deletes the previous database image when it is replaced', async () => {
    const first = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ profilePhotoData: ONE_PIXEL_PNG })
      .expect(200);
    const firstUrl = first.body.profilePhotoUrl as string;

    const second = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ profilePhotoData: ONE_PIXEL_PNG })
      .expect(200);
    expect(second.body.profilePhotoUrl).not.toBe(firstUrl);

    await request(app.getHttpServer()).get(firstUrl).expect(404);
    await request(app.getHttpServer()).get(second.body.profilePhotoUrl).expect(200);
  });

  it('removes the photo and its stored bytes', async () => {
    const upload = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ profilePhotoData: ONE_PIXEL_PNG })
      .expect(200);
    const url = upload.body.profilePhotoUrl as string;

    const removed = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ removeProfilePhoto: 'true' })
      .expect(200);
    expect(removed.body.profilePhotoUrl).toBeNull();
    await request(app.getHttpServer()).get(url).expect(404);
  });
});
