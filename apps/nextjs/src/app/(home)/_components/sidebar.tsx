"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, LayoutGrid, MapPin, Truck, Users } from "lucide-react";

const navLinks = [
  { href: "/admin/home", label: "Dashboard", Icon: LayoutGrid },
  { href: "/vehicle_assignment", label: "Vehicle assignment", Icon: Truck },
  { href: "/team_assignment", label: "Team assignment", Icon: Users },
  { href: "/reports", label: "Reports", Icon: BarChart2 },
  { href: "/locations", label: "Locations", Icon: MapPin },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  // Helper: push to a path with ?id=<randomId>
  const pushWithId = (basePath: string) => {
    const id = Math.floor(100000000 + Math.random() * 900000000);
    router.push(`${basePath}?id=${id}`);
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#000E26] px-5 py-4 text-white">
      {/* Logo */}
      <div className="mb-3 flex items-center justify-center">
        <img
          src="/assets/images/peopleforanimals.png"
          alt="Blue Cross of Hyderabad"
          width={150}
          height={150}
        />
      </div>

      {/* Nav Links */}
      <nav className="flex flex-1 flex-col space-y-2">
        {navLinks.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <button
              key={label}
              onClick={() => pushWithId(href)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                isActive
                  ? "bg-[#D1E6FF] text-black"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <Icon
                size={isActive ? 25 : 22}
                className={`opacity-75 transition-all duration-200 ${
                  isActive ? "text-black" : ""
                }`}
              />
              <span
                className={`text-sm ${
                  isActive ? "font-semibold" : "font-normal"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto space-y-3">
        <div className="mt-4 border-t border-gray-800 pt-2">
          <button
            onClick={() => router.push("/account/change-phone")}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
              pathname === "/account"
                ? "bg-white text-black"
                : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            <img
              src="/assets/images/account.png"
              alt="Account"
              width={14}
              height={14}
              className="opacity-75"
            />
            <span className="text-sm">Account</span>
          </button>
        </div>

        {/* Admin Info */}
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-gray-700 px-3 py-2">
          <img
            src="/assets/images/dog1.png"
            alt="Admin"
            width={50}
            height={50}
            className="rounded-full"
          />
          <div className="flex flex-1 flex-col">
            <div className="text-xs text-gray-400">Hello</div>
            <div className="text-md text-gray-100">Admin</div>
          </div>
          <button
            onClick={() => router.push("/logout")}
            className="text-gray-400 hover:text-gray-300"
          >
            <Image
              src="/assets/images/exit.png"
              alt="Logout"
              width={20}
              height={20}
              className="opacity-75"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
