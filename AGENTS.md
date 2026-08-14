# The Node Walk - Instrucciones de desarrollo

## Contexto

The Node Walk es un SaaS para crear mapas mentales como grafos. Un mapa contiene nodos y aristas; cada nodo puede abrir una tarjeta visual con informacion adicional.

## Principios obligatorios

- Todo el codigo de produccion y pruebas usa TypeScript estricto.
- Conserva la Arquitectura Hexagonal. El dominio no importa frameworks, NestJS, Prisma, Next.js, React ni adaptadores de red.
- Los casos de uso viven en `application` y dependen de puertos definidos hacia dentro. Las implementaciones de puertos pertenecen a `infrastructure`.
- No accedas a Prisma desde controladores ni casos de uso. Introduce un puerto de repositorio en el dominio o aplicacion y un adaptador Prisma en infraestructura.
- En el frontend, el estado del servidor debe quedarse cerca de su limite de datos; usa Zustand solo para estado cliente compartido e interactivo.
- Mantiene los componentes accesibles: HTML semantico, controles con nombre accesible, teclado, foco visible y contraste suficiente.
- Evita dependencias de cliente innecesarias y revisa Core Web Vitals al añadir interfaces de grafos o librerias de visualizacion.

## Estructura

- `apps/web`: Next.js y la interfaz.
- `apps/api`: NestJS, Prisma y API REST.
- `packages/contracts`: contratos TypeScript intercambiados entre aplicaciones.
- `packages/typescript-config`: configuracion TypeScript comun.

Cada funcionalidad se organiza por contexto, no por tipo global. Ejemplo: `apps/api/src/mind-map/{domain,application,infrastructure}`.

## Verificacion requerida

Ejecuta antes de dar una tarea por terminada:

```sh
pnpm format:check
pnpm lint
pnpm lint:architecture
pnpm typecheck
pnpm test
```

Las pruebas E2E se ejecutan de forma separada con `pnpm test:e2e`. Playwright comprueba tambien accesibilidad con axe.
