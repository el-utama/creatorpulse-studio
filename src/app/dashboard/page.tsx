"use client";

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
import { RefreshCw, LogOut, UserCircle, ShieldAlert } from "lucide-react";

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
      const [userRes, videoRes] = await Promise.all([
        fetch("/api/tiktok/analytics", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }),
        fetch("/api/tiktok/analytics", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }),
      ]);

      if (!userRes.ok) throw new Error("Gagal memuat profil");
      const userData = await userRes.json();
      setProfile(userData.user_info ?? null);

      if (!videoRes.ok) throw new Error("Gagal memuat daftar video");
      const videoData = await videoRes.json();
      setVideos(videoData.videos?.data ?? []);
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
    // In a real implementation, this would call /api/tiktok/publish
    // For demo purposes, we simulate receiving a publish_id
    setPublishId(`publish_${Date.now()}`);
    setPublishStatus("pending");
    setActiveTab("publish");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dasbor Creator</h1>
              <p className="text-muted-foreground text-sm">
                Kelola profil, unggah video, dan pantau analitik TikTok Anda.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnalytics}
                disabled={analyticsLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {analyticsLoading ? "Memuat..." : "Refresh Analytics"}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => (window.location.href = "/"))}>
                <LogOut className="h-4 w-4 mr-2" />
                Keluar
              </Button>
            </div>
          </div>

          {analyticsError && (
            <Card className="border-destructive bg-destructive/50">
              <CardHeader className="flex flex-row items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <CardTitle className="text-sm">Gagal memuat analitik</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-destructive">{analyticsError}</p>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs defaultValue="analytics" onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid w-grid-cols-1 md:grid-cols-3 gap-2">
              <TabsTrigger value="analytics" className="text-sm">
                Profil & Analitik
              </TabsTrigger>
              <TabsTrigger value="publish" className="text-sm">
                Upload & Posting
              </TabsTrigger>
              <TabsTrigger value="status" className="text-sm">
                Riwayat Publikasi
              </TabsTrigger>
            </TabsList>

            {/* Tab: Analytics */}
            <TabsContent value="analytics" className="mt-6 space-y-6">
              {/* Profile + Metrics */}
              {profile ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <img
                            src={profile.avatar_url}
                            alt={profile.display_name}
                            className="w-16 h-16 rounded-full border border-border"
                          />
                          <div>
                            <CardTitle className="text-lg">{profile.display_name}</CardTitle>
                            <p className="text-xs text-muted-foreground">@{profile.open_id}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        {profile.bio_description && (
                          <p className="text-sm text-muted-foreground mb-4">{profile.bio_description}</p>
                        )}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Open ID</span>
                            <span className="text-foreground font-mono text-xs truncate">{profile.open_id}</span>
                          </div>
                          {profile.union_id && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Union ID</span>
                              <span className="text-foreground font-mono text-xs truncate">{profile.union_id}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="md:col-span-8">
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
                  <CardContent className="py-12 text-center space-y-3">
                    <p className="text-muted-foreground">Profil tidak tersedia.</p>
                    <Button
                      onClick={fetchAnalytics}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Coba Lagi
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Pastikan scope <code className="bg-muted px-1 py-0.5 rounded">user.info.profile</code> telah diizinkan di portal TikTok for Developers.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Video List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Daftar Video Terbaru</CardTitle>
                  <CardDescription>
                    Data dari TikTok Display API (video.list). Klik tombol Refresh Analytics untuk memuat ulang.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="h-64 flex items-center justify-center">
                      <p className="text-muted-foreground">Memuat daftar video...</p>
                    </div>
                  ) : (
                    <VideoList videos={videos} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Publish */}
            <TabsContent value="publish" className="mt-6 space-y-6">
              {profile ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-3">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Tujuan Posting</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={profile.avatar_url}
                            alt={profile.display_name}
                            className="w-12 h-12 rounded-full border border-border"
                          />
                          <div>
                            <p className="text-sm font-medium text-foreground">{profile.display_name}</p>
                            <p className="text-xs text-muted-foreground">Akun TikTok yang terhubung</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Catatan Penting</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
                          <li>Batas upload langsung lewat serverless Vercel: ~4.5 MB.</li>
                          <li>Untuk file lebih besar, gunakan metode PULL_FROM_URL.</li>
                          <li>Video tidak disimpan permanen di server kami.</li>
                          <li>Persetujuan eksplisit diperlukan sebelum publish.</li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="lg:col-span-9">
                    <VideoUploadForm
                      accountName={profile.display_name}
                      avatarUrl={profile.avatar_url}
                      onPublish={handlePublish}
                    />
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Memuat profil akun...</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab: Status */}
            <TabsContent value="status" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Riwayat Publikasi</CardTitle>
                  <CardDescription>
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
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Belum ada aktivitas publikasi terbaru.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <footer className="border-t border-border bg-muted/50 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CreatorPulse Studio. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}