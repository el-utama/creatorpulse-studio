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
import { RefreshCw, LogOut, ShieldAlert } from "lucide-react";

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
  const [videos, setVideos] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch("/api/tiktok/analytics", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("Gagal memuat analitik");
      const data = await res.json();
      setProfile(data.user_info ?? null);
      setVideos(data.videos?.data ?? []);
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
      setPublishId(data.publish_id);
      setPublishStatus("pending");
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

      <main className="flex-1 px-3 sm:px-4 lg:px-6 py-4 sm:py-6" id="main-content">
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Studio Kreator
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Kelola profil, unggah video, dan pantau analitik TikTok Anda.
              </p>
            </div>
            <div className="flex sm:flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnalytics}
                disabled={analyticsLoading}
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full overflow-x-auto scrollbar-hidden pb-1">
              <TabsTrigger value="analytics" className="text-xs sm:text-sm">
                Profil & Analitik
              </TabsTrigger>
              <TabsTrigger value="publish" className="text-xs sm:text-sm">
                Upload & Posting
              </TabsTrigger>
              <TabsTrigger value="status" className="text-xs sm:text-sm">
                Riwayat Publikasi
              </TabsTrigger>
            </TabsList>

            {/* Tab: Analytics */}
            <TabsContent value="analytics" className="mt-4 space-y-4">
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
                        <div className="space-y-1.5">
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
                        </div>
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
                      Jika masalah berlanjut, hubungkan kembali akun TikTok Anda.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Video List */}
              <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">Daftar Video Terbaru</h2>
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
            <TabsContent value="publish" className="mt-4 space-y-4">
              {profile ? (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
                  <div className="order-2 lg:order-1">
                    <VideoUploadForm
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
                            Batas upload langsung lewat serverless Vercel:~4.5 MB.
                          </li>
                          <li>
                            Untuk file lebih besar, gunakan metode PULL_FROM_URL.
                          </li>
                          <li>Video tidak disimpan permanen di server kami.</li>
                          <li>
                            Persetujuan eksplisit diperlukan sebelum publish.
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
            <TabsContent value="status" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    Riwayat Publikasi
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Periksa status publikasi video yang baru saja Anda unggah.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {publishId ? (
                    <PublishStatusChecker
                      publishId={publishId}
                      onStatusChange={setPublishStatus}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm">
                        Belum ada aktivitas publikasi terbaru.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
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