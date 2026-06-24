import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  applicationName: "Notescape",
  title: {
    default: "Notescape | Industrial Workspace",
    template: "%s | Notescape",
  },
  description: "A hardware-inspired workspace for notes, tasks, and planning.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Notescape",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-icon.svg", sizes: "180x180", type: "image/svg+xml" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F0E8" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1A1A" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", spaceGrotesk.variable, jetbrainsMono.variable, "font-sans")}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <PwaRegister />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
