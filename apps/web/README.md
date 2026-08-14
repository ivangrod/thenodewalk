# Web

Aplicacion Next.js de The Node Walk. La UI usa Tailwind CSS, componentes compatibles con shadcn/ui y Zustand para estado cliente puntual.

## Comandos

```sh
pnpm --filter @thenodewalk/web dev
pnpm --filter @thenodewalk/web test
pnpm --filter @thenodewalk/web test:e2e
```

Antes de ejecutar Playwright por primera vez instala el navegador con `pnpm exec playwright install chromium`.

## Arquitectura

Cada funcionalidad vive en `src/features/<feature>/`:

- `domain`: reglas y tipos puros, sin dependencias de framework.
- `application`: casos de uso y puertos.
- `infrastructure`: adaptadores HTTP, persistencia o navegador.
- `presentation`: componentes y rutas de interfaz.

`pnpm lint:architecture` impide que las capas interiores importen las exteriores.
