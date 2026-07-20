import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creative OS | Wealthy Mindsets",
  description: "The creative operating system for work only you can make.",
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
