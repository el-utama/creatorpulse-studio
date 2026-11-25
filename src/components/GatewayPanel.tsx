"use client";
import {HermesOnboarding} from "@/components/HermesOnboarding";
import {AgentWorkspace,type GatewaySummary} from "@/components/AgentWorkspace";
import {useCallback,useEffect,useState} from "react";
import {Bot,KeyRound,Link2,RefreshCw,CheckCircle2,AlertCircle,ShieldCheck} from "lucide-react";

type Health = "checking"|"setup"|"configured"|"error";
export function GatewayPanel({accountName,view="agent",onSummary}:{accountName?:string;view?:"agent"|"queue"|"review"|"history";onSummary:(data:GatewaySummary|null)=>void}){
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
 useEffect(()=>{if(!unlocked||health!=="configured")onSummary(null)},[unlocked,health,onSummary]);
 const status={checking:"Memeriksa konfigurasi…",setup:"Belum disiapkan",configured:"Konfigurasi tersedia",error:"Status belum dapat diperiksa"}[health];
 return <div className="r1-stack" style={{gap:12}}>
 {view==="agent"&&<div className="r1-agent-grid"><section className="r1-panel"><div className="r1-agent-status"><span className="r1-agentmark"><Bot size={22}/></span><div className="r1-grow"><h2>Hermes Agent</h2><p className="r1-small r1-muted">Research · Monitoring · Publishing</p></div><span className="r1-pill r1-neutral" role="status">{status}</span></div><dl className="r1-agent-detail"><div><dt>Local Bridge</dt><dd>{health==="setup"?"Not configured":health==="configured"?"Configuration found":"Not verified"}</dd></div><div><dt>Hermes connection</dt><dd>Not verified</dd></div><div><dt>Operator access</dt><dd>{unlocked?"Key entered":"Locked"}</dd></div><div><dt>Approval authority</dt><dd>Human dashboard</dd></div></dl><div className="r1-check-row"><ShieldCheck size={16}/><span className="r1-grow">Restricted agent credential · No approval tool</span></div><div className="r1-check-row r1-warning"><AlertCircle size={16}/><span className="r1-grow">{health==="setup"?"Set up Local Bridge first":health==="configured"?"Unlock to read Bridge records":"Check gateway configuration"}</span>{health==="error"&&<button className="r1-btn" onClick={()=>void check()}>Coba lagi</button>}</div></section><section className="r1-panel"><div className="r1-panel-head"><div><h2>Integration settings</h2><p>Setup and diagnostics</p></div></div><div className="r1-check-row"><Link2 size={16}/><a href="https://github.com/el-utama/creatorpulse-studio/tree/main/local-bridge" target="_blank" rel="noreferrer">Panduan Bridge</a></div><div className="r1-check-row"><button className="r1-btn" onClick={()=>void check()}><RefreshCw size={15}/>Connection check</button></div><div className="r1-onboarding"><HermesOnboarding ready={health==="configured"}/></div></section></div>}
 {view!=="agent"&&health!=="configured"&&<section className="r1-panel r1-form-section"><h2 className="text-sm font-semibold">Agent queue</h2><p className="mt-2 text-sm text-slate-500">{health==="checking"?"Checking gateway…":health==="error"?"Unable to check gateway.":"Set up Local Bridge in AI Agent to enable agent publishing."}</p>{health==="error"&&<button onClick={()=>void check()} className="mt-3 rounded-md border px-3 py-2 text-sm">Retry</button>}</section>}
 {health==="configured"&&<section className="r1-panel r1-form-section space-y-3"><div><h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-5 w-5 text-indigo-700"/> Akses operator</h2><p className="mt-1 text-sm text-slate-500">Operator key hanya di memori halaman. Jangan bagikan ke agent.</p></div>
 {!unlocked?<form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={e=>{e.preventDefault();if(key.trim())setUnlocked(true);}}><label className="min-w-0 flex-1 text-sm">Kunci operator<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} className="mt-1 block h-11 w-full rounded-lg border px-3"/></label><button type="submit" disabled={!key.trim()} className="r1-btn r1-primary">Buka akses</button></form>:<><div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3"><span className="text-sm font-medium">Kunci dimasukkan</span><button disabled={busy} onClick={()=>{setUnlocked(false);setKey("");setOk(false);setMessage("");}} className="min-h-10 rounded-lg border bg-white px-3 text-sm">Kunci sesi</button></div>
 {view==="agent"&&<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-medium">Akun aktif: {accountName||"Belum tersedia"}</p><p className="text-xs text-slate-500">Hubungkan akun agar dapat dipantau oleh agent.</p></div><button disabled={busy||ok||!accountName} onClick={enroll} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium text-indigo-700 disabled:opacity-50"><Link2 className="h-4 w-4"/>{busy?"Menghubungkan…":ok?"Terhubung":"Hubungkan akun"}</button></div>}
 {message&&<p role="status" className={ok?"text-sm text-green-700":"text-sm text-red-700"}>{message}</p>}</>}
 </section>}
 {health==="configured"&&unlocked&&<AgentWorkspace key={revision} operatorKey={key} section={view} onSummary={onSummary}/>}
 </div>
}
