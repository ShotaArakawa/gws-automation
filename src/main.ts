/**
 * Entry point bundled into dist/Code.js.
 *
 * Apps Script calls functions by name (triggers, menu items, editor runs), so every such
 * function must be exposed on globalThis. scripts/build.mjs detects them and adds top-level
 * declarations so they also appear in the Apps Script editor.
 */

/** Run from the Apps Script editor to confirm that `pnpm push` updated the script. */
function healthCheck(): string {
  const message = "gws-automation is ready";
  console.log(message);
  return message;
}

export const gasEntries = { healthCheck };

Object.assign(globalThis, gasEntries);
