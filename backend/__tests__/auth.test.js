const request = require('supertest');

const app = require('../src/app');

describe('POST /api/v1/auth/login', () => {
  it('logs in seeded admin user', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elrinconazul.com',
      password: 'Admin1234',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user.email', 'admin@elrinconazul.com');
  });

  it('returns success on logout route used by admin frontend', async () => {
    const response = await request(app).post('/api/v1/auth/logout');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'Logout exitoso');
  });
});
