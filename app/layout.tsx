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
        {/* The Spaidbot button (Founder rule 2026-11-06: every ATH app shows BOTH buttons): the ONE public ATHOS embed,
            bottom-right, labelled AI, sends nothing until asked. Its answers need this app's origin in the ATHOS CORS list
            (index.js ORIGINS) the day Dreamboard gets a production address; localhost already works. */}
        <script src="https://mission.abovethehilldev.online/spaidbot.js" data-product="ath" defer />
      </body>
    </html>
  );
}
