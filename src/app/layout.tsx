import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CV Match — Skrining CV",
  description:
    "Saring puluhan hingga ratusan CV berdasarkan satu lowongan: ekstraksi PDF/DOCX, evaluasi berbasis bukti, peringkat kandidat, dan ekspor CSV untuk Excel.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f5f0",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
