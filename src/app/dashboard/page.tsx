"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
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
import { VideoUploadForm } from "@/components/VideoUploadForm";
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
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
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

  const handlePublish = (payload: any) => {
    setPublishId(`publish_${Date.now()}`);
    setPublishStatus("pending");
    setActiveTab("status");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 px-3 sm:px-4 lg:px-6 py-4 sm:py-6" id="main-content">
        <div className="max-w-xl sm:max-w-2xl lg:max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                Dasbor Creator
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
                {analyticsLoading ? "Memuat..." : "Refresh"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  fetch("/api/auth/logout", { method: "POST" }).then(() => {
                    window.location.href = "/";
                  })
                }
                className="w-full sm:w-auto"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Keluar
              </Button>
            </div>
          </div>

          {analyticsError && (
            <Card
              className="border-destructive bg-destructive/50"
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
          <Tabs defaultValue="analytics" onValueChange={setActiveTab} className="w-full">
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
                              @{profile.open_id}
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
                    <p className="text-muted-foreground">Profil tidak tersedia.</p>
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
                      Pastikan scope <code className="bg-muted px-1 py-0 rounded">user.info.profile</code> telah diizinkan di portal TikTok for Developers.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Video List */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    Daftar Video Terbaru
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Data dari TikTok Display API (video.list). Klik Refresh untuk memuat ulang.
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
                <div className="grid grid-cols-1 gap-4">
                  <div className="order-2">
                    <VideoUploadForm
                      accountName={profile.display_name}
                      avatarUrl={profile.avatar_url}
                      onPublish={handlePublish}
                    />
                  </div>
                  <div className="order-1 lg:order-2">
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
                      Memuat profil akun...
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
        <div className="max-w-xl sm:max-w-2xl lg:max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs sm:text-sm text-muted-foreground">
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