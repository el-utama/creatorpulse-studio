"use client";

import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export function TikTokConnectButton() {
  return (
    <a
      href="/api/auth/tiktok"
      className="inline-flex items-center justify-center w-full gap-2 bg-slate-900 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-medium hover:bg-slate-900/90 transition-colors"
    >
      <Play className="h-5 w-5" aria-hidden="true" />
      Hubungkan TikTok
    </a>
  );
}