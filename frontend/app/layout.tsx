import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShopWell - Refund Agent Console",
  description:
    "AI customer-support agent that approves, denies, or escalates e-commerce refunds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950">{children}</body>
    </html>
  );
}
