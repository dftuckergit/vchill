import { Lora, Work_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./_components/SiteHeader";

const workSans = Work_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const loraDisplay = Lora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata = {
  title: "V Chill Pool",
  description: "It's the 12th annual V Chill Playoff Pool powered by Searlenet",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${workSans.variable} ${loraDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}

