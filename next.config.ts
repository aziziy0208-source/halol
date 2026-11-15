import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
// Vercel builds its own function bundles; the standalone server is for the Docker image.
const onVercel = Boolean(process.env.VERCEL);

// Security headers for every response (spec §9). The CSP blocks clickjacking, <base>
// hijacking, plugin content and cross-site form posts. It deliberately has no
// script-src: Next.js needs inline scripts, and a nonce-based policy would force every
// page to render dynamically (no static pages). XSS is handled at the source instead —
// React escapes all output, certificate HTML is escaped by the template and shown only
// in a sandboxed iframe, and uploaded images are re-encoded.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  // Browsers only honour HSTS over HTTPS. No includeSubDomains: other WHU
  // subdomains (mail, legacy hosts) might not serve HTTPS yet.
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  ...(onVercel ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  // Hero and parallax photos are served at quality 70 (Next 16 only allows listed values).
  images: { qualities: [70, 75] },
  // Functions only receive files the build traces. playwright-core loads files dynamically
  // (browsers.json …) and the renderer reads the template assets from public/certificate,
  // so both are added explicitly — needed on Vercel. (The Dockerfile copies them as well.)
  outputFileTracingIncludes: {
    "/admin/**": ["./public/certificate/**/*", "./node_modules/playwright-core/**/*"],
    "/v/**": ["./public/certificate/**/*", "./node_modules/playwright-core/**/*"],
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Signature/stamp uploads (≤ 2 MB) and legacy CSV imports (≤ 4 MB) are sent to server actions.
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Public verification pages and their files are never indexed (spec §8.2).
      { source: "/v/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // Certificate fonts/logo (public, OFL fonts) are loaded by the sandboxed preview
      // iframe, whose origin is opaque: font requests need CORS.
      { source: "/certificate/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
    ];
  },
};

export default nextConfig;
