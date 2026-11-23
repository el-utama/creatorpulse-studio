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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    if (!selectedFile) return;

    const validTypes = ["video/mp4", "video/quicktime", "video/x-msvideo"];
    if (!validTypes.includes(selectedFile.type)) {
      alert("Hanya file .mp4 atau .mov yang didukung.");
      return;
    }

    const maxBytes = 4.5 * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      alert("File terlalu besar untuk upload langsung (maks 4.5 MB). Gunakan opsi PULL_FROM_URL.");
      return;
    }

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
        <CardDescription>
          Posting ke akun <strong>{accountName}</strong>. Pilih mode dan atur opsi sebelum menerbitkan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-muted-foreground">Mode Posting:</span>
          <div className="flex items-center gap-2 border rounded-md p-1">
            <button
              onClick={() => setMode("inbox")}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                mode === "inbox"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Send to TikTok Draft / Inbox
            </button>
            <button
              onClick={() => setMode("profile")}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                mode === "profile"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Direct Post to Profile
            </button>
          </div>
        </div>

        {mode === "inbox" ? (
          <div className="space-y-2">
            <Label htmlFor="video-url" className="text-sm font-medium">
              URL Video (PULL_FROM_URL)
            </Label>
            <Input
              id="video-url"
              placeholder="https://contoh.com/video.mp4"
              value={videoUrl ?? ""}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Untuk file lebih besar dari 4.5 MB, unggah video ke penyimpanan publik dan berikan URL di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="video-file" className="flex items-center gap-2 cursor-pointer border border-dashed rounded-lg px-4 py-6 text-center text-sm text-muted-foreground hover:border-tiktok-primary/50 transition-colors">
              <Upload className="h-5 w-5 text-tiktok-primary" />
              <span>Pilih file video (.mp4 / .mov)</span>
              <input
                id="video-file"
                ref={fileInputRef}
                type="file"
                accept=".mp4,.mov,video/mp4,video/quicktime"
                className="sr-only"
                onChange={handleFileChange}
              />
            </Label>
            {file && previewUrl && (
              <div className="relative group">
                <video
                  src={previewUrl}
                  className="w-full h-48 object-cover rounded-lg border border-border"
                  controls
                />
                <button
                  onClick={handleRemoveFile}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  aria-label="Hapus file"
                >
                  ×
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Batas upload langsung lewat serverless: ~4.5 MB. File lebih besar gunakan PULL_FROM_URL.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="caption" className="text-sm font-medium">
            Caption / Title
          </Label>
          <Textarea
            id="caption"
            rows={3}
            placeholder="Tulis caption video di sini..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="privacy" className="text-sm font-medium">
            Privacy Level
          </Label>
          <Select
            value={privacy}
            onValueChange={setPrivacy}
          >
            <SelectTrigger id="privacy">
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

        <div className="grid grid-cols-3 gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox
              checked={disableComment}
              onCheckedChange={(v) => setDisableComment(v === true)}
            />
            Disable Comment
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox
              checked={disableDuet}
              onCheckedChange={(v) => setDisableDuet(v === true)}
            />
            Disable Duet
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox
              checked={disableStitch}
              onCheckedChange={(v) => setDisableStitch(v === true)}
            />
            Disable Stitch
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
          />
          <label className="text-sm leading-none">
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
          className="w-full bg-tiktok-primary text-white hover:bg-tiktok-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {canPublish ? "Publish to TikTok" : "Centang persetujuan dan lengkai input"}
        </Button>
        {!consent && (
          <p className="text-xs text-muted-foreground mt-2">
            Persetujuan eksplisit diperlukan sebelum tombol publish diaktifkan.
          </p>
        )}
      </CardFooter>
    </Card>
  );
}