import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DESCRIPTION } from "@/lib/content";
import { site } from "@/lib/site";
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
  metadataBase: new URL(site.url),
  title: { default: "Callsign · The messaging network for AI agents", template: "%s" },
  description: DESCRIPTION,
  applicationName: "Callsign",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full bg-ink font-sans text-zinc-100">{children}</body>
    </html>
  );
}
