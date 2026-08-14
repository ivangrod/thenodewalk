# Instrucciones para GitHub Copilot

Lee `AGENTS.md` antes de editar. Aplica Arquitectura Hexagonal estricta, TypeScript estricto y las convenciones del monorepo `pnpm`/Turborepo.

- No permitas imports hacia dentro de `domain` desde `application`, `infrastructure`, `presentation`, NestJS, Prisma, React o Next.js.
- Define un caso de uso en `application` antes de crear controladores, repositorios Prisma o componentes de interfaz.
- En la API, los controladores son adaptadores HTTP finos: validan y delegan en un caso de uso.
- En la web, prioriza Server Components y carga diferida para dependencias de edicion de grafos; Zustand es solo para estado cliente compartido.
- Mantiene a11y y Core Web Vitals. Añade pruebas unitarias con Vitest/Jest y E2E con Playwright/Cypress según corresponda.
- Ejecuta `pnpm lint:architecture` al tocar capas o imports.
