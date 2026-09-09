import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const inter = Inter({
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Spotz — Find the moves for tonight",
  description:
    "Yurrrrr. Say the vibe and Spotz finds the moves — curated events, functions, popups, and food spots in NYC. Share the plan, let the crew vote.",
};

/**
 * `viewportFit: 'cover'` is what makes `env(safe-area-inset-*)` report real
 * values on notched devices — without it every inset resolves to 0 and the
 * bottom tab bar sits under the home indicator.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e8f1fb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${instrumentSerif.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
