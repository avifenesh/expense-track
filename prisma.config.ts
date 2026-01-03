import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env file
config();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'npx ts-node --compiler-options {"module":"commonjs"} prisma/seed.ts',
  },
});
