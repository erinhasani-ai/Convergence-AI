import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VehicleOS P1 MVP",
  description: "BestExit, SecondLook and LoadLink on one shared foundation — simulated data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
