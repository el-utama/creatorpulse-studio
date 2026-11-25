"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface PublishStatusCheckerProps {
  publishId: string | null;
  accountSlot?: string;
  onStatusChange?: (status: string) => void;
}

export function PublishStatusChecker({ publishId, accountSlot, onStatusChange }: PublishStatusCheckerProps) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publishId) return;
    setError(null);
    setStatus(null);
    setFailure(null);

    const abortController = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 5 * 60 * 1000;

    const checkStatus = async () => {
      setLoading(true);
      let isTerminal = false;
      try {
        const res = await fetch("/api/tiktok/publish/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publish_ids: [publishId], ...(accountSlot?{accountSlot}:{}) }),
          signal: abortController.signal,
        });
        if (res.status === 401) { isTerminal = true; setLoading(false); throw new Error("Sesi berakhir. Hubungkan kembali akun TikTok."); }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal memeriksa status");
        const videoStatus = data.data?.status ?? data.data?.[0]?.status ?? data.status ?? "unknown";

        // Stop polling once a terminal status is reached
        isTerminal =
          videoStatus === "PUBLISH_COMPLETE" ||
          videoStatus === "SUCCESS" ||
          videoStatus === "SEND_TO_USER_INBOX" ||
          videoStatus === "FAILED" ||
          videoStatus === "ERROR";

        if (!abortController.signal.aborted) {
          setError(null);
          setStatus(videoStatus);
          setFailure(typeof data.failure_reason === "string" ? data.failure_reason : null);
          onStatusChange?.(videoStatus);
          if (isTerminal) {
            setLoading(false);
            clearTimeout(timer);
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!abortController.signal.aborted) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!abortController.signal.aborted && !isTerminal) {
          setLoading(false);
          if (Date.now() < deadline) timer = setTimeout(checkStatus, 5000);
          else setError("Pemeriksaan otomatis berhenti. Tekan Periksa ulang untuk melanjutkan.");
        }
      }
    };

    checkStatus();


    return () => {
      abortController.abort();
      clearTimeout(timer);
    };
  }, [publishId, accountSlot, onStatusChange, attempt]);

  if (!publishId) return null;

  return (
    <Card className="shadow-none" aria-live="polite">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium">Status</CardTitle>
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
            {({ PUBLISH_COMPLETE: "Terpublikasi", SUCCESS: "Terpublikasi", SEND_TO_USER_INBOX: "Dikirim ke inbox TikTok", PROCESSING_UPLOAD: "Mengunggah video", PROCESSING_DOWNLOAD: "Mengambil video", FAILED: "Gagal", ERROR: "Gagal" } as Record<string,string>)[status ?? ""] ?? (status ? "Sedang diproses" : "Memeriksa…")}
          </span>
        </div>
        {failure && <p role="alert" className="mt-2 text-sm text-destructive">{failure}</p>}
        {error && (
          <div role="alert" className="mt-1 text-sm text-destructive">{error}</div>
        )}
        <button type="button" className="mt-3 min-h-11 rounded-md border px-3 text-sm" disabled={loading} onClick={() => setAttempt(v => v+1)}>Periksa ulang</button>
      </CardContent>
    </Card>
  );
}