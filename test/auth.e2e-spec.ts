import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    // Clear data to ensure clean state
    await prisma.refreshToken.deleteMany({});
    await prisma.userDevice.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('should register a new user, login, refresh tokens, and logout successfully', async () => {
    const registerPayload = {
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
      deviceId: 'device-id-123',
      deviceName: 'Test Device',
    };

    // 1. Register
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerPayload)
      .expect(201);

    expect(registerRes.body.user).toBeDefined();
    expect(registerRes.body.accessToken).toBeDefined();
    expect(registerRes.body.refreshToken).toBeDefined();

    // 2. Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: registerPayload.email,
        password: registerPayload.password,
        deviceId: registerPayload.deviceId,
        deviceName: registerPayload.deviceName,
      })
      .expect(200);

    const firstAccessToken = loginRes.body.accessToken;
    const firstRefreshToken = loginRes.body.refreshToken;
    expect(firstAccessToken).toBeDefined();
    expect(firstRefreshToken).toBeDefined();

    // 3. Refresh Token Rotation
    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(200);

    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.message).toBe('Refresh token successfully');
    expect(refreshRes.body.data.accessToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).toBeDefined();
    expect(refreshRes.body.data.expiresIn).toBeDefined();

    const secondAccessToken = refreshRes.body.data.accessToken;
    const secondRefreshToken = refreshRes.body.data.refreshToken;

    // 4. Try to reuse the first refresh token (should throw REUSED error)
    const reuseRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(401);

    expect(reuseRes.body.message).toBe('Refresh token has already been used');

    // 5. Logout using the second refresh token
    const logoutRes = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${secondAccessToken}`)
      .send({ refreshToken: secondRefreshToken })
      .expect(200);

    expect(logoutRes.body.success).toBe(true);
    expect(logoutRes.body.message).toBe('Logout successfully');

    // 6. Try to refresh using the logged out (revoked) token (should throw REVOKED error)
    const refreshAfterLogoutRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: secondRefreshToken })
      .expect(401);

    expect(refreshAfterLogoutRes.body.message).toBe(
      'Refresh token has been revoked',
    );
  });
});
