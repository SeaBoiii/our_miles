import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Our Miles · Every day, a little closer",
  description:
    "A private shared wallet for Aleem and Nurul. Find the best card for your next purchase.",
  applicationName: "Our Miles",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Our Miles" },
  manifest: `${basePath}/manifest.webmanifest`,
  icons: { icon: `${basePath}/icons/icon-192.png`, apple: `${basePath}/icons/apple-touch-icon.png` },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f2e8",
  interactiveWidget: "resizes-content",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
