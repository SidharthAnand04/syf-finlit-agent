import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synchrony Financial Literacy Assistant",
  description:
    "Plain-language financial education about Synchrony credit products—chat assistant with grounded answers and an admin console for sources, FAQs, and insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
