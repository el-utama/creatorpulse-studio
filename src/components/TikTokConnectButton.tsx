"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export function TikTokConnectButton() {
  return (
    <Link href="/api/auth/tiktok" className="w-full md:w-auto">
      <Button variant="default" size="lg" className="w-full justify-center gap-2">
        <Play className="h-5 w-5" />
        Connect with TikTok
      </Button>
    </Link>
  );
}