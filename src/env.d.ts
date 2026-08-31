/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /** Verified session user, or null when unauthenticated. Set by src/middleware.ts. */
    user: import('./lib/session').SessionUser | null;
    /** Resolved runtime bindings (Cloudflare env, or process.env locally). */
    env: Record<string, unknown> | null;
    /** Per-request CSP nonce, injected into every <script>/<style> tag. */
    cspNonce: string;
    /** Provided by the Cloudflare adapter. */
    runtime?: {
      env: Record<string, unknown>;
      cf?: unknown;
      caches?: unknown;
      ctx?: { waitUntil: (promise: Promise<unknown>) => void };
    };
  }
}
