import type { Metadata } from "next";
import MobileSidebar from "./_components/mobile-sidebar";

import { env } from "env";

import Sidebar from "./_components/sidebar";

export const metadata: Metadata = {
  metadataBase: new URL(
    env.NODE_ENV === "production"
      ? "https://turbo.t3.gg"
      : "http://localhost:3000",
  ),
  title: "Blue Cross of Hyderabad",
  description: "Hospital Management System",
  openGraph: {
    title: "Blue Cross of Hyderabad",
    description: "Hospital Management System",
    url: "https://bluecross.vercel.app",
    siteName: "Blue Cross of Hyderabad",
  },
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#000E26]">
      {/* Desktop Sidebar */}
      <div className="hidden md:block md:w-1/6">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto rounded-none bg-white p-4 shadow-lg md:my-4 md:rounded-l-3xl md:p-6">
        {children}
      </div>
    </div>
  );
}
