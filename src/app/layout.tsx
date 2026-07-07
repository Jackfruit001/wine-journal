import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "VinoBuzz Wine Journal",
  description: "Photograph a wine label, and let AI journal it for you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-black/5 bg-background/90 backdrop-blur">
          <nav className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight text-wine">
              🍷 VinoBuzz Journal
            </Link>
            <Link
              href="/journal"
              className="text-sm font-medium text-foreground/70 hover:text-wine"
            >
              Journal
            </Link>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
