"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "./sidebar";

export default function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Sliding sidebar with fade/slide animation */}
      <div
        className={`fixed left-0 top-0 z-50 h-screen w-4/5 max-w-xs bg-[#000E26] transition-all duration-300 md:hidden
          ${open ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"}`}
      >
        <Sidebar />
        <button
            aria-label="Close sidebar"
            className="absolute right-4 top-4 text-white"
            onClick={() => setOpen(false)}
          >
            <X size={24} />
          </button>
      </div>

      {/* Hamburger */}
      {!open && (
        <button
          aria-label="Open sidebar"
          className="fixed left-4 top-4 z-50 rounded-md bg-[#000E26] p-2 text-white md:hidden"
          onClick={() => setOpen(true)}
        >
          <Menu size={24} />
        </button>
      )}
    </>
  );
}
