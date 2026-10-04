import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yuhpp | The Job Search System",
  description: "Your job search workspace: every step of the method, in one place.",
};

// Fonts load from Google Fonts with a stylesheet link rather than next/font,
// so builds never depend on downloading font files.
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>{children}</body>
    </html>
  );
}
