import { Work_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./_components/SiteHeader";

const workSans = Work_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: "V Chill Pool",
  description: "It's the 13th annual V Chill Playoff Pool powered by Searlenet",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${workSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white font-normal text-zinc-900">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}

