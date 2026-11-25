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
import { AccountManager } from "@/components/AccountManager";
import { StudioOverview } from "@/components/StudioOverview";
import { GatewayPanel } from "@/components/GatewayPanel";
import { VideoList } from "@/components/VideoList";
import { VideoUploadForm, type PublishPayload } from "@/components/VideoUploadForm";
import { PublishStatusChecker } from "@/components/PublishStatusChecker";
import { RefreshCw, ShieldAlert, LayoutDashboard, Film, PlusSquare, ListChecks, Bot } from "lucide-react";

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
  useEffect(()=>{if(window.matchMedia("(max-width: 767px)").matches)window.scrollTo({top:0,behavior:"auto"});},[activeTab]);
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

      <main className="studio-main flex-1 px-3 sm:px-6 lg:px-8 py-3 md:py-5 lg:py-8" id="main-content">
        <div className="max-w-[1440px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3 md:gap-3 md:mb-6 lg:mb-8">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg leading-tight md:text-3xl font-semibold tracking-tight text-foreground">
                <span className="md:hidden">{({analytics:"Ringkasan",content:"Konten",publish:"Publish",status:"Aktivitas",agent:"Integrasi AI"} as Record<string,string>)[activeTab]}</span><span className="hidden md:inline">{({analytics:"Ringkasan",content:"Konten",publish:"Publish",status:"Aktivitas",agent:"Integrasi AI"} as Record<string,string>)[activeTab] || "Studio Kreator"}</span>
              </h1>
              <p className="hidden md:block text-sm text-muted-foreground">
                {({analytics:"Analitik akun",content:"Konten TikTok",publish:"Editor publikasi",status:"Riwayat & status",agent:"Koneksi & operasional Hermes"} as Record<string,string>)[activeTab]}
              </p>
            </div>
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 md:gap-2">
              <div className="w-[105px] min-[375px]:w-[138px] md:w-56"><AccountManager name={profile?.display_name} disabled={publishing}/></div>
              {lastUpdated && activeTab!=="agent" && <span className="hidden lg:inline text-xs text-muted-foreground">Diperbarui {lastUpdated}</span>}
              {activeTab!=="agent"&&<Button
                variant="outline"
                size="sm"
                onClick={fetchAnalytics}
                disabled={analyticsLoading || publishing || moreLoading}
                aria-label="Muat ulang"
                title={lastUpdated?"Diperbarui "+lastUpdated:"Muat ulang"}
                className="flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 p-0 md:h-9 md:w-auto md:px-3"
              >
                <RefreshCw className={"h-4 w-4 shrink-0 "+(analyticsLoading?"animate-spin":"")} aria-hidden="true"/>
                <span className="hidden md:inline">{analyticsLoading ? "Memuat..." : "Muat ulang"}</span>
              </Button>}
            </div>
          </div>

          {analyticsError && activeTab!=="agent" && (
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6 lg:items-start">
            <aside className="studio-sidebar">
 <div className="hidden min-w-0 lg:block px-2 pb-3"><p className="mb-3 text-[11px] font-medium text-slate-500">Akun aktif</p><div className="flex items-center gap-2.5 min-w-0"><div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-indigo-100 text-indigo-700 grid place-items-center text-sm font-semibold">{profile?.avatar_url?<img src={profile.avatar_url} alt="" className="h-full w-full object-cover"/>:profile?.display_name?.slice(0,1)||"CP"}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{profile?.display_name||"CreatorPulse"}</p><p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><span className={"h-1.5 w-1.5 shrink-0 rounded-full "+(profile?"bg-emerald-600":"bg-slate-400")}/>{profile?"Terhubung":"Belum terhubung"}</p></div></div></div>
 <TabsList aria-label="Navigasi studio" className="studio-nav grid h-auto w-full grid-cols-5 gap-1 bg-transparent p-0 lg:grid-cols-1 lg:justify-start">
 {([{value:"analytics",label:"Ringkasan",Icon:LayoutDashboard},{value:"content",label:"Konten",Icon:Film},{value:"publish",label:"Publish",Icon:PlusSquare},{value:"status",label:"Aktivitas",Icon:ListChecks},{value:"agent",label:"AI Agent",Icon:Bot}]).map(({value,label,Icon})=><TabsTrigger key={value} value={value} className="studio-tab flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10px] min-[375px]:text-[11px] md:text-sm lg:min-h-11 lg:flex-row lg:justify-start lg:gap-2.5 lg:px-2.5"><Icon className="h-5 w-5 shrink-0 lg:h-4 lg:w-4" aria-hidden="true"/><span className="truncate">{label}</span></TabsTrigger>)}
 </TabsList>
 <p className="hidden lg:block mt-3 border-t pt-3 px-2 text-xs text-slate-500">Maksimal 3 akun TikTok</p>
 </aside>
            <div className="min-w-0">

            {/* Tab: Analytics */}
            <TabsContent value="analytics" className="mt-0 space-y-3 md:mt-4 lg:mt-0">
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
            <TabsContent value="content" className="mt-0 space-y-3 md:mt-4 lg:mt-0">
              {/* Video List */}
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    Koleksi video
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Video dari TikTok.
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
                    {cursor!==null && <Button type="button" variant="outline" className="mt-4 w-full" onClick={loadMore} disabled={moreLoading}>{moreLoading?"Memuat video…":"Muat lagi"}</Button>}
                    <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{videos.length} video dimuat. Pencarian hanya pada video ini.</p></>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Publish */}
            <TabsContent forceMount hidden={activeTab !== "publish"} value="publish" className="mt-0 space-y-3 md:mt-4 lg:mt-0">
              {profile ? (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
                  <div className="min-w-0">
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
                  <div className="min-w-0 space-y-4">

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">
                          Catatan
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                          <li>
                            File dari perangkat: maksimal 4 MB.
                          </li>
                          <li>
                            Video lebih besar: gunakan URL HTTPS terverifikasi.
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
            <TabsContent value="status" className="mt-0 space-y-3 md:mt-4 lg:mt-0">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    Riwayat
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Pilih publikasi untuk cek status. Riwayat tersimpan di browser ini.
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
            <TabsContent value="agent" className="mt-0 space-y-3 md:mt-4 lg:mt-0"><GatewayPanel accountName={profile?.display_name} /></TabsContent>
            </div>
          </Tabs>
        </div>
      </main>

      <footer className="hidden md:block border-t border-border bg-transparent py-5 px-4">
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