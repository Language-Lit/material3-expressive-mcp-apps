# Repository instructions

Read docs/SPEC.md, docs/ACTIVE_TASK.md, docs/ARCHITECTURE.md and relevant ADRs
before changing implementation. Work only within the recorded task. Consume
the Material library through public exports. Do not inspect private consumers.
Keep host, app, protocol helpers, styles and tests in their documented trees.
No runtime dependencies or public path changes without an approved ADR.
Run npm run verify and npm run playground:build before completion, plus browser
checks for iframe behavior or layout. Regenerate build artifacts; do not edit
them. Do not publish or commit unless asked.
