import type { Metadata } from "next";
import "./globals.css";
import { geistSans } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Scengen",
  description: "Scengen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.className} antialiased`}>{children}</body>
    </html>
  );
}
