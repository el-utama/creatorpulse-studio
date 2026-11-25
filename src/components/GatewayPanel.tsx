"use client";
import {HermesOnboarding} from "@/components/HermesOnboarding";
import {AgentWorkspace} from "@/components/AgentWorkspace";
import {useCallback,useEffect,useState} from "react";
import {Bot,KeyRound,Link2,RefreshCw,CheckCircle2,AlertCircle} from "lucide-react";

type Health = "checking"|"setup"|"configured"|"error";
export function GatewayPanel({accountName,view="agent"}:{accountName?:string;view?:"agent"|"queue"|"review"}){
 const [health,setHealth]=useState<Health>("checking"),[key,setKey]=useState(""),[unlocked,setUnlocked]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[ok,setOk]=useState(false),[revision,setRevision]=useState(0);
 const check=useCallback(async(signal?:AbortSignal)=>{
  setHealth("checking");
  try{const r=await fetch("/api/gateway/v1/health",{cache:"no-store",signal});if(!r.ok)throw Error();const d=await r.json();if(typeof d.configured!=="boolean")throw Error();setHealth(d.configured?"configured":"setup");}
  catch{if(!signal?.aborted)setHealth("error");}
 },[]);
 useEffect(()=>{const controller=new AbortController();void check(controller.signal);return()=>controller.abort();},[check]);
 async function enroll(){
  if(!key||busy||!accountName)return;setBusy(true);setMessage("");setOk(false);
  try{const r=await fetch("/api/gateway/v1/enroll",{method:"POST",headers:{Authorization:"Bearer "+key}});const d=await r.json();if(!r.ok)throw Error(d.error||"Gagal menghubungkan akun.");setOk(true);setMessage("Akun berhasil dihubungkan. Data operasional akan dimuat kembali.");setRevision(v=>v+1);}
  catch(e){setMessage(e instanceof Error?e.message:"Gateway tidak tersedia.");}finally{setBusy(false);}
 }
 const status={checking:"Memeriksa konfigurasi…",setup:"Belum disiapkan",configured:"Konfigurasi tersedia",error:"Status belum dapat diperiksa"}[health];
 return <div className="space-y-3 md:space-y-5">
 {view==="agent"&&<><section className="studio-panel">
  <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Bot className="h-6 w-6" aria-hidden="true"/></span><div><h2 className="text-base md:text-lg font-semibold">Hermes Agent</h2><p className="mt-1 text-sm text-slate-500">Riset, monitor, dan publikasi.</p></div></div><span role="status" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-slate-700">{health==="configured"?<CheckCircle2 className="h-4 w-4 text-indigo-600"/>:<AlertCircle className="h-4 w-4"/>}{status}</span></div>
  <p className="mt-4 text-sm leading-relaxed text-slate-600">{health==="setup"?"Dashboard manual tetap aktif. Setup Bridge untuk akses agent.":health==="configured"?"Masukkan kunci operator untuk cek koneksi dan akun.":health==="error"?"Gagal cek status. Dashboard manual tetap aktif.":"Memeriksa apakah gateway sudah disiapkan."}</p>
  {health==="error"&&<button onClick={()=>void check()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"><RefreshCw className="h-4 w-4"/> Coba lagi</button>}
  <div className="mt-4 grid gap-2 md:grid-cols-3">{[{n:1,t:"Setup Bridge",d:"Penyimpanan di server Hermes."},{n:2,t:"Hubungkan akun",d:"Gunakan kunci operator."},{n:3,t:"Setup Hermes",d:"Salin instruksi ke Hermes."}].map(x=><div key={x.n} className="flex min-w-0 items-start gap-3 rounded-lg bg-slate-50 p-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">{x.n}</span><div className="min-w-0"><h3 className="text-sm font-semibold">{x.t}</h3><p className="mt-0.5 text-xs leading-relaxed text-slate-500">{x.d}</p></div></div>)}</div>
  <a className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium text-indigo-700" href="https://github.com/el-utama/creatorpulse-studio/tree/main/local-bridge" target="_blank" rel="noreferrer">Panduan Bridge</a>
 </section>
 <HermesOnboarding ready={health==="configured"}/></>}
 {view!=="agent"&&health!=="configured"&&<section className="studio-panel"><h2 className="text-sm font-semibold">Agent queue</h2><p className="mt-2 text-sm text-slate-500">{health==="checking"?"Checking gateway…":health==="error"?"Unable to check gateway.":"Set up Local Bridge in AI Agent to enable agent publishing."}</p>{health==="error"&&<button onClick={()=>void check()} className="mt-3 rounded-md border px-3 py-2 text-sm">Retry</button>}</section>}
 {health==="configured"&&<section className="studio-panel space-y-4"><div><h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-5 w-5 text-indigo-700"/> Akses operator</h2><p className="mt-1 text-sm text-slate-500">Kunci hanya disimpan selama halaman integrasi terbuka. Jangan kirim ke agent.</p></div>
 {!unlocked?<form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={e=>{e.preventDefault();if(key.trim())setUnlocked(true);}}><label className="min-w-0 flex-1 text-sm">Kunci operator<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} className="mt-1 block h-11 w-full rounded-lg border px-3"/></label><button type="submit" disabled={!key.trim()} className="min-h-11 rounded-lg bg-indigo-700 px-4 text-sm font-medium text-white disabled:opacity-50">Buka akses</button></form>:<><div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3"><span className="text-sm font-medium">Kunci dimasukkan</span><button disabled={busy} onClick={()=>{setUnlocked(false);setKey("");setOk(false);setMessage("");}} className="min-h-10 rounded-lg border bg-white px-3 text-sm">Kunci sesi</button></div>
 {view==="agent"&&<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-medium">Akun aktif: {accountName||"Belum tersedia"}</p><p className="text-xs text-slate-500">Hubungkan akun agar dapat dipantau oleh agent.</p></div><button disabled={busy||ok||!accountName} onClick={enroll} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium text-indigo-700 disabled:opacity-50"><Link2 className="h-4 w-4"/>{busy?"Menghubungkan…":ok?"Terhubung":"Hubungkan akun"}</button></div>}
 {message&&<p role="status" className={ok?"text-sm text-green-700":"text-sm text-red-700"}>{message}</p>}</>}
 </section>}
 {health==="configured"&&unlocked&&<AgentWorkspace key={revision} operatorKey={key} section={view}/>}
 </div>
}
