import "./globals.css";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = { title: "Buffet Finance", description: "Personal market research terminal" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Navbar /><main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7">{children}</main></body></html>;
}
