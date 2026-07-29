import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ask Your Odoo",
  description: "Chat with your live Odoo ERP data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
