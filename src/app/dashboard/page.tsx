"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { WorkspaceData } from "@/components/WorkspaceData";
import { TargetPicker } from "@/components/TargetPicker";
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
import { RefreshCw, ShieldAlert, LayoutDashboard, Film, PlusSquare, ListChecks, Bot, Users, Plus, ArrowLeft, LogOut, AudioLines } from "lucide-react";

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
  const [revision,setRevision]=useState(0);
  const [targetReady,setTargetReady]=useState(false);
  const [logoutError,setLogoutError]=useState(false);
  useEffect(()=>{const params=new URLSearchParams(location.search);const v=params.get("view");if(v&&["analytics","accounts","content","publish","compose","status","agent","review"].includes(v))setActiveTab(v);const changed=(e:StorageEvent)=>{if(e.key==="creatorpulse:account-change")location.reload()};window.addEventListener("storage",changed);return()=>window.removeEventListener("storage",changed);},[]);
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
      if (Array.isArray(records)) {const valid=records.filter((r) => typeof r?.id === "string" && typeof r?.createdAt === "string").slice(0,50);setHistory(valid);const selected=new URLSearchParams(location.search).get("publication");if(selected&&valid.some(r=>r.id===selected))setPublishId(selected);}
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

  const nav=[{id:"analytics",label:"Overview",mobile:"Home",Icon:LayoutDashboard},{id:"accounts",label:"Accounts",mobile:"Accounts",Icon:Users},{id:"content",label:"Content",mobile:"Content",Icon:Film},{id:"publish",label:"Publishing",mobile:"Publish",Icon:PlusSquare},{id:"agent",label:"AI Agent",mobile:"Agent",Icon:Bot}];
  const inPublishing=["publish","compose","status","review"].includes(activeTab);
  const selected=inPublishing?"publish":activeTab;
  const title=nav.find(n=>n.id===selected)?.label||"Overview";
  const newPost=()=>{setTargetReady(false);setActiveTab("compose");};
  const refresh=()=>{setRevision(r=>r+1);void fetchAnalytics();};
  async function logout(){if(publishing)return;setLogoutError(false);try{const r=await fetch("/api/auth/logout",{method:"POST"});if(!r.ok)throw Error();try{localStorage.setItem("creatorpulse:account-change",crypto.randomUUID())}catch{}location.assign("/");}catch{setLogoutError(true);}}
  return <div className="v4-shell min-h-screen bg-[#f7f8fa] text-slate-900">
    <header className="v4-mobile-header sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-white px-4 lg:hidden"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white"><AudioLines className="h-5 w-5"/></span><span className="text-sm font-semibold tracking-tight">CreatorPulse</span><span className="text-[10px] text-slate-500">Studio</span></div><button className="grid h-11 w-11 place-items-center rounded-md text-slate-500" aria-label="Refresh workspace" onClick={refresh} disabled={publishing||analyticsLoading}><RefreshCw className={"h-4 w-4 "+(analyticsLoading?"animate-spin":"")}/></button></header>
    <aside className="v4-sidebar">
      <div className="hidden px-4 pt-6 pb-8 lg:flex items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-white"><AudioLines className="h-5 w-5"/></span><div><div className="text-sm font-semibold tracking-tight">CreatorPulse</div><div className="text-xs text-slate-500">Studio workspace</div></div></div>
      <p className="hidden px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 lg:block">Workspace</p>
      <nav aria-label="Workspace navigation" className="v4-nav">{nav.map(({id,label,mobile,Icon})=><button key={id} type="button" aria-current={selected===id?"page":undefined} onClick={()=>setActiveTab(id)} className="v4-nav-item"><Icon className="h-5 w-5 shrink-0 lg:h-[18px] lg:w-[18px]" aria-hidden="true"/><span className="hidden lg:inline">{label}</span><span className="lg:hidden">{mobile}</span></button>)}</nav>
      <div className="hidden flex-1 lg:block"/>
      <div className="hidden border-t px-4 py-4 lg:block"><button onClick={newPost} disabled={publishing} className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4"/>New post</button><div className="mt-4 flex justify-between text-[11px] text-slate-500"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div></div>
    </aside>
    <main id="main-content" className="v4-main min-w-0">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-5 flex min-w-0 items-center justify-between gap-3 lg:mb-7"><h1 className="min-w-0 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1><div className="flex shrink-0 items-center gap-2">
        <button aria-label="Refresh workspace" title={lastUpdated||"Refresh"} onClick={refresh} disabled={publishing||analyticsLoading} className="hidden h-10 w-10 place-items-center rounded-md border bg-white text-slate-600 disabled:opacity-50 lg:grid"><RefreshCw className={"h-4 w-4 "+(analyticsLoading?"animate-spin":"")}/></button>
        {activeTab==="analytics"||activeTab==="publish"||activeTab==="status"||activeTab==="review"?<button onClick={newPost} disabled={publishing} className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-medium text-white disabled:opacity-50 sm:text-sm"><Plus className="h-4 w-4"/>New post</button>:null}</div></div>
        <WorkspaceData view={activeTab} onNavigate={setActiveTab} disabled={publishing} revision={revision}/>
        {activeTab==="accounts"&&<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div className="flex gap-4 text-xs text-slate-500"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><button onClick={logout} disabled={publishing} className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600"><LogOut className="h-4 w-4"/>Sign out</button>{logoutError&&<p role="alert" className="text-sm text-red-700">Sign out failed. Try again.</p>}</div>}
        {inPublishing&&<nav aria-label="Publishing views" className="mb-4 flex gap-4 border-b text-sm font-medium text-slate-500">{[{id:"publish",label:"Queue"},{id:"review",label:"Review"},{id:"status",label:"History"}].map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} className={"min-h-11 border-b-2 px-1 "+(activeTab===t.id?"border-slate-900 text-slate-900":"border-transparent")}>{t.label}</button>)}</nav>}
        {activeTab==="publish"&&<section className="mb-3 rounded-lg border bg-white p-4"><h2 className="text-sm font-semibold">Publishing workspace</h2><div className="mt-3 divide-y"><button onClick={newPost} className="flex min-h-14 w-full items-center gap-3 text-left"><PlusSquare className="h-5 w-5 text-slate-500"/><span className="flex-1"><span className="block text-sm font-medium">New post</span><span className="text-xs text-slate-500">Choose a target account</span></span></button><button onClick={()=>setActiveTab("review")} className="flex min-h-14 w-full items-center gap-3 text-left"><ListChecks className="h-5 w-5 text-slate-500"/><span><span className="block text-sm font-medium">Agent queue & review</span><span className="text-xs text-slate-500">Operator access required</span></span></button><button onClick={()=>setActiveTab("status")} className="flex min-h-14 w-full items-center gap-3 text-left"><Film className="h-5 w-5 text-slate-500"/><span className="text-sm font-medium">Publication history</span></button></div></section>}
        {activeTab==="compose"&&<div className="mb-4 space-y-3"><button onClick={()=>setActiveTab("publish")} className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-slate-600"><ArrowLeft className="h-4 w-4"/>Back to queue</button><TargetPicker disabled={publishing} onReady={setTargetReady} accountName={profile?.display_name}/>{analyticsError&&<p role="alert" className="text-sm text-red-700">{analyticsError}</p>}</div>}
        <div hidden={activeTab!=="compose"||!targetReady} className="max-w-[760px]">
          {profile&&targetReady?<div className="min-w-0">
                    {pending && !publishing && <div role="alert" className="mb-3 space-y-3 rounded-lg border border-destructive p-4 text-sm"><p>Publikasi sebelumnya belum terkonfirmasi. Jangan kirim ulang sebelum memeriksa profil atau inbox TikTok.</p><a className="underline" href="https://www.tiktok.com/" target="_blank" rel="noreferrer">Buka TikTok</a><label className="flex items-center gap-2"><input type="checkbox" checked={pendingAcknowledged} onChange={e=>setPendingAcknowledged(e.target.checked)}/> Saya sudah memeriksa TikTok dan memastikan aman untuk memulai publikasi baru.</label><Button type="button" variant="outline" disabled={!pendingAcknowledged} onClick={()=>{try{if(pendingKey)localStorage.removeItem(pendingKey);setPending(false);setPendingAcknowledged(false);setPublishError(null);setFormVersion(v=>v+1);}catch{setPublishError("Penyimpanan browser tidak tersedia.");}}}>Buka blokir publikasi</Button></div>}
                    <VideoUploadForm
                      key={`${profile.open_id}:${formVersion}`}
                      accountName={profile.display_name}
                      avatarUrl={profile.avatar_url}
                      onPublish={handlePublish}
                      publishing={publishing || pending}
                      error={publishError}
                    />

          </div>:null}
        </div>
        {activeTab==="status"&&<section className="space-y-3 rounded-lg border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Manual history</h2><div className="w-40"><AccountManager name={profile?.display_name} disabled={publishing}/></div></div><p className="text-xs text-slate-500">Selected account · this browser</p>
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

        </section>}
        {["agent","review","publish"].includes(activeTab)&&<div>
          {activeTab==="agent"&&<div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>Account for enrollment</span><div className="w-48"><AccountManager name={profile?.display_name} disabled={publishing}/></div></div>}
          <GatewayPanel accountName={profile?.display_name} view={activeTab==="review"?"review":activeTab==="publish"?"queue":"agent"}/>
        </div>}
      </div>
    </main>
  </div>;
}
