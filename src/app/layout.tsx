import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CosmeWeb — Groothandel voor professionals",
  description:
    "B2B-webshop voor zakelijke inkoop: bestel je volledige assortiment via één account, met duidelijke facturatie achteraf.",
};

// Deliberately minimal: the storefront look (header/footer) lives in
// (storefront)/layout.tsx and the admin panel has its own distinct shell
// in admin/layout.tsx — they should never look like the same site.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
