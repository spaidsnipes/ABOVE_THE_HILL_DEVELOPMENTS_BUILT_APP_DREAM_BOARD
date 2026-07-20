import type { Metadata } from "next";
import "./globals.css";
import "./dreamboard.css";
import "./wm-id.css";
import "./studios.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://above-the-hill-developments-built-app-dream-board-o9oel27np.vercel.app"),
  title: "Dreamboard | Wealthy Mindsets",
  description: "A real creative workspace for work only you can make.",
  openGraph: {
    title: "Dreamboard | Wealthy Mindsets",
    description: "Make room for the work only you can make.",
    images: [{ url: "/og.png", width: 1792, height: 1024, alt: "Make room for the work only you can make" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dreamboard | Wealthy Mindsets",
    description: "Make room for the work only you can make.",
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
