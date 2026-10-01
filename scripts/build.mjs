// Bundles src/main.ts into dist/Code.js for clasp (clasp 3 no longer transpiles TypeScript).
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { build } from "esbuild";

const OUT_DIR = "dist";

const result = await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "iife",
  platform: "neutral",
  target: "es2020",
  charset: "utf8",
  legalComments: "none",
  write: false,
});
const bundle = result.outputFiles[0].text;

/** Runs code in a sandbox (no GAS APIs) and returns the functions it leaves on globalThis. */
function exposedFunctions(code) {
  const sandbox = vm.createContext({ console });
  vm.runInContext(code, sandbox);
  return Object.fromEntries(
    Object.entries(sandbox).filter(
      ([key, value]) => key !== "console" && typeof value === "function",
    ),
  );
}

// Evaluating the bundle also fails the build if it calls a GAS API at load time.
const entryNames = Object.keys(exposedFunctions(bundle));
if (entryNames.length === 0) {
  throw new Error("No functions were exposed on globalThis by src/main.ts");
}

// Top-level declarations make the functions visible in the Apps Script editor.
// The bundle overwrites them with the real implementations when the script loads,
// so a stub only runs (and throws) if that initialization failed.
const stubs = entryNames
  .map(
    (name) =>
      `function ${name}() {\n  throw new Error("gws-automation: ${name} was not initialized");\n}`,
  )
  .join("\n");
const code = `${bundle}\n${stubs}\n`;

const stubbed = Object.entries(exposedFunctions(code)).filter(([, fn]) =>
  fn.toString().includes("was not initialized"),
);
if (stubbed.length > 0) {
  throw new Error(`Stubs were not replaced: ${stubbed.map(([name]) => name).join(", ")}`);
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(`${OUT_DIR}/Code.js`, code);
await copyFile("appsscript.json", `${OUT_DIR}/appsscript.json`);

console.log(`Built ${OUT_DIR}/Code.js (entries: ${entryNames.join(", ")})`);
