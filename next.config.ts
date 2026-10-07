import type { NextConfig } from "next";

const pagesExport = process.env.OUR_MILES_PAGES_EXPORT === "true";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
if (basePath && (!basePath.startsWith("/") || /[?#\\]|\/\//.test(basePath) || basePath.split("/").some((part) => part === "." || part === ".."))) {
  throw new Error("NEXT_PUBLIC_BASE_PATH must be an absolute URL path without a trailing slash, query or traversal.");
}

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  devIndicators: false,
  basePath,
  ...(pagesExport ? {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
    env: { NEXT_PUBLIC_HOSTING_MODE: "pages" },
  } : {}),
  ...(!pagesExport ? { async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  } } : {}),
};
export default nextConfig;
