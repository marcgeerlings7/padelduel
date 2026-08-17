import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import "./design-system.css";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "Padel Ladder",
  description: "Vereniging-onafhankelijke ranked ladder voor padel-duo's",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className={archivo.variable}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
