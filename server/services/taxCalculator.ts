// Re-export shim. The calculator was split into domain modules under
// ./tax/. Existing callers importing from this path keep working; new callers
// should import from ./tax/index.js (or a specific module) directly.
export * from './tax/index.js';
