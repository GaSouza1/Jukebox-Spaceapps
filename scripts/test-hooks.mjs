/**
 * Lets `node --test` run the TypeScript sources as Vite resolves them:
 * extensionless relative imports and the `@/` alias for `src/`.
 * Node strips the types itself (Node 22.18+ / 24).
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const src = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) specifier = new URL(specifier.slice(2), src).href;
    const relative = specifier.startsWith(".") || specifier.startsWith("file:");
    if (relative && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      const base = new URL(specifier, context.parentURL).href;
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(new URL(base + suffix))) return next(base + suffix, context);
      }
    }
    return next(specifier, context);
  },
});
