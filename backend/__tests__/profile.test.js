const request = require('supertest');
const app = require('../src/app');

jest.setTimeout(15000);

describe('Profile: avatar upload/delete and favorites', () => {
  const agent = request.agent(app);
  let avatarUrl = null;

  beforeAll(async () => {
    // login seeded admin user (cookie is stored in agent)
    const res = await agent.post('/api/v1/auth/login').send({
      email: 'admin@elrinconazul.com',
      password: 'Admin1234',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  it('uploads an avatar (data URL) and serves it, then deletes it', async () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

    const uploadRes = await agent.post('/api/v1/me/avatar').send({ avatar: dataUri });
    expect(uploadRes.statusCode).toBe(200);
    expect(uploadRes.body).toHaveProperty('success', true);
    expect(uploadRes.body).toHaveProperty('avatar_url');
    avatarUrl = uploadRes.body.avatar_url;
    expect(typeof avatarUrl).toBe('string');
    expect(avatarUrl).toMatch(/uploads\/avatars\//);

    // The uploaded file should be served by the static uploads route
    const fileRes = await request(app).get(avatarUrl);
    expect([200, 304]).toContain(fileRes.statusCode);
    expect(fileRes.headers['content-type']).toMatch(/image\//);

    // Delete the avatar via API
    const delRes = await agent.delete('/api/v1/me/avatar');
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body).toHaveProperty('success', true);

    // The file should no longer be available
    const fileResAfter = await request(app).get(avatarUrl);
    expect(fileResAfter.statusCode).toBe(404);
  });

  it('adds, lists and removes favorites', async () => {
    // Ensure product 1 exists in seeded data
    const addRes = await agent.post('/api/v1/me/favorites').send({ productId: 1 });
    expect(addRes.statusCode).toBe(200);
    expect(addRes.body).toHaveProperty('success', true);

    const listRes = await agent.get('/api/v1/me/favorites');
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body).toHaveProperty('success', true);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    // favorites should include product id 1
    expect(listRes.body.data.find((p) => p.id === 1)).toBeDefined();

    const delRes = await agent.delete('/api/v1/me/favorites/1');
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body).toHaveProperty('success', true);

    const listAfter = await agent.get('/api/v1/me/favorites');
    expect(listAfter.statusCode).toBe(200);
    expect(Array.isArray(listAfter.body.data)).toBe(true);
    // favorites for this user should be empty (or not contain product 1)
    expect(listAfter.body.data.find((p) => p.id === 1)).toBeUndefined();
  });
});
