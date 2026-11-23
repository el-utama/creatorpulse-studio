"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Play className="h-6 w-6 text-tiktok-primary" />
          <Link href="/" className="font-semibold tracking-tight">
            CreatorPulse Studio
          </Link>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors ${
              pathname === "/" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Beranda
          </Link>
          <Link
            href="/dashboard"
            className={`text-sm font-medium transition-colors ${
              pathname === "/dashboard" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Dasbor
          </Link>
          <Link href="/privacy" className="text-sm text-muted-foreground">
            Kebijakan Privasi
          </Link>
          <Link href="/terms" className="text-sm text-muted-foreground">
            Syarat Ketentuan
          </Link>
        </div>
      </div>
    </nav>
  );
}