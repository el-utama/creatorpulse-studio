"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnalyticsCards } from "@/components/AnalyticsCards";
import { VideoList } from "@/components/VideoList";
import { VideoUploadForm, type PublishPayload } from "@/components/VideoUploadForm";
import { PublishStatusChecker } from "@/components/PublishStatusChecker";
import { RefreshCw, ShieldAlert, LayoutDashboard, Film, PlusSquare, ListChecks } from "lucide-react";

interface UserProfile {
  open_id: string;
  union_id?: string;
  avatar_url: string;
  display_name: string;
  bio_description?: string;
  follower_count: number;
  following_count: number;
  likes_count: number;
  video_count: number;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("analytics");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<import("@/types/tiktok").TikTokVideo[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [history, setHistory] = useState<{ id: string; createdAt: string }[]>([]);
  const accountId = profile?.open_id;
  useEffect(() => {
    setPublishId(null);
    setHistory([]);
    if (!accountId) return;
    try {
      const records = JSON.parse(localStorage.getItem(`creatorpulse:publications:${accountId}`) ?? "[]");
      if (Array.isArray(records)) setHistory(records.filter((r) => typeof r?.id === "string" && typeof r?.createdAt === "string").slice(0, 50));
    } catch { /* Storage can be unavailable. */ }
  }, [accountId]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch("/api/tiktok/analytics", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 401) { setProfile(null); setVideos([]); throw new Error("Sesi berakhir. Hubungkan kembali akun TikTok."); }
      if (!res.ok) throw new Error("Gagal memuat analitik");
      const data = await res.json();
      setProfile(data.user_info ?? null);
      setVideos(data.videos?.data ?? []);
      if (data.video_error) setAnalyticsError(data.video_error);
      setLastUpdated(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const publishLock = useRef(false);
  const [publishing, setPublishing] = useState(false);
  const [publishWarning, setPublishWarning] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const handlePublish = async (payload: PublishPayload) => {
    if (publishLock.current) return;
    publishLock.current = true;
    setPublishing(true);
    setPublishError(null);
    try {
      const formData = new FormData();
      formData.append("mode", payload.mode);
      formData.append("videoUrl", payload.videoUrl ?? "");
      formData.append("caption", payload.caption);
      formData.append("privacy", payload.privacy);
      formData.append("disableComment", String(payload.disableComment));
      formData.append("disableDuet", String(payload.disableDuet));
      formData.append("disableStitch", String(payload.disableStitch));
      formData.append("duration", String(payload.duration ?? 0));
      formData.append("brandOrganic", String(payload.brandOrganic));
      formData.append("brandContent", String(payload.brandContent));
      formData.append("isAigc", String(payload.isAigc));
      formData.append("consent", String(payload.consent));
      if (payload.file) {
        formData.append("file", payload.file);
      }

      const res = await fetch("/api/tiktok/publish", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Gagal memulai publikasi");
      }

      const data = await res.json();
      if (!data.publish_id) throw new Error("TikTok belum memberikan ID publikasi.");
      setPublishWarning(typeof data.warning === "string" ? data.warning : null);
      setPublishId(data.publish_id);
      const nextHistory = [{ id: data.publish_id as string, createdAt: new Date().toISOString() }, ...history].slice(0, 50);
      setHistory(nextHistory);
      try { if (accountId) localStorage.setItem(`creatorpulse:publications:${accountId}`, JSON.stringify(nextHistory)); } catch { /* Keep in-memory history. */ }
      setFormVersion(v => v + 1);
      setActiveTab("status");
    } catch (err) {
      console.error("Publish error:", err);
      setPublishError(err instanceof Error ? err.message : "Gagal memulai publikasi");
    } finally {
      publishLock.current = false;
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 bg-muted/40 px-4 sm:px-6 lg:px-8 py-6 lg:py-8" id="main-content">
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Studio Kreator
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Kelola konten dan pantau performa akun TikTok Anda.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lastUpdated && <span className="text-xs text-muted-foreground">Diperbarui {lastUpdated}</span>}
              <Button onClick={() => setActiveTab("publish")} disabled={!profile || publishing}><PlusSquare className="mr-2 h-4 w-4" aria-hidden="true"/> Buat postingan</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnalytics}
                disabled={analyticsLoading || publishing}
                className="flex items-center gap-1.5 w-full sm:w-auto"
              >
                <RefreshCw className="h-4 w-4" />
                {analyticsLoading ? "Memuat..." : "Muat ulang"}
              </Button>
            </div>
          </div>

          {analyticsError && (
            <Card
              className="border-destructive bg-destructive/5"
              role="alert"
              aria-live="polite"
            >
              <CardHeader className="flex flex-row items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                <CardTitle className="text-sm">Gagal memuat analitik</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-destructive">{analyticsError}</p>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8 lg:items-start">
            <TabsList aria-label="Navigasi studio" className="sticky top-12 z-20 grid h-auto w-full grid-cols-4 gap-1 bg-background p-1 shadow-sm lg:sticky lg:top-16 lg:w-52 lg:grid-cols-1 lg:justify-start lg:p-2">
              <TabsTrigger value="analytics" className="flex min-h-12 flex-col gap-1 px-1 text-[11px] sm:text-sm lg:flex-row lg:justify-start lg:px-3"><LayoutDashboard className="h-4 w-4" aria-hidden="true"/> Ringkasan</TabsTrigger>
              <TabsTrigger value="content" className="flex min-h-12 flex-col gap-1 px-1 text-[11px] sm:text-sm lg:flex-row lg:justify-start lg:px-3"><Film className="h-4 w-4" aria-hidden="true"/> Konten</TabsTrigger>
              <TabsTrigger value="publish" className="flex min-h-12 flex-col gap-1 px-1 text-[11px] sm:text-sm lg:flex-row lg:justify-start lg:px-3"><PlusSquare className="h-4 w-4" aria-hidden="true"/> Buat post</TabsTrigger>
              <TabsTrigger value="status" className="flex min-h-12 flex-col gap-1 px-1 text-[11px] sm:text-sm lg:flex-row lg:justify-start lg:px-3"><ListChecks className="h-4 w-4" aria-hidden="true"/> Aktivitas</TabsTrigger>
            </TabsList>
            <div className="min-w-0">

            {/* Tab: Analytics */}
            <TabsContent value="analytics" className="mt-4 space-y-4 lg:mt-0">
              {/* Profile + Metrics */}
              <h2 className="text-lg font-semibold text-foreground mb-4">Profil & Analitik</h2>
              {profile ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-4">
                    <Card>
                      <CardHeader>
                        <div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-3 text-center lg:text-left">
                          <img
                            src={profile.avatar_url}
                            alt={profile.display_name}
                            className="w-12 h-12 rounded-full border border-border mx-auto lg:mx-0"
                          />
                          <div className="text-center lg:text-left">
                            <CardTitle className="text-base font-semibold">
                              {profile.display_name}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              Akun TikTok terhubung
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-3">
                        {profile.bio_description && (
                          <p className="text-xs text-muted-foreground mb-3">
                            {profile.bio_description}
                          </p>
                        )}
                        <details className="space-y-1.5"><summary className="cursor-pointer text-xs text-muted-foreground">Detail akun</summary>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Open ID</span>
                            <span className="text-foreground font-mono text-xs truncate">
                              {profile.open_id}
                            </span>
                          </div>
                          {profile.union_id && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Union ID</span>
                              <span className="text-foreground font-mono text-xs truncate">
                                {profile.union_id}
                              </span>
                            </div>
                          )}
                        </details>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="lg:col-span-8">
                    <AnalyticsCards
                      followers={profile.follower_count}
                      following={profile.following_count}
                      likes={profile.likes_count}
                      videos={profile.video_count}
                    />
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center space-y-3">
                    <p className="text-muted-foreground">{analyticsLoading ? "Memuat profil…" : "Profil tidak tersedia. Coba hubungkan kembali akun Anda."}</p>
                    <Button
                      onClick={fetchAnalytics}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Coba Lagi
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Jika masalah berlanjut, <a href="/api/auth/tiktok" className="underline font-medium">hubungkan kembali akun TikTok</a>.
                    </p>
                  </CardContent>
                </Card>
              )}

            </TabsContent>
            <TabsContent value="content" className="mt-4 space-y-4 lg:mt-0">
              {/* Video List */}
              <h2 className="text-lg font-semibold text-foreground mb-4">Perpustakaan Konten</h2>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    Daftar Video Terbaru
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Video terbaru dari TikTok. Muat ulang untuk memperbarui data.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <p className="text-muted-foreground text-sm">Memuat daftar video...</p>
                    </div>
                  ) : (
                    <VideoList videos={videos} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Publish */}
            <TabsContent forceMount hidden={activeTab !== "publish"} value="publish" className="mt-4 space-y-4 lg:mt-0">
              {profile ? (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
                  <div className="order-2 lg:order-1">
                    <VideoUploadForm
                      key={`${profile.open_id}:${formVersion}`}
                      accountName={profile.display_name}
                      avatarUrl={profile.avatar_url}
                      onPublish={handlePublish}
                      publishing={publishing}
                      error={publishError}
                    />
                  </div>
                  <div className="order-1 lg:order-2 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">
                          Tujuan Posting
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={profile.avatar_url}
                            alt={profile.display_name}
                            className="w-10 h-10 rounded-full border border-border"
                          />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {profile.display_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Akun TikTok yang terhubung
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">
                          Catatan Penting
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                          <li>
                            File dari perangkat: maksimal 4 MB.
                          </li>
                          <li>
                            Untuk video lebih besar, gunakan tautan HTTPS dari domain terverifikasi.
                          </li>
                          <li>Video tidak disimpan permanen di server kami.</li>
                          <li>
                            Tinjau akun, video, dan pengaturan sebelum mengirim.
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground text-sm">
                      {analyticsLoading ? "Memuat profil akun…" : "Profil tidak tersedia. Kembali ke ringkasan untuk mencoba lagi."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab: Status */}
            <TabsContent value="status" className="mt-4 space-y-4 lg:mt-0">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    Riwayat Publikasi
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Pilih publikasi untuk melihat status. Riwayat disimpan pada browser ini, khusus akun yang terhubung.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {publishWarning && <p role="alert" className="mb-3 rounded-md border border-amber-500 p-3 text-sm">{publishWarning}</p>}
                  {history.length > 0 && <div className="mb-4 divide-y rounded-lg border">{history.map((record) => <button type="button" key={record.id} onClick={() => setPublishId(record.id)} aria-pressed={publishId === record.id} className="flex w-full min-w-0 items-center justify-between gap-3 p-3 text-left hover:bg-muted aria-pressed:bg-muted"><span className="min-w-0 truncate text-sm">{record.id}</span><span className="shrink-0 text-xs text-muted-foreground">{new Date(record.createdAt).toLocaleString("id-ID")}</span></button>)}</div>}
                  {publishId ? (
                    <PublishStatusChecker
                      publishId={publishId}
                      key={publishId}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm">
                        {history.length ? "Pilih publikasi untuk memeriksa status." : "Belum ada aktivitas publikasi di browser ini."}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>

      <footer className="border-t border-border bg-muted/50 py-6 px-4">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs sm:text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CreatorPulse Studio. All rights reserved.</p>
          <div className="flex sm:gap-6 gap-3">
            <a href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}