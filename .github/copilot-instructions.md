# GitHub Copilot Instructions

Read `AGENTS.md` before editing. Apply strict Hexagonal Architecture, strict TypeScript, and the `pnpm`/Turborepo monorepo conventions.

- Do not allow imports into `domain` from `application`, `infrastructure`, `presentation`, NestJS, Prisma, React, or Next.js.
- Define a use case in `application` before creating controllers, Prisma repositories, or interface components.
- In the API, controllers are thin HTTP adapters: they validate and delegate to a use case.
- On the web, prioritize Server Components and deferred loading for graph editing dependencies; Zustand is only for shared client state.
- Maintain a11y and Core Web Vitals. Add unit tests with Vitest/Jest and E2E tests with Playwright/Cypress as appropriate.
- Run `pnpm lint:architecture` when modifying layers or imports.
