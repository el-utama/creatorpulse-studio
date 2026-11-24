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
  duration: number | null;
  requestId: string;
  brandOrganic: boolean;
  brandContent: boolean;
  isAigc: boolean;
}

export function VideoUploadForm({ accountName, avatarUrl, onPublish, publishing = false, error }: UploadFormProps) {
  const [mode, setMode] = useState<"inbox" | "profile">("inbox");
  const [duration, setDuration] = useState<number | null>(null);
  const [commercial, setCommercial] = useState(false);
  const [brandOrganic, setBrandOrganic] = useState(false);
  const [brandContent, setBrandContent] = useState(false);
  const [isAigc, setIsAigc] = useState(false);
  const [source, setSource] = useState<"file" | "url">("url");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [disableComment, setDisableComment] = useState(true);
  const [disableDuet, setDisableDuet] = useState(true);
  const [disableStitch, setDisableStitch] = useState(true);
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
  const requestId = useRef<string | null>(null);
  useEffect(() => { if (!review) requestId.current = null; }, [review]);
  const [consent, setConsent] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    if (!selectedFile) return;

    setDuration(null);
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
  const validUrl = (() => { try { const url = new URL(videoUrl ?? ""); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; } })();
  const validDuration = duration !== null && Number.isFinite(duration) && duration > 0 && duration <= (capabilities?.max_video_post_duration_sec ?? 0);
  const ready = (source === "file" ? hasFile : validUrl) && (mode === "inbox" || (!!privacy && !!capabilities?.privacy_level_options.includes(privacy) && validDuration && (!commercial || brandOrganic || brandContent) && (!commercial || !brandContent || ["PUBLIC_TO_EVERYONE","MUTUAL_FOLLOW_FRIENDS"].includes(privacy))));
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
              disabled={publishing}
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

        <div className="space-y-2"><h3 className="text-sm font-medium">Sumber video</h3><div role="group" aria-label="Sumber video" className="flex gap-2"><Button type="button" variant={source === "url" ? "default" : "outline"} aria-pressed={source === "url"} disabled={publishing} onClick={() => {if (source === "url") return;setSource("url");setDuration(null);setConsent(false);setReview(false);}}>Tautan HTTPS</Button><Button type="button" variant={source === "file" ? "default" : "outline"} aria-pressed={source === "file"} disabled={publishing} onClick={() => {if (source === "file") return;setSource("file");setDuration(null);setConsent(false);setReview(false);}}>File perangkat</Button></div></div>
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
              disabled={publishing}
              onChange={(e) => { setVideoUrl(e.target.value); setDuration(null); setConsent(false); setReview(false); }}
            />
            {mode === "profile" && validUrl && <video key={videoUrl} aria-label="Pratinjau video" src={videoUrl ?? undefined} controls preload="metadata" className="w-full max-h-[360px] bg-black rounded-lg" onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onError={()=>setDuration(null)}/>}
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
                disabled={publishing}
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
                  key={previewUrl}
                  aria-label="Pratinjau video"
                  preload="metadata"
                  onLoadedMetadata={e=>setDuration(e.currentTarget.duration)}
                  onError={()=>setDuration(null)}
                  src={previewUrl}
                  className="w-full max-h-[420px] aspect-[9/16] object-contain bg-black rounded-lg border border-border"
                  controls
                />
                <button
                  disabled={publishing}
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
          {capabilities && capabilities.privacy_level_options.length === 0 && <p role="alert" className="text-sm text-destructive">Akun ini belum memiliki pilihan visibilitas yang diizinkan. Gunakan Inbox atau coba kembali setelah izin tersedia.</p>}
          <Select
            disabled={!capabilities || publishing || capabilities.privacy_level_options.length === 0}
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
              checked={!disableComment}
              onCheckedChange={(v) => { setDisableComment(v !== true); setConsent(false); setReview(false); }}
              className="h-11 w-11"
              aria-label="Izinkan komentar"
            />
            <span className="flex items-center gap-1 text-sm">
              Izinkan komentar
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm leading-none">
            <Checkbox
              disabled={!capabilities || capabilities.duet_disabled || publishing}
              checked={!disableDuet}
              onCheckedChange={(v) => { setDisableDuet(v !== true); setConsent(false); setReview(false); }}
              className="h-11 w-11"
              aria-label="Izinkan duet"
            />
            <span className="flex items-center gap-1 text-sm">
              Izinkan duet
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm leading-none">
            <Checkbox
              disabled={!capabilities || capabilities.stitch_disabled || publishing}
              checked={!disableStitch}
              onCheckedChange={(v) => { setDisableStitch(v !== true); setConsent(false); setReview(false); }}
              className="h-11 w-11"
              aria-label="Izinkan stitch"
            />
            <span className="flex items-center gap-1 text-sm">
              Izinkan stitch
            </span>
          </label>
        </div>

        <p className="text-sm text-muted-foreground">{validDuration ? `Durasi video: ${Math.round(duration ?? 0)} detik` : "Video harus dapat dipratinjau dan durasinya sesuai batas akun sebelum dipublikasikan."}</p>
        <fieldset className="space-y-3 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">Pengungkapan konten</legend><label className="flex items-center gap-2 text-sm"><Checkbox disabled={publishing} checked={commercial} onCheckedChange={v=>{setCommercial(v===true);setBrandOrganic(false);setBrandContent(false);setConsent(false);setReview(false);}}/> Konten promosi atau komersial</label>{commercial && <><label className="flex items-center gap-2 text-sm"><Checkbox disabled={publishing} checked={brandOrganic} onCheckedChange={v=>{setBrandOrganic(v===true);setConsent(false);setReview(false);}}/> Merek atau bisnis sendiri</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={brandContent} disabled={publishing || privacy==="SELF_ONLY" || privacy==="FOLLOWER_OF_CREATOR"} onCheckedChange={v=>{setBrandContent(v===true);setConsent(false);setReview(false);}}/> Kemitraan berbayar dengan pihak ketiga</label><p className="text-xs text-muted-foreground">{brandContent?"Label: kemitraan berbayar. Pilih visibilitas publik atau teman.":brandOrganic?"Label: konten promosi.":"Pilih minimal satu kategori. Kemitraan berbayar tidak dapat bersifat privat."}</p></>}<label className="flex items-center gap-2 text-sm"><Checkbox disabled={publishing} checked={isAigc} onCheckedChange={v=>{setIsAigc(v===true);setConsent(false);setReview(false);}}/> Konten dihasilkan AI</label></fieldset>
        </>}
        {!review && <Button type="button" variant="outline" disabled={!ready || publishing} onClick={() => setReview(true)}>Tinjau publikasi</Button>}
        {review && <section className="space-y-3 rounded-lg border p-4" aria-label="Tinjauan publikasi"><h3 className="font-semibold">Konfirmasi publikasi</h3><p className="text-sm">Akun: {accountName}</p><p className="text-sm break-all">Video: {source === "url" ? videoUrl : file?.name}</p><p className="text-sm">{mode === "inbox" ? "Dikirim ke inbox; selesaikan posting di TikTok." : `Visibilitas: ${({PUBLIC_TO_EVERYONE:"Semua orang",FOLLOWER_OF_CREATOR:"Pengikut",MUTUAL_FOLLOW_FRIENDS:"Teman",SELF_ONLY:"Hanya saya"} as Record<string,string>)[privacy] ?? privacy}`}</p>
        {mode === "profile" && <p className="text-sm whitespace-pre-wrap break-words">Caption: {caption || "(tanpa caption)"}</p>}
        {mode === "profile" && <p className="text-sm">Dengan memposting, Anda menyetujui <a className="underline" href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer">ketentuan penggunaan musik TikTok</a>{commercial && brandContent && <> dan <a className="underline" href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer">kebijakan konten bermerek</a></>}. Konten mungkin memerlukan beberapa menit untuk diproses.</p>}
        {/* Consent */}
        <div className="flex items-start gap-2 pt-2 border-t border-border">
          <Checkbox
            id="publication-consent"
            disabled={publishing}
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
            requestId.current ??= crypto.randomUUID();
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
              duration,
              requestId: requestId.current,
              brandOrganic: commercial && brandOrganic,
              brandContent: commercial && brandContent,
              isAigc,
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