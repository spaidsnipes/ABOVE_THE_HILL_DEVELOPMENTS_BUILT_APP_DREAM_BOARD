import type { Metadata } from "next";
import "./globals.css";
import "./dreamboard.css";
import "./wm-id.css";
import "./studios.css";
import "./home-hero.css";
import "./front-door.css";

export const metadata: Metadata = {
  title: "Dreamboard | WOW World",
  description: "A private creative workspace for work only you can make.",
  openGraph: {
    title: "Dreamboard | WOW World",
    description: "Write the vision. Make it plain.",
    images: [{ url: "/og.png", width: 1792, height: 1024, alt: "Make room for the work only you can make" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dreamboard | WOW World",
    description: "Write the vision. Make it plain.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* The WOW community button (Founder order 2026-11-06): the ONE WOW dock served by WOW OS — Passport, Lounge,
            Radio, Music, TV — never a copied room. Nothing loads from WOW until it is opened. Dreamboard lends no
            Passport token to it (WOW_WORLD_BRIDGE_BOUNDARY): the member signs in inside the dock. */}
        <script src="https://thewow.online/wow-dock.js" data-app="Dreamboard" data-side="left" defer />
      </body>
    </html>
  );
}
