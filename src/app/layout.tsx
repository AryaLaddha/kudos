import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import NextTopLoader from "nextjs-toploader";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kudos — Employee Recognition Platform",
  description: "Celebrate your teammates with meaningful recognition and points.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <NextTopLoader color="#6366f1" height={3} showSpinner={false} />
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
