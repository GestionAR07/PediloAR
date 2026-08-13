/**
 * Preload hook so this Node harness can import Next `server-only` modules.
 * Pass as: node --import ./scripts/stub-server-only.mjs --import tsx ...
 */
import { register } from "node:module";

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === "server-only") {
        return { shortCircuit: true, url: "data:text/javascript,export {}" };
      }
      return nextResolve(specifier, context);
    }
  `)}`,
  import.meta.url,
);
