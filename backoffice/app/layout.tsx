import type { Metadata } from "next";
import { Oswald, Public_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";

// Same type pairing as frontdesk: Oswald for display and numbers, Public Sans for body
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-public-sans",
});

export const metadata: Metadata = {
  title: "UGSP Backoffice",
  description: "Unified Government Service Platform — Staff Backoffice",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("h-full antialiased", oswald.variable, publicSans.variable)}>
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
          <Toaster theme="light" richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
