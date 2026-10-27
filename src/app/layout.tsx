import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Justech · Workspace", template: "%s · Justech CRM" },
  description: "The internal workspace for Justech and Al-Fikr.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
