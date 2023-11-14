import { LoginResponseDto, PartnerDirection } from '@app/domain';
import { PartnerController } from '@app/immich';
import { api } from '@test/api';
import { db } from '@test/db';
import { errorStub } from '@test/fixtures';
import { testApp } from '@test/test-utils';
import request from 'supertest';

const user1Dto = {
  email: 'user1@immich.app',
  password: 'Password123',
  name: 'User 1',
};

const user2Dto = {
  email: 'user2@immich.app',
  password: 'Password123',
  name: 'User 2',
};

const user3Dto = {
  email: 'user3@immich.app',
  password: 'Password123',
  name: 'User 3',
};

describe(`${PartnerController.name} (e2e)`, () => {
  let server: any;
  let user1: LoginResponseDto;
  let user2: LoginResponseDto;
  let user3: LoginResponseDto;

  beforeAll(async () => {
    [server] = await testApp.create();

    await db.reset();
    await api.authApi.adminSignUp(server);
    const admin = await api.authApi.adminLogin(server);

    await Promise.all([
      api.userApi.create(server, admin.accessToken, user1Dto),
      api.userApi.create(server, admin.accessToken, user2Dto),
      api.userApi.create(server, admin.accessToken, user3Dto),
    ]);

    [user1, user2, user3] = await Promise.all([
      api.authApi.login(server, { email: user1Dto.email, password: user1Dto.password }),
      api.authApi.login(server, { email: user2Dto.email, password: user2Dto.password }),
      api.authApi.login(server, { email: user3Dto.email, password: user3Dto.password }),
    ]);

    await Promise.all([
      api.partnerApi.create(server, user1.accessToken, user2.userId),
      api.partnerApi.create(server, user2.accessToken, user1.userId),
    ]);
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe('GET /partner', () => {
    it('should require authentication', async () => {
      const { status, body } = await request(server).get('/partner');

      expect(status).toBe(401);
      expect(body).toEqual(errorStub.unauthorized);
    });

    it('should get all partners shared by user', async () => {
      const { status, body } = await request(server)
        .get('/partner')
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .query({ direction: PartnerDirection.SharedBy });

      expect(status).toBe(200);
      expect(body).toEqual([expect.objectContaining({ id: user2.userId })]);
    });

    it('should get all partners that share with user', async () => {
      const { status, body } = await request(server)
        .get('/partner')
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .query({ direction: PartnerDirection.SharedWith });

      expect(status).toBe(200);
      expect(body).toEqual([expect.objectContaining({ id: user2.userId })]);
    });
  });

  describe('POST /partner/:id', () => {
    it('should require authentication', async () => {
      const { status, body } = await request(server).post(`/partner/${user3.userId}`);

      expect(status).toBe(401);
      expect(body).toEqual(errorStub.unauthorized);
    });

    it('should share with new partner', async () => {
      const { status, body } = await request(server)
        .post(`/partner/${user3.userId}`)
        .set('Authorization', `Bearer ${user1.accessToken}`);

      expect(status).toBe(201);
      expect(body).toEqual(expect.objectContaining({ id: user3.userId }));
    });

    it('should not share with new partner if already sharing with this partner', async () => {
      const { status, body } = await request(server)
        .post(`/partner/${user2.userId}`)
        .set('Authorization', `Bearer ${user1.accessToken}`);

      expect(status).toBe(400);
      expect(body).toEqual(expect.objectContaining({ message: 'Partner already exists' }));
    });
  });

  describe('PUT /partner/:id', () => {
    it('should require authentication', async () => {
      const { status, body } = await request(server).put(`/partner/${user2.userId}`);

      expect(status).toBe(401);
      expect(body).toEqual(errorStub.unauthorized);
    });

    it('should update partner', async () => {
      const { status, body } = await request(server)
        .put(`/partner/${user2.userId}`)
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .send({ inTimeline: false });

      expect(status).toBe(200);
      expect(body).toEqual(expect.objectContaining({ id: user2.userId, inTimeline: false }));
    });
  });

  describe('DELETE /partner/:id', () => {
    it('should require authentication', async () => {
      const { status, body } = await request(server).delete(`/partner/${user3.userId}`);

      expect(status).toBe(401);
      expect(body).toEqual(errorStub.unauthorized);
    });

    it('should delete partner', async () => {
      const { status } = await request(server)
        .delete(`/partner/${user3.userId}`)
        .set('Authorization', `Bearer ${user1.accessToken}`);

      expect(status).toBe(200);
    });

    it('should throw a bad request if partner not found', async () => {
      const { status, body } = await request(server)
        .delete(`/partner/${user3.userId}`)
        .set('Authorization', `Bearer ${user1.accessToken}`);

      expect(status).toBe(400);
      expect(body).toEqual(expect.objectContaining({ message: 'Partner not found' }));
    });
  });
});
