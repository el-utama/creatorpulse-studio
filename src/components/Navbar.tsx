"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Play, Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-12 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Play className="h-6 w-6 text-tiktok-primary" aria-hidden="true" />
          <Link href="/" className="font-semibold tracking-tight">
            CreatorPulse Studio
          </Link>
        </div>

        {/* Desktop navigation */}
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

        {/* Desktop auth actions */}
        <div className="hidden md:flex items-center gap-3">
          {pathname !== "/dashboard" ? (
            <a href="/api/auth/tiktok" className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
              <Play className="h-4 w-4" aria-hidden="true" />
              Connect
            </a>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                } catch (err) {
                  console.error("Logout error:", err);
                }
                window.location.href = "/";
              }}
              className="px-3 py-2 text-sm"
            >
              <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
              Keluar
            </Button>
          )}
        </div>

        {/* Mobile menu toggle */}
        <div className="md:hidden flex items-center">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            className="h-11 w-11"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div id="mobile-menu" className="md:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
          <div className="px-4 py-4 space-y-3">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                pathname === "/" ? "bg-tiktok-primary/10 text-tiktok-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Beranda
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                pathname === "/dashboard" ? "bg-tiktok-primary/10 text-tiktok-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Dasbor
            </Link>
            <Link
              href="/privacy"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors rounded-lg"
            >
              Kebijakan Privasi
            </Link>
            <Link
              href="/terms"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors rounded-lg"
            >
              Syarat Ketentuan
            </Link>
            <div className="pt-4 border-t border-border">
              {pathname !== "/dashboard" ? (
                <a
                  href="/api/auth/tiktok"
                  className="block w-full px-4 py-2 text-sm font-medium text-center bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Hubungkan TikTok
                </a>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    try {
                      await fetch("/api/auth/logout", { method: "POST" });
                    } catch (err) {
                      console.error("Logout error:", err);
                    }
                    window.location.href = "/";
                  }}
                  className="w-full"
                >
                  Keluar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}