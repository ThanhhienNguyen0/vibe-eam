import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is not set. Create apps/api/.env (or use .env.example) and start Postgres (docker compose up -d).',
      );
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
