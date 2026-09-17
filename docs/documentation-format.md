# Documentation Standard

## Convention
Every project convention must be documented as a standalone Markdown file inside the `docs/` folder, organized by area (`backend/`, `database/`, `testing/`). 
Each document follows a fixed structure with these sections in order: **Convention, Benefits, Examples (good and bad), Real world examples, and Related agreements**. 
The goal is to provide AI agents (like GitHub Copilot / Opencode) and developers with self-contained, discoverable references that require no extra context to understand.

## Benefits
- AI agents can consume individual docs without loading the entire knowledge base, reducing token usage.
- New team members find conventions faster through a browsable folder structure.
- The fixed structure ensures consistency and completeness across all documented conventions.

## Examples

### ✅ Good: Well-structured convention document
```markdown
# Name of the convention

## Convention
Convention description.

## Benefits
- List of why to use this convention.

## Examples
### ✅ Good
good example

### ❌ Bad
bad example

## Real world examples
- Links to files following this convention

## Related agreements
- Links to related agreements
```

## Related agreements
- All docs inside `docs/` must follow this standard.
