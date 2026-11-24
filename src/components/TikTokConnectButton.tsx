"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export function TikTokConnectButton() {
  return (
    <Link
      href="/api/auth/tiktok"
      className="inline-flex items-center justify-center w-full gap-2 bg-tiktok-primary text-white px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-medium hover:bg-tiktok-primary/90 transition-colors"
    >
      <Play className="h-5 w-5" aria-hidden="true" />
      Connect with TikTok
    </Link>
  );
}