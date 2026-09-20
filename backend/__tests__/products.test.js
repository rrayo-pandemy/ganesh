const request = require('supertest');

const app = require('../src/app');

describe('GET /api/v1/products', () => {
  it('returns a product list', async () => {
    const response = await request(app).get('/api/v1/products');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});

