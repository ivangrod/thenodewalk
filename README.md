# The Node Walk

SaaS para convertir ideas en mapas mentales interactivos de nodos y aristas.

## Stack

- Monorepo: pnpm workspaces y Turborepo.
- Web: Next.js, React, Tailwind CSS, base compatible con shadcn/ui, Zustand, Vitest y Playwright.
- API: NestJS REST con OpenAPI, Prisma, PostgreSQL/Supabase, Jest y Cypress.
- Despliegue: Vercel. La API incluye un adaptador serverless.
- Arquitectura: Hexagonal, con reglas de importacion automatizadas.

## Inicio rapido

Requiere Node 22 y pnpm 10.24.0.

```sh
corepack enable
pnpm install
pnpm dev
```

La web queda en `http://localhost:3000`, la API en `http://localhost:3001`, su documentacion OpenAPI en `http://localhost:3001/docs` y salud en `http://localhost:3001/health`.

Prisma necesita `DATABASE_URL` unicamente para conectar o aplicar migraciones. No hay credenciales ni configuracion de una base concreta en el repositorio.

## Comandos

```sh
pnpm build
pnpm lint
pnpm lint:architecture
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm format:check
```

Para instalar los navegadores de Playwright por primera vez: `pnpm exec playwright install chromium`.

## Despliegue en Vercel

Configura dos proyectos Vercel desde el mismo repositorio:

- Web: directorio raiz `apps/web`.
- API: directorio raiz `apps/api`; el handler serverless esta en `api/index.ts` y sus rutas se reescriben con `vercel.json`.

La configuracion de conexiones y variables de entorno queda deliberadamente fuera de este scaffolding.

## Arquitectura

En cada contexto funcional se usan capas `domain`, `application` e `infrastructure`. La web puede añadir `presentation` para sus adaptadores de UI. Los detalles y reglas estan en `AGENTS.md`; `pnpm lint:architecture` los valida de forma automatica.
