"use client";

import { useState, useRef, useCallback } from "react";
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

export function VideoUploadForm({ accountName, avatarUrl, onPublish }: UploadFormProps) {
  const [mode, setMode] = useState<"inbox" | "profile">("inbox");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState("PUBLIC_TO_EVERYONE");
  const [disableComment, setDisableComment] = useState(false);
  const [disableDuet, setDisableDuet] = useState(false);
  const [disableStitch, setDisableStitch] = useState(false);
  const [consent, setConsent] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    if (!selectedFile) return;

    const validTypes = ["video/mp4", "video/quicktime", "video/x-msvideo"];
    if (!validTypes.includes(selectedFile.type)) {
      setFileError("Hanya file .mp4 atau .mov yang didukung.");
      return;
    }

    const maxBytes = 4.5 * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      setFileError("File terlalu besar untuk upload langsung (maks 4.5 MB). Gunakan opsi PULL_FROM_URL.");
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [previewUrl]);

  const isDirectUpload = mode === "profile" && !!file && previewUrl;
  const canPublish = consent && (isDirectUpload || (mode === "inbox" && !!videoUrl));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5 text-tiktok-primary" />
          Upload & Posting Video
        </CardTitle>
        <CardDescription className="text-xs">
          Posting ke akun <strong>{accountName}</strong>. Pilih mode dan atur opsi sebelum menerbitkan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Posting */}
        <div className="space-y-2">
          <Label htmlFor="mode" className="text-xs font-medium text-muted-foreground">
            Mode Posting
          </Label>
          <div className="flex items-center gap-2 border border-input rounded-md p-1">
            <button
              onClick={() => setMode("inbox")}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                mode === "inbox"
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Draft / Inbox
            </button>
            <button
              onClick={() => setMode("profile")}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                mode === "profile"
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Direct Post
            </button>
          </div>
        </div>

        {/* Input Source */}
        {mode === "inbox" ? (
          <div className="space-y-2">
            <Label htmlFor="video-url" className="text-xs font-medium">
              URL Video (PULL_FROM_URL)
            </Label>
            <Input
              id="video-url"
              placeholder="https://contoh.com/video.mp4"
              value={videoUrl ?? ""}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Untuk file lebih besar dari 4.5 MB, unggah ke penyimpanan publik.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="video-file" className="flex items-center gap-2 cursor-pointer border border-dashed rounded-lg px-3 py-4 text-center text-sm text-muted-foreground hover:border-tiktok-primary/50 transition-colors">
              <Upload className="h-4 w-4 text-tiktok-primary" />
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
                  className="w-full h-40 object-cover rounded-lg border border-border"
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
              Batas upload langsung lewat serverless:~4.5 MB.
            </p>
          </div>
        )}

        {/* Caption */}
        <div className="space-y-1.5">
          <Label htmlFor="caption" className="text-xs font-medium">
            Caption / Title
          </Label>
          <Textarea
            id="caption"
            rows={2}
            placeholder="Tulis caption video di sini..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        {/* Privacy */}
        <div className="space-y-1.5">
          <Label htmlFor="privacy" className="text-xs font-medium">
            Privacy Level
          </Label>
          <Select
            value={privacy}
            onValueChange={setPrivacy}
          >
            <SelectTrigger id="privacy" className="h-10">
              <SelectValue placeholder="Pilih privacy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLIC_TO_EVERYONE">Public to Everyone</SelectItem>
              <SelectItem value="FOLLOWER_OF_CREATOR">Follower of Creator</SelectItem>
              <SelectItem value="MUTUAL_FOLLOW_FRIENDS">Mutual Follow Friends</SelectItem>
              <SelectItem value="SELF_ONLY">Self Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Interaction checkboxes - stack on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs leading-none">
            <Checkbox
              checked={disableComment}
              onCheckedChange={(v) => setDisableComment(v === true)}
            />
            Disable Comment
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs leading-none">
            <Checkbox
              checked={disableDuet}
              onCheckedChange={(v) => setDisableDuet(v === true)}
            />
            Disable Duet
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs leading-none">
            <Checkbox
              checked={disableStitch}
              onCheckedChange={(v) => setDisableStitch(v === true)}
            />
            Disable Stitch
          </label>
        </div>

        {/* Consent */}
        <div className="flex items-start gap-2 pt-2 border-t border-border">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            aria-invalid={!consent}
            aria-describedby="consent-hint"
            aria-label="Saya menyetujui ketentuan dan mengizinkan CreatorPulse Studio memposting video ini ke akun TikTok saya."
          />
          <label id="consent-hint" className="text-xs leading-relaxed">
            Saya menyetujui ketentuan dan mengizinkan CreatorPulse Studio memposting video ini ke akun TikTok saya.
          </label>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => {
            onPublish({
              mode,
              file,
              videoUrl: mode === "inbox" ? videoUrl : null,
              caption,
              privacy,
              disableComment,
              disableDuet,
              disableStitch,
              consent,
            });
          }}
          disabled={!canPublish}
          className="w-full bg-tiktok-primary text-white py-2.5 hover:bg-tiktok-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {canPublish ? "Publish to TikTok" : "Centang persetujuan dan lengkapi input"}
        </Button>
        {!consent && (
          <p id="consent-hint" className="text-xs text-muted-foreground mt-2">
            Persetujuan eksplisit diperlukan sebelum tombol publish diaktifkan.
          </p>
        )}
      </CardFooter>
    </Card>
  );
}