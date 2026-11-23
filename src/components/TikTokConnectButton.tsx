"use client";

import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export function TikTokConnectButton() {
  return (
    <a href="/api/auth/tiktok">
      <Button variant="default" size="lg" className="w-full justify-center gap-2">
        <Play className="h-5 w-5" />
        Connect with TikTok
      </Button>
    </a>
  );
}