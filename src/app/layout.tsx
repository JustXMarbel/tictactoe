import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tic-Tac-Toe Arena - Play Online & Offline",
  description: "Play Tic-Tac-Toe against bots with unbeatable AI, local friends on the same device, or live players globally via real-time online matchmaking.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-white antialiased">{children}</body>
    </html>
  );
}
