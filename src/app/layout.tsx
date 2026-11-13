import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Excurso — bookings for tours & activities", template: "%s · Excurso" },
  description: "Online booking, deposits and a live dashboard for tour and activity operators.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
