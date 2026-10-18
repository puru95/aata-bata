// Builds the browser bundle + CSS (inlined into pages by the server) and, with --server, the server bundle.
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const server = process.argv.includes("--server");

if (server) {
  await esbuild.build({
    entryPoints: ["src/server.ts"],
    outfile: "dist/server.js",
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    packages: "external",
    jsx: "automatic",
    jsxImportSource: "hono/jsx",
    sourcemap: true,
  });
  console.log("built dist/server.js");
} else {
  const opts = [
    { entryPoints: ["src/client/builder.ts"], outfile: "dist/client/builder.js", bundle: true, format: "iife", target: "es2020", minify: true },
    { entryPoints: ["src/client/styles.css"], outfile: "dist/client/styles.css", bundle: true, minify: true, target: ["chrome90", "safari14"] },
  ];
  if (watch) {
    for (const o of opts) await (await esbuild.context(o)).watch();
    console.log("watching client files…");
  } else {
    await Promise.all(opts.map((o) => esbuild.build(o)));
    console.log("built dist/client");
  }
}
