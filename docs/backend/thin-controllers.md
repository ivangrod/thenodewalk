# Thin NestJS Controllers

## Convention
API endpoints (NestJS Controllers in the `infrastructure` layer) must be thin. They receive the HTTP request, resolve the appropriate Command or Query from the application layer, execute it, and map the result to an HTTP response. They must **not** contain business logic.

## Benefits
- Business logic stays testable through unit tests against use cases, without needing HTTP infrastructure.
- Controllers become trivially simple.

## Examples

### ✅ Good: Thin Controller
```typescript
@Controller('nodes')
export class NodeController {
  constructor(
    private readonly createNodeCommand: CreateNodeCommand,
    private readonly findNodeQuery: FindNodeQuery
  ) {}

  @Post()
  async create(@Body() body: CreateNodeDto) {
    await this.createNodeCommand.execute(body.id, body.label);
  }
}
```

### ❌ Bad: Business logic in Controller
```typescript
@Controller('nodes')
export class NodeController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() body: CreateNodeDto) {
    // ❌ Logic and infrastructure coupled in the controller
    if (body.label.length < 3) throw new BadRequestException();
    await this.prisma.node.create({ data: body });
  }
}
```
