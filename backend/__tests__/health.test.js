const request = require('supertest');

const app = require('../src/app');

describe('GET /api/health', () => {
  it('returns 200 and basic health payload', async () => {
    const response = await request(app).get('/api/health');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('service');
  });
});
