import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import NextTopLoader from "nextjs-toploader";

// TLCo brand typeface: Poppins only, Light 300 to Bold 700.
const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kudos | The Living Company",
  description: "Celebrate your teammates with meaningful recognition and points.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="antialiased">
        <NextTopLoader color="#ff222d" height={3} showSpinner={false} />
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
