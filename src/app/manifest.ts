import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  const root = `${basePath}/`;
  return {
    id: root,
    name: "Our Miles",
    short_name: "Our Miles",
    description: "The best next card. A private wallet for Aleem and Nurul.",
    start_url: `${root}?installed=1`,
    scope: root,
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7f2e8",
    theme_color: "#f7f2e8",
    lang: "en-SG",
    icons: [
      {
        src: `${basePath}/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icons/maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${basePath}/icons/icon.svg`,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    categories: ["finance", "productivity"],
  };
}
