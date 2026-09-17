# Turborepo Configuration

## Convention
Task orchestration and caching are strictly managed by Turborepo via `turbo.json`. 
- Global commands in the root `package.json` must delegate to `turbo run <command>` rather than using recursive workspace scripts.
- Every task defined in `turbo.json` must declare its dependencies (`dependsOn`), file `inputs`, and build `outputs` to ensure maximum cache hits.
- Environment variables that alter build outputs must be explicitly listed in the `env` or `globalEnv` array inside `turbo.json`.

## Benefits
- **Performance:** Speeds up local development and CI pipelines by caching unchanged tasks.
- **Reliability:** Explicit topological pipelines (`dependsOn: ["^build"]`) guarantee that internal packages (like `contracts`) are built before the apps that consume them.
- **Maintainability:** Provides a clean, centralized view of how scripts interact across the monorepo.

## Examples

### ✅ Good: Explicit pipeline with caching
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"],
      "env": ["NEXT_PUBLIC_API_URL"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### ❌ Bad: Missing dependencies or inputs
```json
{
  "pipeline": {
    "build": {
      // ❌ Missing "^build" means apps might build before their packages are ready
      "outputs": ["dist/**"]
      // ❌ Missing "env" means Vercel cache might serve the wrong build for a different environment
    }
  }
}
```

## Real world examples
- Turbo config: `turbo.json`
- Root scripts: `package.json`

## Related agreements
- [Code Style](../code-style.md)
