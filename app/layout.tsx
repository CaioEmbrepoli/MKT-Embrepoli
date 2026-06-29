import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRegistrar } from "./PwaRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://app.embrepoli.com.br"),
  title: "Gestão Embrepoli",
  description: "Gestão interna de marketing e vendas da Embrepoli",
  applicationName: "Gestão Embrepoli",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Embrepoli"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/favicon.png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    shortcut: "/favicon.png",
    apple: "/icons/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
