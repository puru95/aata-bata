import type { Child } from "hono/jsx";
import { raw } from "hono/html";
import { css } from "../lib/assets";
import { BRAND } from "../config";

export function Layout(props: { title?: string; description?: string; children: Child; script?: string; bodyClass?: string; noindex?: boolean }) {
  const title = props.title ? `${props.title} · ${BRAND.name}` : `${BRAND.name} · ${BRAND.tagline}`;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{title}</title>
        <meta name="description" content={props.description ?? BRAND.description} />
        <meta name="theme-color" content="#2f4237" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={props.description ?? BRAND.description} />
        {props.noindex ? <meta name="robots" content="noindex" /> : null}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <style>{raw(css())}</style>
      </head>
      <body class={props.bodyClass}>
        {props.children}
        {props.script ? <script>{raw(props.script)}</script> : null}
      </body>
    </html>
  );
}

export const Brand = (props: { href?: string }) => (
  <a class="brand" href={props.href ?? "/"}>
    <span class="mark" aria-hidden="true" />
    {BRAND.name}
  </a>
);

export const Check = (props: { size?: number }) => (
  <svg viewBox="0 0 16 16" width={props.size ?? 12} height={props.size ?? 12} aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);

export const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3Z"
    />
  </svg>
);
