"use client";

export const dynamic = "force-dynamic";

import "./reference.css";
import "./operate.css";
import { useState, useEffect, useCallback, useRef } from "react";
import { WorkspaceData } from "@/components/WorkspaceData";
import { TargetPicker } from "@/components/TargetPicker";
import { Button } from "@/components/ui/button";
import { AccountManager } from "@/components/AccountManager";
import type {GatewaySummary} from "@/components/AgentWorkspace";
import { GatewayPanel } from "@/components/GatewayPanel";
import { VideoUploadForm, type PublishPayload } from "@/components/VideoUploadForm";
import { ChevronRight, Lock, Send, RefreshCw, LayoutDashboard, Film, PlusSquare, ListChecks, Bot, Users, Plus, ArrowLeft, LogOut, AudioLines } from "lucide-react";

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
  const [draftDirty,setDraftDirty]=useState(false);
  const [historyAgentId,setHistoryAgentId]=useState<string|null>(null);
  const closeAgentHistory=useCallback(()=>setHistoryAgentId(null),[]);
  const [targetReady,setTargetReady]=useState(false);
  const [sidebarAccounts,setSidebarAccounts]=useState<{slot:string;name:string}[]>([]);
  const [gatewaySummary,setGatewaySummary]=useState<GatewaySummary|null>(null);
  const [operatorState,setOperatorState]=useState<"unknown"|"locked"|"unlocked">("unknown");
  const [accountFilter,setAccountFilter]=useState("all");
  const [preview,setPreview]=useState<{mode:string;url:string|null;name:string|null;onDuration?:(duration:number|null)=>void}>({mode:"inbox",url:null,name:null});
  const receiveTarget=useCallback((ready:boolean)=>{setTargetReady(ready);if(!ready){setDraftDirty(false);setPreview({mode:"inbox",url:null,name:null})}},[]);
  const [logoutError,setLogoutError]=useState(false);
  useEffect(()=>{const params=new URLSearchParams(location.search);if(params.has("account_changed")){try{localStorage.setItem("creatorpulse:account-change",crypto.randomUUID());}catch{}params.delete("account_changed");window.history.replaceState(null,"","/dashboard"+(params.size?"?"+params.toString():""));}const v=params.get("view");if(v&&["analytics","accounts","content","publish","compose","status","agent","review"].includes(v))setActiveTab(v);const changed=(e:StorageEvent)=>{if(e.key==="creatorpulse:account-change")location.reload()};window.addEventListener("storage",changed);return()=>window.removeEventListener("storage",changed);},[]);
  useEffect(()=>{window.scrollTo({top:0,left:0,behavior:"instant"});},[activeTab]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeAccountSlot,setActiveAccountSlot]=useState<string|null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [history, setHistory] = useState<{ id: string; createdAt: string; mode?:string }[]>([]);
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

  const receiveActive=useCallback((value:UserProfile|null,error:string|null,slot?:string)=>{setActiveAccountSlot(value&&slot&&/^[a-f0-9]{32}$/.test(slot)?slot:null);setProfile(value);setAnalyticsError(error);if(value)setLastUpdated(new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}));},[]);
  const publishLock = useRef(false);
  const [publishing, setPublishing] = useState(false);
  const [publishWarning, setPublishWarning] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const handlePublish = async (payload: PublishPayload) => {
    if (publishLock.current || !accountId || !pendingKey || pending || analyticsLoading || !targetReady) return;
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
        if([400,401,403,429].includes(res.status)||errorData.not_submitted===true) {localStorage.removeItem(pendingKey);reserved=false;setPending(false);}
        throw new Error(errorData.error || "Gagal memulai publikasi");
      }

      const data = await res.json();
      if (!data.publish_id) throw new Error("TikTok belum memberikan ID publikasi.");
      setPublishWarning(typeof data.warning === "string" ? data.warning : null);
      setPublishId(data.publish_id);
      let previous=history;try{const saved=JSON.parse(localStorage.getItem(`creatorpulse:publications:${accountId}`)??"[]");if(Array.isArray(saved))previous=saved.filter(r=>typeof r?.id==="string"&&typeof r?.createdAt==="string");}catch{}
      const nextHistory = [{ id: data.publish_id as string, createdAt: new Date().toISOString(), mode:payload.mode }, ...previous.filter(record => record.id !== data.publish_id)].slice(0, 50);
      setHistory(nextHistory);
      try { if (accountId) localStorage.setItem(`creatorpulse:publications:${accountId}`, JSON.stringify(nextHistory)); } catch { /* Keep in-memory history. */ }
      localStorage.removeItem(pendingKey);reserved=false;setPending(false);setPendingAcknowledged(false);
      setFormVersion(v => v + 1);
      setTargetReady(false);setDraftDirty(false);setPreview({mode:"inbox",url:null,name:null});
      setAccountFilter("all");setActiveTab("status");
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

  const nav=[{id:"analytics",label:"Overview",mobile:"Home",Icon:LayoutDashboard},{id:"accounts",label:"Accounts",mobile:"Accounts",Icon:Users},{id:"content",label:"Content",mobile:"Content",Icon:Film},{id:"publish",label:"Publishing",mobile:"Publish",Icon:Send},{id:"agent",label:"AI Agent",mobile:"Agent",Icon:Bot}];
  const inPublishing=["publish","compose","status","review"].includes(activeTab);
  const selected=inPublishing?"publish":activeTab;
  const title=activeTab==="compose"?"New post":nav.find(n=>n.id===selected)?.label||"Overview";
  useEffect(()=>{if(!draftDirty||pending||publishing)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=""};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[draftDirty,pending,publishing]);
  const canLeave=()=>!publishing&&(!draftDirty||window.confirm("Discard the unsent draft? The draft is not saved."));
  const go=(id:string)=>{if(id===activeTab)return true;if(activeTab==="compose"){if(!canLeave())return false;receiveTarget(false);setFormVersion(v=>v+1);setPublishError(null)}setHistoryAgentId(null);setActiveTab(id);return true;};
  const newPost=()=>{if(activeTab==="compose"||publishing)return;setPreview({mode:"inbox",url:null,name:null});setTargetReady(false);setPublishError(null);setActiveTab("compose");};
  const refresh=()=>{if(publishing)return;setRevision(r=>r+1);};
  async function logout(){if(!canLeave())return;setLogoutError(false);try{const r=await fetch("/api/auth/logout",{method:"POST"});if(!r.ok)throw Error();try{localStorage.setItem("creatorpulse:account-change",crypto.randomUUID())}catch{}location.assign("/");}catch{setLogoutError(true);}}
  const brand=<div className="r1-brand"><span className="r1-brandmark"><AudioLines size={22}/></span><div><div className="r1-brandname">CreatorPulse</div></div></div>;
  const navigate=(id:string)=>{go(id);};
  const scopeAccounts=[...(gatewaySummary?.accounts??[]).map(a=>({slot:a.id,name:a.name})),...sidebarAccounts.filter(a=>!gatewaySummary?.accounts.some(v=>v.id===a.slot))];
  const scopeDisabled=publishing||activeTab==="compose";
  const selectScope=(slot:string)=>{if(scopeDisabled)return;setHistoryAgentId(null);setAccountFilter(slot);};
  const scopedPosts=gatewaySummary?.posts.filter(p=>accountFilter==="all"||p.accountId===accountFilter);
  const navButtons=(mobile:boolean)=>nav.map(({id,label,mobile:short,Icon})=><button key={id} type="button" aria-current={selected===id?"page":undefined} onClick={()=>navigate(id)} className={selected===id?"r1-active":""} aria-label={label}><Icon size={18}/><span>{mobile?short:label}</span></button>);
  const needsReview=scopedPosts?.filter(p=>p.state==="draft"||(p.state==="approved"&&(p.approvedUntil||0)<Date.now())).length;
  const descriptions:Record<string,string>={analytics:"Performance and next actions",accounts:"Manage account access",content:"Public video library",publish:"Review and track publications",status:"Publication history",review:"Drafts awaiting approval",agent:"Integration and research",compose:"Select a target and prepare your video"};
  return <div className="r1 cp-production">
    <a className="cp-skip" href="#main-content">Skip to content</a>
    <header className="r1-topbar cp-masthead">
      <div className="cp-masthead-inner">{brand}
        <nav aria-label="Workspace navigation" className="cp-primary-nav">{navButtons(false)}</nav>
        <div className="r1-top-controls">
          <button className="r1-btn r1-icon-only" aria-label="Refresh workspace" title={lastUpdated||"Refresh"} onClick={refresh} disabled={publishing||analyticsLoading||draftDirty}><RefreshCw size={17}/></button>
          <button type="button" className="r1-operator" title={"Operator access: "+operatorState} aria-label={"Operator access: "+operatorState} onClick={()=>go("agent")}><Lock size={16}/><span>{operatorState==="unlocked"?"Operator":operatorState==="locked"?"Locked":"Unknown"}</span></button>
        </div>
      </div>
    </header>
    <main id="main-content" className="r1-main"><div className="r1-page-head"><div className="r1-grow"><h1>{title}</h1></div>{activeTab==="accounts"?<a className={"r1-btn r1-primary "+(publishing||analyticsLoading||sidebarAccounts.length>=3?"r1-disabled":"")} aria-disabled={publishing||analyticsLoading||sidebarAccounts.length>=3} href={publishing||analyticsLoading||sidebarAccounts.length>=3?undefined:sidebarAccounts.length?"/api/auth/tiktok?add=1":"/api/auth/tiktok"}><Plus size={15}/>Add account</a>:activeTab==="agent"?<button className="r1-btn" onClick={()=>document.getElementById("integration-settings")?.scrollIntoView({block:"start",behavior:"smooth"})}>Settings</button>:activeTab==="compose"?<button className="r1-btn" onClick={()=>go("publish")}><ArrowLeft size={15}/>Back</button>:inPublishing||activeTab==="analytics"?<button className="r1-btn r1-primary" onClick={newPost} disabled={publishing}><Plus size={15}/>New post</button>:null}</div>
        <div className="cp-scope-bar">
          <label className="cp-scope-label" htmlFor="workspace-scope">Account</label>
          <select id="workspace-scope" aria-label="Workspace account" className="cp-scope-select" value={accountFilter} disabled={scopeDisabled} onChange={e=>selectScope(e.target.value)}>
            <option value="all">All accounts</option>
            {accountFilter!=="all"&&!scopeAccounts.some(a=>a.slot===accountFilter)&&<option value={accountFilter} disabled>Selected account unavailable</option>}
            {!!gatewaySummary?.accounts.length&&<optgroup label="Shared · read-only">{gatewaySummary.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>}
            {!!sidebarAccounts.filter(a=>!gatewaySummary?.accounts.some(v=>v.id===a.slot)).length&&<optgroup label="This browser">{sidebarAccounts.filter(a=>!gatewaySummary?.accounts.some(v=>v.id===a.slot)).map(a=><option key={a.slot} value={a.slot}>{a.name}</option>)}</optgroup>}
          </select>
          {accountFilter!=="all"&&<span className="cp-scope-identity">{scopeAccounts.find(a=>a.slot===accountFilter)?.name??"Selected account unavailable"}</span>}
          <span className="cp-scope-hint">{activeTab==="compose"?"Choose the posting account in the form.":activeTab==="accounts"?"Directory shows every connected account.":activeTab==="agent"?"Settings apply to all accounts.":accountFilter!=="all"&&gatewaySummary?.accounts.some(a=>a.id===accountFilter)?"Shared · read-only":"View filter only"}</span>
        </div>
        {inPublishing&&activeTab!=="compose"&&<><div className="r1-account-summary cp-summary-strip">{[["Agent queue",scopedPosts?.filter(p=>!["submitted","cancelled","rejected"].includes(p.state)).length],["Needs review",needsReview],["Submitted",scopedPosts?.filter(p=>p.state==="submitted").length]].map(([label,value])=><div key={label} className={"r1-summary-box "+(label==="Needs review"?"r1-summary-warn":"")}><div className="r1-small r1-muted">{label}</div><div className="r1-metric-value">{value??"—"}</div></div>)}</div><nav aria-label="Publishing views" className="r1-tabs cp-publishing-tabs">{[{id:"publish",label:"Queue"},{id:"review",label:"Review"},{id:"status",label:"History"}].map(t=><button key={t.id} onClick={()=>go(t.id)} aria-label={t.label} aria-current={activeTab===t.id?"page":undefined} className={activeTab===t.id?"r1-active":""}>{t.label}</button>)}</nav></>}
        <WorkspaceData view={activeTab} onNavigate={go} disabled={publishing} revision={revision} onActive={receiveActive} onLoading={setAnalyticsLoading} latestPublication={publishId} onAccounts={setSidebarAccounts} accountFilter={accountFilter} onFilterChange={selectScope} gatewaySummary={gatewaySummary} onSelectAgentHistory={setHistoryAgentId}/>
        {activeTab==="accounts"&&<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div className="flex gap-4 text-xs text-slate-500"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><button onClick={logout} disabled={publishing} className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600"><LogOut className="h-4 w-4"/>Sign out</button>{logoutError&&<p role="alert" className="text-sm text-red-700">Sign out failed. Try again.</p>}</div>}
        <div hidden={activeTab!=="compose"} className="r1-compose-layout"><section className="r1-panel"><div className="r1-panel-head"><div><h2>Create a post</h2><p>Manual publication</p></div></div>{activeTab==="compose"&&<TargetPicker disabled={publishing} onReady={receiveTarget} accountName={profile?.display_name} hasMedia={draftDirty}/>}
        {activeTab==="compose"&&analyticsError&&<p role="alert" className="r1-note">{analyticsError}</p>}
        {profile&&targetReady?<div className="min-w-0">
                    {pending && !publishing && <div role="alert" className="mb-3 space-y-3 rounded-lg border border-destructive p-4 text-sm"><p>Publikasi sebelumnya belum terkonfirmasi. Jangan kirim ulang sebelum memeriksa profil atau inbox TikTok.</p><a className="underline" href="https://www.tiktok.com/" target="_blank" rel="noreferrer">Buka TikTok</a><label className="flex items-center gap-2"><input type="checkbox" checked={pendingAcknowledged} onChange={e=>setPendingAcknowledged(e.target.checked)}/> Saya sudah memeriksa TikTok dan memastikan aman untuk memulai publikasi baru.</label><Button type="button" variant="outline" disabled={!pendingAcknowledged} onClick={()=>{try{if(pendingKey)localStorage.removeItem(pendingKey);setPending(false);setPendingAcknowledged(false);setPublishError(null);setFormVersion(v=>v+1);}catch{setPublishError("Penyimpanan browser tidak tersedia.");}}}>Buka blokir publikasi</Button></div>}
                    <VideoUploadForm
                      key={`${profile.open_id}:${formVersion}`}
                      accountName={profile.display_name}
                      avatarUrl={profile.avatar_url}
                      onPublish={handlePublish}
                      publishing={publishing || pending || analyticsLoading}
                      error={publishError}
                      onPreview={setPreview}
                      onDirty={setDraftDirty}
                    />

          </div>:null}
</section>
        <section className="r1-panel"><div className="r1-panel-head"><div><h2>Video preview</h2><p>{targetReady&&preview.url?"Media selected":"No media loaded"}</p></div></div>{targetReady&&preview.url?<video key={preview.url+":"+preview.mode} aria-label="Pratinjau video" className="r1-preview-video object-contain" src={preview.url} controls preload="metadata" onLoadedMetadata={e=>preview.onDuration?.(e.currentTarget.duration)} onError={()=>preview.onDuration?.(null)}/>:<div className="r1-preview-video"><div><Film size={22} className="mx-auto mb-2"/><p>Video preview</p></div></div>}<div className="r1-form-section"><div className="r1-flex r1-between r1-small"><span className="r1-muted">Account</span><strong className="truncate">{targetReady?profile?.display_name:"Not selected"}</strong></div><div className="r1-flex r1-between r1-small mt-2"><span className="r1-muted">Mode</span><strong>{targetReady&&preview.mode==="profile"?"Direct Post":"Inbox"}</strong></div></div><div className="r1-panel-note">Review the exact target and media before submission.</div></section></div>
        {activeTab==="status"&&publishWarning&&<p role="alert" className="mt-3 rounded-md border border-amber-500 p-3 text-sm">{publishWarning}</p>}
        <div hidden={!["agent","review","publish","status"].includes(activeTab)} className="r1-gateway">
          <GatewayPanel accountFilter={accountFilter} activeAccountSlot={analyticsLoading?null:activeAccountSlot} accountName={profile?.display_name} view={activeTab==="review"?"review":activeTab==="publish"?"queue":activeTab==="status"?"history":"agent"} onSummary={setGatewaySummary} summary={gatewaySummary} onOperatorState={setOperatorState} browserAccounts={sidebarAccounts} workspaceRevision={revision} historyAgentId={historyAgentId} onHistoryClose={closeAgentHistory} accountPicker={<AccountManager name={profile?.display_name} disabled={publishing}/>}/>
        </div>
    </main><nav className="r1-bottomnav" aria-label="Workspace navigation">{navButtons(true)}</nav>
  </div>;
}
