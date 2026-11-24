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

    const abortController = new AbortController();
    let interval: NodeJS.Timeout;

    const checkStatus = async () => {
      setLoading(true);
      let isTerminal = false;
      try {
        const res = await fetch("/api/tiktok/publish/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publish_id: publishId }),
          signal: abortController.signal,
        });
        if (!res.ok) throw new Error("Gagal memeriksa status");
        const data = await res.json();
        const videoStatus = data.data?.[0]?.status ?? data.status ?? "unknown";

        // Stop polling once a terminal status is reached
        isTerminal =
          videoStatus === "PUBLISH_COMPLETE" ||
          videoStatus === "SUCCESS" ||
          videoStatus === "FAILED" ||
          videoStatus === "ERROR";

        if (!abortController.signal.aborted) {
          setStatus(videoStatus);
          onStatusChange?.(videoStatus);
          if (isTerminal) {
            setLoading(false);
            clearInterval(interval);
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!abortController.signal.aborted) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!abortController.signal.aborted && !isTerminal) setLoading(false);
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 5000);

    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, [publishId, onStatusChange]);

  if (!publishId) return null;

  return (
    <Card className="border-l-4 border-l-tiktok-primary">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium">Status Publikasi</CardTitle>
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : status === "PUBLISH_COMPLETE" || status === "SUCCESS" ? (
          <CheckCircle className="h-3 w-3 text-primary" aria-hidden="true" />
        ) : status === "FAILED" || status === "ERROR" ? (
          <XCircle className="h-3 w-3 text-destructive" aria-hidden="true" />
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-1 text-xs">
          <span className="font-medium">Publish ID:</span>
          <span className="text-muted-foreground truncate text-xs">{publishId}</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs">
          <span className="font-medium">Status:</span>
          <span
            className={`font-semibold capitalize ${
              status === "PUBLISH_COMPLETE" || status === "SUCCESS"
                ? "text-primary"
                : status === "FAILED" || status === "ERROR"
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {status || "Memeriksa..."}
          </span>
        </div>
        {error && (
          <div className="mt-1 text-xs text-destructive">{error}</div>
        )}
      </CardContent>
    </Card>
  );
}