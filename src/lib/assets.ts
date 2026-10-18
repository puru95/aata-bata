import { readFileSync } from "node:fs";

// The CSS and builder JS are small enough to inline, so a page is one request.
const dev = process.env.NODE_ENV !== "production";
const cache = new Map<string, string>();

function read(file: string) {
  if (!dev && cache.has(file)) return cache.get(file)!;
  let text = "";
  try {
    text = readFileSync(new URL(`../../dist/client/${file}`, import.meta.url), "utf8");
  } catch {
    try {
      text = readFileSync(`dist/client/${file}`, "utf8");
    } catch {
      throw new Error(`Missing dist/client/${file}. Run \`node scripts/build.mjs\` first.`);
    }
  }
  cache.set(file, text);
  return text;
}

export const css = () => read("styles.css");
export const builderJs = () => read("builder.js");
