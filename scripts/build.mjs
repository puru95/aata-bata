// Builds the browser bundle + CSS, and optionally a server bundle:
//   node scripts/build.mjs            → dist/client (inlined into pages)
//   node scripts/build.mjs --watch    → same, rebuilding on change
//   node scripts/build.mjs --server   → dist/server.js (Node host)
//   node scripts/build.mjs --vercel   → .vercel/output (Vercel Build Output API, Mumbai region)
import * as esbuild from "esbuild";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const clientOpts = [
  { entryPoints: ["src/client/builder.ts"], outfile: "dist/client/builder.js", bundle: true, format: "iife", target: "es2020", minify: true },
  { entryPoints: ["src/client/styles.css"], outfile: "dist/client/styles.css", bundle: true, minify: true, external: ["/bg-*"], target: ["chrome90", "safari14"] },
];

async function buildClient() {
  await Promise.all(clientOpts.map((o) => esbuild.build(o)));
  console.log("built dist/client");
}

/** Server bundle with the client CSS/JS baked in as string constants. */
async function buildServer(entry, outfile, extra = {}) {
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    jsx: "automatic",
    jsxImportSource: "hono/jsx",
    sourcemap: true,
    define: {
      __INLINE_CSS__: JSON.stringify(readFileSync("dist/client/styles.css", "utf8")),
      __INLINE_JS__: JSON.stringify(readFileSync("dist/client/builder.js", "utf8")),
      __INLINE_BG__: JSON.stringify(readFileSync("src/client/wheat.webp").toString("base64")),
      "process.env.NODE_ENV": '"production"',
    },
    // Some bundled CommonJS deps call require(); give ESM a require().
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    ...extra,
  });
  console.log("built " + outfile);
}

if (args.has("--watch")) {
  for (const o of clientOpts) await (await esbuild.context(o)).watch();
  console.log("watching client files…");
} else if (args.has("--server")) {
  await buildServer("src/server.ts", "dist/server.js", { packages: "external", banner: {} });
} else if (args.has("--vercel")) {
  await buildClient();
  const out = ".vercel/output";
  rmSync(out, { recursive: true, force: true });
  const fn = `${out}/functions/index.func`;
  mkdirSync(fn, { recursive: true });
  // Everything is bundled into one file; the local-only PGlite driver is left out.
  await buildServer("src/vercel.ts", `${fn}/index.mjs`, { external: ["@electric-sql/pglite", "drizzle-orm/pglite", "drizzle-orm/pglite/*"] });
  writeFileSync(`${fn}/.vc-config.json`, JSON.stringify({ runtime: "nodejs24.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, regions: ["bom1"], maxDuration: 15 }, null, 2));
  writeFileSync(`${fn}/package.json`, JSON.stringify({ type: "module" }));
  writeFileSync(`${out}/config.json`, JSON.stringify({ version: 3, routes: [{ src: "/(.*)", dest: "/index" }] }, null, 2));
  console.log("built " + out);
} else {
  await buildClient();
}
