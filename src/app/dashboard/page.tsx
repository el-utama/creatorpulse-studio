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
import { StudioOverview } from "@/components/StudioOverview";
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
  const [cursor,setCursor]=useState<number|null>(null);
  const [moreLoading,setMoreLoading]=useState(false);
  const [moreError,setMoreError]=useState<string|null>(null);
  const moreLock=useRef(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [history, setHistory] = useState<{ id: string; createdAt: string }[]>([]);
  const accountId = profile?.open_id;
  const [pending,setPending]=useState(false);
  const [pendingAcknowledged,setPendingAcknowledged]=useState(false);
  const pendingKey=accountId?`creatorpulse:pending:${accountId}`:null;
  useEffect(()=>{
    setPendingAcknowledged(false);
    const sync=()=>{try{setPending(!!pendingKey && !!localStorage.getItem(pendingKey));}catch{setPending(false);}};
    sync();window.addEventListener("storage",sync);return ()=>window.removeEventListener("storage",sync);
  },[pendingKey]);
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
    setMoreError(null);
    try {
      const res = await fetch("/api/tiktok/analytics", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 401) { setProfile(null); setVideos([]); setCursor(null); throw new Error("Sesi berakhir. Hubungkan kembali akun TikTok."); }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat analitik");
      setProfile(data.user_info ?? null);
      setVideos(data.videos?.data ?? []);
      setCursor(data.videos?.has_more && Number.isSafeInteger(data.videos.cursor) ? data.videos.cursor : null);
      if (data.video_error) setAnalyticsError(data.video_error);
      setLastUpdated(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const loadMore=async()=>{
    if(cursor===null||moreLock.current||analyticsLoading) return;
    moreLock.current=true;setMoreLoading(true);setMoreError(null);
    try {
      const res=await fetch("/api/tiktok/analytics?cursor="+cursor,{cache:"no-store"});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Gagal memuat video berikutnya.");
      const next=data.videos;
      if(!Array.isArray(next?.data)) throw new Error("Daftar video tidak valid.");
      setVideos(old=>Array.from(new Map<string,import("@/types/tiktok").TikTokVideo>([...old,...(next.data as import("@/types/tiktok").TikTokVideo[])].map(v=>[v.id,v])).values()));
      setCursor(next.has_more && Number.isSafeInteger(next.cursor) && next.cursor!==cursor ? next.cursor:null);
    } catch(error) {setMoreError(error instanceof Error?error.message:"Gagal memuat video berikutnya.");}
    finally {moreLock.current=false;setMoreLoading(false);}
  };
  const publishLock = useRef(false);
  const [publishing, setPublishing] = useState(false);
  const [publishWarning, setPublishWarning] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const handlePublish = async (payload: PublishPayload) => {
    if (publishLock.current || !accountId || !pendingKey || pending) return;
    publishLock.current = true;
    setPublishing(true);
    setPublishError(null);
    const submit = async () => {
      let reserved=false;
      try {
      if(localStorage.getItem(pendingKey)) {setPending(true);throw new Error("Ada publikasi yang belum terkonfirmasi. Periksa TikTok terlebih dahulu.");}
      localStorage.setItem(pendingKey,JSON.stringify({requestId:payload.requestId,createdAt:Date.now()}));reserved=true;setPending(true);
      const formData = new FormData();
      formData.append("accountId",accountId);
      formData.append("mode", payload.mode);
      formData.append("videoUrl", payload.videoUrl ?? "");
      formData.append("caption", payload.caption);
      formData.append("privacy", payload.privacy);
      formData.append("disableComment", String(payload.disableComment));
      formData.append("disableDuet", String(payload.disableDuet));
      formData.append("disableStitch", String(payload.disableStitch));
      formData.append("requestId", payload.requestId);
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
        if([400,401,403,429].includes(res.status)) {localStorage.removeItem(pendingKey);reserved=false;setPending(false);}
        throw new Error(errorData.error || "Gagal memulai publikasi");
      }

      const data = await res.json();
      if (!data.publish_id) throw new Error("TikTok belum memberikan ID publikasi.");
      setPublishWarning(typeof data.warning === "string" ? data.warning : null);
      setPublishId(data.publish_id);
      const nextHistory = [{ id: data.publish_id as string, createdAt: new Date().toISOString() }, ...history.filter(record => record.id !== data.publish_id)].slice(0, 50);
      setHistory(nextHistory);
      try { if (accountId) localStorage.setItem(`creatorpulse:publications:${accountId}`, JSON.stringify(nextHistory)); } catch { /* Keep in-memory history. */ }
      localStorage.removeItem(pendingKey);reserved=false;setPending(false);setPendingAcknowledged(false);
      setFormVersion(v => v + 1);
      setActiveTab("status");
    } catch (err) {
      console.error("Publish error:", err);
      setPublishError(err instanceof Error ? err.message : "Gagal memulai publikasi");
      if(reserved) setPending(true);
      }
    };
    try {
      if(navigator.locks) await navigator.locks.request(pendingKey, {ifAvailable:true}, async lock=>{if(!lock) {setPublishError("Publikasi sedang berlangsung di tab lain.");return;} await submit();});
      else await submit();
    } catch(error) {setPublishError(error instanceof Error?error.message:"Publikasi tidak dapat dikirim.");}
    finally {
      publishLock.current = false;
      setPublishing(false);
    }
  };

  return (
    <div className="studio-shell min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 lg:py-8" id="main-content">
        <div className="max-w-[1440px] mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 lg:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {({analytics:"Ringkasan",content:"Perpustakaan konten",publish:"Buat publikasi",status:"Aktivitas publikasi"} as Record<string,string>)[activeTab] || "Studio Kreator"}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Workspace / {({analytics:"Analitik akun",content:"Konten TikTok",publish:"Editor publikasi",status:"Riwayat & status"} as Record<string,string>)[activeTab]}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lastUpdated && <span className="text-xs text-muted-foreground">Diperbarui {lastUpdated}</span>}
              <Button onClick={() => setActiveTab("publish")} disabled={!profile || publishing}><PlusSquare className="mr-2 h-4 w-4" aria-hidden="true"/> Buat postingan</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnalytics}
                disabled={analyticsLoading || publishing || moreLoading}
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-7 lg:items-start">
            <aside className="studio-sidebar"><div className="hidden lg:block px-3 pb-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Workspace</p><div className="mt-3 flex items-center gap-3 min-w-0"><div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-indigo-100 text-indigo-700 grid place-items-center font-semibold">{profile?.avatar_url?<img src={profile.avatar_url} alt="" className="h-full w-full object-cover"/>:profile?.display_name?.slice(0,1)||"CP"}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{profile?.display_name||"CreatorPulse"}</p><p className="text-xs text-slate-500">{profile?"Akun TikTok terhubung":"Workspace kreator"}</p></div></div></div><TabsList aria-label="Navigasi studio" className="studio-nav grid h-auto w-full grid-cols-4 gap-1 bg-transparent p-0 lg:grid-cols-1 lg:justify-start">
              <TabsTrigger value="analytics" className="studio-tab flex min-h-12 flex-col gap-1 px-1 text-[11px] sm:text-sm lg:flex-row lg:justify-start lg:px-3"><LayoutDashboard className="h-4 w-4" aria-hidden="true"/> Ringkasan</TabsTrigger>
              <TabsTrigger value="content" className="studio-tab flex min-h-12 flex-col gap-1 px-1 text-[11px] sm:text-sm lg:flex-row lg:justify-start lg:px-3"><Film className="h-4 w-4" aria-hidden="true"/> Konten</TabsTrigger>
              <TabsTrigger value="publish" className="studio-tab flex min-h-12 flex-col gap-1 px-1 text-[11px] sm:text-sm lg:flex-row lg:justify-start lg:px-3"><PlusSquare className="h-4 w-4" aria-hidden="true"/> Buat post</TabsTrigger>
              <TabsTrigger value="status" className="studio-tab flex min-h-12 flex-col gap-1 px-1 text-[11px] sm:text-sm lg:flex-row lg:justify-start lg:px-3"><ListChecks className="h-4 w-4" aria-hidden="true"/> Aktivitas</TabsTrigger>
            </TabsList><div className="hidden lg:block mt-5 border-t pt-4 px-3 text-xs text-slate-500 leading-relaxed">Satu akun aktif<br/>Data langsung dari TikTok</div></aside>
            <div className="min-w-0">

            {/* Tab: Analytics */}
            <TabsContent value="analytics" className="mt-4 space-y-5 lg:mt-0">
              {/* Profile + Metrics */}
              
              {profile ? (
                <StudioOverview profile={profile} videos={videos} history={history} onNavigate={setActiveTab} videoError={!!analyticsError}/>
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
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    Koleksi video
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
                    <><VideoList videos={videos} />
                    {moreError && <p role="alert" className="mt-3 text-sm text-destructive">{moreError}</p>}
                    {cursor!==null && <Button type="button" variant="outline" className="mt-4 w-full" onClick={loadMore} disabled={moreLoading}>{moreLoading?"Memuat video…":"Muat video lainnya"}</Button>}
                    <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{videos.length} video dimuat. Pencarian dan urutan berlaku untuk video yang sudah dimuat.</p></>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Publish */}
            <TabsContent forceMount hidden={activeTab !== "publish"} value="publish" className="mt-4 space-y-4 lg:mt-0">
              {profile ? (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
                  <div className="order-2 lg:order-1">
                    {pending && !publishing && <div role="alert" className="mb-3 space-y-3 rounded-lg border border-destructive p-4 text-sm"><p>Publikasi sebelumnya belum terkonfirmasi. Jangan kirim ulang sebelum memeriksa profil atau inbox TikTok.</p><a className="underline" href="https://www.tiktok.com/" target="_blank" rel="noreferrer">Buka TikTok</a><label className="flex items-center gap-2"><input type="checkbox" checked={pendingAcknowledged} onChange={e=>setPendingAcknowledged(e.target.checked)}/> Saya sudah memeriksa TikTok dan memastikan aman untuk memulai publikasi baru.</label><Button type="button" variant="outline" disabled={!pendingAcknowledged} onClick={()=>{try{if(pendingKey)localStorage.removeItem(pendingKey);setPending(false);setPendingAcknowledged(false);setPublishError(null);setFormVersion(v=>v+1);}catch{setPublishError("Penyimpanan browser tidak tersedia.");}}}>Buka blokir publikasi</Button></div>}
                    <VideoUploadForm
                      key={`${profile.open_id}:${formVersion}`}
                      accountName={profile.display_name}
                      avatarUrl={profile.avatar_url}
                      onPublish={handlePublish}
                      publishing={publishing || pending}
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

      <footer className="border-t border-border bg-transparent py-5 px-4">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs sm:text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CreatorPulse Studio. All rights reserved.</p>
          <div className="flex sm:gap-6 gap-3">
            <a href="/privacy" className="hover:text-foreground transition-colors">
              Kebijakan Privasi
            </a>
            <a href="/terms" className="hover:text-foreground transition-colors">
              Ketentuan Layanan
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}