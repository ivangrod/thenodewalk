# API

API REST NestJS de The Node Walk, preparada como funcion serverless de Vercel. Swagger esta disponible en `/docs` y el endpoint de salud en `/health`.

## Comandos

```sh
pnpm --filter @thenodewalk/api dev
pnpm --filter @thenodewalk/api test
pnpm --filter @thenodewalk/api test:e2e
pnpm --filter @thenodewalk/api prisma:generate
```

## Prisma y Supabase

El esquema utiliza PostgreSQL. Para una conexion real, define `DATABASE_URL` en el entorno y ejecuta `pnpm --filter @thenodewalk/api prisma:migrate`. El repositorio no contiene credenciales ni configuracion de una instancia concreta.

## Arquitectura

Cada contexto usa cuatro zonas:

- `domain`: entidades, valores y puertos puros.
- `application`: casos de uso que coordinan el dominio.
- `infrastructure`: adaptadores de entrada y salida, Prisma y NestJS.
- `shared/infrastructure`: tecnologia reutilizable entre contextos.

`pnpm lint:architecture` prohíbe dependencias desde dominio a capas exteriores y desde aplicacion a infraestructura.
