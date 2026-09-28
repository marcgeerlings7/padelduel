import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Instrument_Sans } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import { Providers } from "@/components/app/providers";
import "./globals.css";

// Display: Barlow Condensed — scorebord/rugnummer-karakter, smalle cijfers
// met tabular figures (ratings, rang, uitslagen). Body: Instrument Sans —
// strak, zeer leesbaar op kleine schermen, ook tabular figures.
const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Padel Ladder",
  description: "Vereniging-onafhankelijke ranked ladder voor padel-duo's",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f8" },
    { media: "(prefers-color-scheme: dark)", color: "#07112a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
      <body>
        <Providers>
          <a
            href="#inhoud"
            className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Naar inhoud
          </a>
          <div className="min-h-dvh lg:pl-64">
            <NavBar />
            {/* pb: ruimte voor de vaste tab-bar op mobiel (64px + safe area). */}
            <div id="inhoud" data-page className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
