# API

The Node Walk NestJS REST API, prepared as a Vercel serverless function. Swagger is available at `/docs` and the health endpoint at `/health`.

## Commands

```sh
pnpm --filter @thenodewalk/api dev
pnpm --filter @thenodewalk/api test
pnpm --filter @thenodewalk/api test:e2e
pnpm --filter @thenodewalk/api prisma:generate
```

## Prisma and Supabase

The schema uses PostgreSQL. For a real connection, define `DATABASE_URL` in the environment and run `pnpm --filter @thenodewalk/api prisma:migrate`. The repository contains no credentials or configuration for a specific instance.

## Architecture

Each context uses four areas:

- `domain`: pure entities, values, and ports.
- `application`: use cases that coordinate the domain.
- `infrastructure`: inbound and outbound adapters, Prisma, and NestJS.
- `shared/infrastructure`: reusable technology shared between contexts.

`pnpm lint:architecture` prohibits dependencies from the domain to outer layers and from application to infrastructure.
