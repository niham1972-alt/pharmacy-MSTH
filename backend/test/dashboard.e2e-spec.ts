import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { globalValidationPipe } from '../src/common/pipes/validation-pipe.config';
import { DashboardCacheService } from '../src/modules/dashboard/cache/dashboard-cache.service';

const JWT_SECRET = 'test-secret-for-e2e';

function signToken(overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      sub: 'user-e2e-1',
      email: 'e2e@example.com',
      app_metadata: {
        role: 'admin',
        pharmacyId: 'pharmacy-e2e',
        branchId: 'branch-e2e',
        accessibleBranchIds: ['branch-e2e'],
        ...overrides,
      },
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

class InMemoryCacheService {
  private store = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
  async invalidate(): Promise<void> {
    this.store.clear();
  }
}

function buildPrismaMock() {
  return {
    pharmacySettings: { findUnique: jest.fn().mockResolvedValue(null) },
    sale: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 1000 }, _count: { _all: 5 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    expense: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 200 } }) },
    purchaseOrder: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 300 } }),
      count: jest.fn().mockResolvedValue(2),
      findMany: jest.fn().mockResolvedValue([]),
    },
    medicine: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
    },
    medicineBatch: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    dashboardAlertAcknowledgement: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    dashboardWidgetPreference: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
    auditLog: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockImplementation((sql: { strings?: string[] }) => {
      const text = Array.isArray(sql?.strings) ? sql.strings.join('') : '';
      if (text.includes('profit')) return Promise.resolve([{ profit: 100 }]);
      if (text.includes('COUNT(*)')) return Promise.resolve([{ count: 0n }]);
      return Promise.resolve([]);
    }),
  };
}

describe('Dashboard API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
    process.env.REDIS_ENABLED = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(buildPrismaMock())
      .overrideProvider(DashboardCacheService)
      .useClass(InMemoryCacheService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(globalValidationPipe);
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests without a JWT with 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with the standard success envelope for a valid JWT', async () => {
    const token = signToken();
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: expect.any(String),
    });
    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toBeDefined();
  });

  it('returns 403 BRANCH_ACCESS_DENIED when branchId is outside the token claims', async () => {
    const token = signToken();
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/summary?branchId=11111111-1111-4111-8111-111111111111')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('BRANCH_ACCESS_DENIED');
  });

  it('returns identical data shape on cache-miss and cache-hit paths', async () => {
    const token = signToken();
    const first = await request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);
    const second = await request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(first.body.data).toEqual(second.body.data);
  });

  it('exposes an unauthenticated health check', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
  });
});
