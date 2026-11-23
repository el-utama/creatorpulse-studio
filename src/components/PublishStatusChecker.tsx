"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface PublishStatusCheckerProps {
  publishId: string | null;
  onStatusChange?: (status: string) => void;
}

export function PublishStatusChecker({ publishId, onStatusChange }: PublishStatusCheckerProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publishId) return;

    let cancelled = false;
    let interval: NodeJS.Timeout;

    const checkStatus = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/tiktok/publish/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publish_id: publishId }),
        });
        if (!res.ok) throw new Error("Gagal memeriksa status");
        const data = await res.json();
        const videoStatus = data.data?.[0]?.status ?? data.status ?? "unknown";
        if (!cancelled) {
          setStatus(videoStatus);
          onStatusChange?.(videoStatus);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publishId, onStatusChange]);

  if (!publishId) return null;

  return (
    <Card className="border-l-4 border-l-tiktok-primary">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Status Publikasi</CardTitle>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status === "PUBLISH_COMPLETE" || status === "SUCCESS" ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : status === "FAILED" || status === "ERROR" ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Publish ID:</span>
          <span className="text-muted-foreground truncate">{publishId}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="font-medium">Status:</span>
          <span
            className={`font-semibold capitalize ${
              status === "PUBLISH_COMPLETE" || status === "SUCCESS"
                ? "text-green-600"
                : status === "FAILED" || status === "ERROR"
                ? "text-red-600"
                : "text-muted-foreground"
            }`}
          >
            {status || "Memeriksa..."}
          </span>
        </div>
        {error && (
          <div className="mt-2 text-xs text-red-500">{error}</div>
        )}
      </CardContent>
    </Card>
  );
}