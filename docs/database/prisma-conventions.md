# Prisma Database Conventions

## Convention
Database schemas are defined in Prisma (`schema.prisma`). We maintain specific conventions for models:
- **Naming:** Use **PascalCase** for models (Prisma convention) which maps to plural tables in the DB using `@@map("plural_name")`.
- **Primary Keys:** Use `String @id @default(uuid())` mapped to UUIDs.
- **Timestamps:** Every model must have `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
- **Required fields:** Prefer required fields (Not Null) unless the business logic dictates the field is truly optional.

## Benefits
- Consistent schema mapping between object-oriented code and PostgreSQL.
- UUIDs prevent enumeration attacks and simplify distributed creation.
- Hardcoded timestamps enable easy auditing.

## Examples

### ✅ Good: Prisma model following conventions
```prisma
model MindMap {
  id          String   @id @default(uuid())
  title       String   @db.VarChar(200)
  description String?  // Only optional because business logic allows it
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("mind_maps") // Mapped to plural in PostgreSQL
}
```

### ❌ Bad: Ignoring conventions
```prisma
model map { // Not PascalCase
  id          Int      @id @default(autoincrement()) // Using autoincrement instead of UUID
  title       String?  // Nullable without business reason
  // Missing createdAt and updatedAt
}
```
