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
        <header className="sticky top-0 z-10 border-b border-black/5 bg-background/80 backdrop-blur dark:border-white/10">
          <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3.5">
            <Link href="/" className="text-lg font-semibold tracking-tight text-wine">
              🍷 VinoBuzz <span className="font-normal text-foreground/70">Journal</span>
            </Link>
            <div className="flex items-center gap-5 text-sm font-medium">
              <Link href="/" className="text-foreground/70 hover:text-wine">
                Capture
              </Link>
              <Link href="/journal" className="text-foreground/70 hover:text-wine">
                Journal
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-black/5 py-6 text-center text-xs text-foreground/40 dark:border-white/10">
          VinoBuzz Wine Journal · AI recognition with honest confidence
        </footer>
      </body>
    </html>
  );
}
