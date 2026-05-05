import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMART MEETING Navigator",
  description: "Strategische Meetingvorbereitung, KI-gestützte Analyse und Simulation für fundierte Entscheidungen"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
