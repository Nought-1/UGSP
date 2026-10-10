import type { Metadata } from "next";
import { Noto_Sans_Devanagari, Noto_Sans_Gujarati, Oswald, Public_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  weight: ["400", "500", "600", "700"],
});

// Hindi and Gujarati glyphs (the language switcher); used as fallbacks after Oswald / Public Sans
const notoDeva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-deva",
  weight: ["400", "600", "700"],
});

const notoGuj = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  variable: "--font-noto-guj",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "UGSP – Unified Government Service Platform",
  description:
    "Citizens take a virtual token for government offices, see live predicted waiting time, and arrive only when their turn is near.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${publicSans.variable} ${notoDeva.variable} ${notoGuj.variable}`}
    >
      <body className="bg-cream text-ink min-h-screen flex flex-col antialiased">
        <Providers>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
