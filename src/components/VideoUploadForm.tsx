"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Video, Upload, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadFormProps {
  accountName: string;
  avatarUrl: string;
  onPublish: (payload: PublishPayload) => void;
  publishing?: boolean;
  error?: string | null;
}

export interface PublishPayload {
  mode: "inbox" | "profile";
  file: File | null;
  videoUrl: string | null;
  caption: string;
  privacy: string;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  consent: boolean;
}

export function VideoUploadForm({ accountName, avatarUrl, onPublish, publishing = false, error }: UploadFormProps) {
  const [mode, setMode] = useState<"inbox" | "profile">("inbox");
  const [source, setSource] = useState<"file" | "url">("url");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [disableComment, setDisableComment] = useState(false);
  const [disableDuet, setDisableDuet] = useState(false);
  const [disableStitch, setDisableStitch] = useState(false);
  const [capabilities, setCapabilities] = useState<import("@/lib/tiktok").CreatorCapabilities | null>(null);
  const [capabilityError, setCapabilityError] = useState(false);
  useEffect(() => {
    if (mode !== "profile") return;
    const controller = new AbortController();
    setCapabilities(null); setCapabilityError(false); setPrivacy(""); setConsent(false); setReview(false);
    fetch("/api/tiktok/creator", {signal:controller.signal}).then(async res => { if (!res.ok) throw new Error(); return res.json(); }).then(data => { if (controller.signal.aborted) return; setCapabilities(data); setDisableComment(true); setDisableDuet(true); setDisableStitch(true); }).catch(() => { if (!controller.signal.aborted) setCapabilityError(true); });
    return () => controller.abort();
  }, [mode]);
  const [review, setReview] = useState(false);
  const [consent, setConsent] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    if (!selectedFile) return;

    setFile(null);
    setPreviewUrl(null);
    setConsent(false); setReview(false);
    const validTypes = ["video/mp4", "video/quicktime"];
    if (!validTypes.includes(selectedFile.type)) {
      setFileError("Hanya file .mp4 atau .mov yang didukung.");
      return;
    }

    const maxBytes = 4 * 1024 * 1024;
    if (selectedFile.size === 0 || selectedFile.size > maxBytes) {
      setFileError("File terlalu besar untuk upload langsung (maks 4 MB). Gunakan opsi PULL_FROM_URL.");
      return;
    }

    setFileError(null);

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  }, []);

  const handleRemoveFile = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setConsent(false); setReview(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [previewUrl]);

  const hasFile = !!file && !!previewUrl;
  const validUrl = (() => { try { return new URL(videoUrl ?? "").protocol === "https:"; } catch { return false; } })();
  const ready = (source === "file" ? hasFile : validUrl) && (mode === "inbox" || (!!privacy && !!capabilities?.privacy_level_options.includes(privacy)));
  const canPublish = !publishing && consent && review && ready;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5 text-tiktok-primary" aria-hidden="true" />
          Upload & Posting Video
        </CardTitle>
        <CardDescription className="text-sm">
          Posting ke akun <strong>{accountName}</strong>. Pilih mode dan atur opsi sebelum menerbitkan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Posting */}
        <div className="space-y-2">
          <Label htmlFor="mode" className="text-xs font-medium text-muted-foreground">
            Mode Posting
          </Label>
          <div
            role="group"
            aria-label="Mode posting"
            className="flex items-center gap-2 border border-input rounded-md p-1"
          >
            <button
              onClick={() => { setMode("inbox"); setConsent(false); setReview(false); }}
              aria-pressed={mode === "inbox"}
              className={`flex-1 h-11 py-2 text-xs font-medium rounded-md transition-all ${
                mode === "inbox"
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Draft / Inbox
            </button>
            <button
              onClick={() => { setMode("profile"); setConsent(false); setReview(false); }}
              aria-pressed={mode === "profile"}
              className={`flex-1 h-11 py-2 text-xs font-medium rounded-md transition-all ${
                mode === "profile"
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Direct Post
            </button>
          </div>
        </div>

        <div className="space-y-2"><h3 className="text-sm font-medium">Sumber video</h3><div role="group" aria-label="Sumber video" className="flex gap-2"><Button type="button" variant={source === "url" ? "default" : "outline"} aria-pressed={source === "url"} disabled={publishing} onClick={() => {setSource("url");setConsent(false);setReview(false);}}>Tautan HTTPS</Button><Button type="button" variant={source === "file" ? "default" : "outline"} aria-pressed={source === "file"} disabled={publishing} onClick={() => {setSource("file");setConsent(false);setReview(false);}}>File perangkat</Button></div></div>
        {source === "url" ? (
          <div className="space-y-2">
            <Label htmlFor="video-url" className="text-xs font-medium">
              Tautan video HTTPS
            </Label>
            <Input
              id="video-url"
              placeholder="https://contoh.com/video.mp4"
              value={videoUrl ?? ""}
              type="url"
              onChange={(e) => { setVideoUrl(e.target.value); setConsent(false); setReview(false); }}
            />
            <p className="text-xs text-muted-foreground">
              Gunakan URL dari domain atau awalan URL yang telah diverifikasi untuk aplikasi TikTok.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="video-file" className="flex items-center gap-2 cursor-pointer focus-within:ring-2 focus-within:ring-ring border border-dashed rounded-lg px-3 py-4 text-center text-sm text-muted-foreground hover:border-tiktok-primary/50 transition-colors">
              <Upload className="h-4 w-4 text-tiktok-primary" aria-hidden="true" />
              <span>Pilih file video (.mp4 / .mov)</span>
              <input
                id="video-file"
                ref={fileInputRef}
                type="file"
                accept=".mp4,.mov,video/mp4,video/quicktime"
                className="sr-only"
                onChange={handleFileChange}
                aria-invalid={fileError ? true : undefined}
                aria-describedby={fileError ? "video-file-error" : undefined}
              />
              {fileError && (
                <p id="video-file-error" className="text-xs text-destructive mt-1">
                  {fileError}
                </p>
              )}
            </Label>
            {file && previewUrl && (
              <div className="relative group">
                <video
                  src={previewUrl}
                  className="w-full max-h-[420px] aspect-[9/16] object-contain bg-black rounded-lg border border-border"
                  controls
                />
                <button
                  onClick={handleRemoveFile}
                  className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 hover:bg-destructive/90 transition-colors"
                  aria-label="Hapus file"
                >
                  ×
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Maksimal 4 MB. Untuk video lebih besar, gunakan tautan HTTPS.
            </p>
          </div>
        )}

        {mode === "profile" && <>
        {/* Caption */}
        <div className="space-y-1.5">
          <Label htmlFor="caption" className="text-xs font-medium">
            Caption video
          </Label>
          <Textarea
            id="caption"
            rows={3}
            maxLength={2200}
            disabled={publishing}
            placeholder="Tulis caption video di sini..."
            value={caption}
            onChange={(e) => { setCaption(e.target.value); setConsent(false); setReview(false); }}
          />
        </div>

        {/* Privacy */}
        <div className="space-y-1.5">
          {capabilities && <p className="text-sm text-muted-foreground">Akun: {capabilities.creator_nickname} (@{capabilities.creator_username}) · Maks. {capabilities.max_video_post_duration_sec} detik</p>}
          <Label htmlFor="privacy" className="text-xs font-medium">
            Visibilitas video
          </Label>
          {!capabilities && <p role="status" className="text-sm">{capabilityError ? "Pengaturan akun gagal dimuat. Pilih Inbox lalu kembali ke Direct Post untuk mencoba lagi." : "Memuat pengaturan akun…"}</p>}
          <Select
            disabled={!capabilities || publishing}
            value={privacy}
            onValueChange={(v) => { setPrivacy(v); setConsent(false); setReview(false); }}
          >
            <SelectTrigger id="privacy" className="h-11">
              <SelectValue placeholder="Pilih privacy" />
            </SelectTrigger>
            <SelectContent>
              {capabilities?.privacy_level_options.map(value => <SelectItem key={value} value={value}>{({PUBLIC_TO_EVERYONE:"Semua orang",FOLLOWER_OF_CREATOR:"Pengikut",MUTUAL_FOLLOW_FRIENDS:"Teman yang saling mengikuti",SELF_ONLY:"Hanya saya"} as Record<string,string>)[value] ?? value}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Interaction checkboxes - stack on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm leading-none">
            <Checkbox
              disabled={!capabilities || capabilities.comment_disabled || publishing}
              checked={disableComment}
              onCheckedChange={(v) => { setDisableComment(v === true); setConsent(false); setReview(false); }}
              className="h-11 w-11"
              aria-label="Nonaktifkan komentar"
            />
            <span className="flex items-center gap-1 text-sm">
              Nonaktifkan komentar
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm leading-none">
            <Checkbox
              disabled={!capabilities || capabilities.duet_disabled || publishing}
              checked={disableDuet}
              onCheckedChange={(v) => { setDisableDuet(v === true); setConsent(false); setReview(false); }}
              className="h-11 w-11"
              aria-label="Nonaktifkan duet"
            />
            <span className="flex items-center gap-1 text-sm">
              Nonaktifkan duet
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm leading-none">
            <Checkbox
              disabled={!capabilities || capabilities.stitch_disabled || publishing}
              checked={disableStitch}
              onCheckedChange={(v) => { setDisableStitch(v === true); setConsent(false); setReview(false); }}
              className="h-11 w-11"
              aria-label="Nonaktifkan stitch"
            />
            <span className="flex items-center gap-1 text-sm">
              Nonaktifkan stitch
            </span>
          </label>
        </div>

        </>}
        {!review && <Button type="button" variant="outline" disabled={!ready || publishing} onClick={() => setReview(true)}>Tinjau publikasi</Button>}
        {review && <section className="space-y-3 rounded-lg border p-4" aria-label="Tinjauan publikasi"><h3 className="font-semibold">Konfirmasi publikasi</h3><p className="text-sm">Akun: {accountName}</p><p className="text-sm break-all">Video: {source === "url" ? videoUrl : file?.name}</p><p className="text-sm">{mode === "inbox" ? "Dikirim ke inbox; selesaikan posting di TikTok." : `Visibilitas: ${({PUBLIC_TO_EVERYONE:"Semua orang",FOLLOWER_OF_CREATOR:"Pengikut",MUTUAL_FOLLOW_FRIENDS:"Teman",SELF_ONLY:"Hanya saya"} as Record<string,string>)[privacy] ?? privacy}`}</p>
        {mode === "profile" && <p className="text-sm whitespace-pre-wrap break-words">Caption: {caption || "(tanpa caption)"}</p>}
        {/* Consent */}
        <div className="flex items-start gap-2 pt-2 border-t border-border">
          <Checkbox
            id="publication-consent"
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            aria-required="true"
            aria-describedby="consent-hint"
            aria-label="Saya menyetujui ketentuan dan mengizinkan CreatorPulse Studio memposting video ini ke akun TikTok saya."
            className="h-11 w-11"
          />
          <label htmlFor="publication-consent" id="consent-hint" className="text-sm leading-relaxed">
            Saya menyetujui ketentuan dan mengizinkan CreatorPulse Studio memposting video ini ke akun TikTok saya.
          </label>
        </div></section>}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button
          onClick={() => {
            onPublish({
              mode,
              file: source === "file" ? file : null,
              videoUrl: source === "url" ? videoUrl : null,
              caption,
              privacy,
              disableComment,
              disableDuet,
              disableStitch,
              consent,
            });
          }}
          disabled={!canPublish}
          className="w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          title={!canPublish ? "Centang persetujuan dan lengkapi semua input sebelum publish" : undefined}
        >
          {publishing ? "Mengirim video…" : mode === "inbox" ? "Kirim ke inbox TikTok" : "Publikasikan ke TikTok"}
        </Button>
        {review && !consent && (
          <p className="text-xs text-muted-foreground mt-2">
            Persetujuan eksplisit diperlukan sebelum tombol publish diaktifkan.
          </p>
        )}
      </CardFooter>
    </Card>
  );
}