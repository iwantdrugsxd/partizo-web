import type { Metadata, Viewport } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";

const display = Poppins({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Partizo - Vibe. Connect. Meet.",
  description:
    "Find your people through vibe-based matching, plan outings, and turn strangers into your next crew.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#120E1C",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-body min-h-[100dvh] bg-vibe-ink">
        <SettingsProvider>
          <AuthProvider>
            <div className="relative mx-auto min-h-[100dvh] max-w-md overflow-hidden bg-vibe-ink shadow-2xl">
              {children}
            </div>
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
