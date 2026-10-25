import { readFileSync } from "node:fs";

// The CSS and builder JS are small enough to inline, so a page is one request.
// Production bundles get them baked in at build time (see scripts/build.mjs); dev reads dist/client on each request.
declare const __INLINE_CSS__: string | undefined;
declare const __INLINE_JS__: string | undefined;

const baked = { "styles.css": typeof __INLINE_CSS__ === "string" ? __INLINE_CSS__ : undefined, "builder.js": typeof __INLINE_JS__ === "string" ? __INLINE_JS__ : undefined };

function read(file: keyof typeof baked) {
  const b = baked[file];
  if (b !== undefined) return b;
  try {
    return readFileSync(`dist/client/${file}`, "utf8");
  } catch {
    throw new Error(`Missing dist/client/${file}. Run \`node scripts/build.mjs\` first.`);
  }
}

export const css = () => read("styles.css");
export const builderJs = () => read("builder.js");

// Wheat-field background photo (~21 KB WebP). Served at a versioned URL with a long cache; rename the URL if the file changes.
declare const __INLINE_BG__: string | undefined;
let bg: Buffer | undefined;
export const backgroundWebp = () => (bg ??= typeof __INLINE_BG__ === "string" ? Buffer.from(__INLINE_BG__, "base64") : readFileSync("src/client/wheat.webp"));
