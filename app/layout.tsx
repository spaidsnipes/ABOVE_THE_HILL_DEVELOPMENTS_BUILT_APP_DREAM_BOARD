import type { Metadata } from "next";
import "./globals.css";
import "./dreamboard.css";
import "./wm-id.css";
import "./studios.css";
import "./home-hero.css";

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
      <body>{children}</body>
    </html>
  );
}
