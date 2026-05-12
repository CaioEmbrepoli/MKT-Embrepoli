import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embrepoli Marketing",
  description: "Organização interna de marketing da Embrepoli",
  icons: {
    icon: "/embrepoli-logo.png",
    shortcut: "/embrepoli-logo.png",
    apple: "/embrepoli-logo.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

