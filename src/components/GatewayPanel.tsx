"use client";
import {HermesOnboarding} from "@/components/HermesOnboarding";
import {AgentWorkspace} from "@/components/AgentWorkspace";
import {useCallback,useEffect,useState} from "react";
import {Bot,KeyRound,Link2,RefreshCw,CheckCircle2,AlertCircle} from "lucide-react";

type Health = "checking"|"setup"|"configured"|"error";
export function GatewayPanel({accountName}:{accountName?:string}){
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
 return <div className="space-y-5">
 <section className="studio-panel">
  <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Bot className="h-6 w-6" aria-hidden="true"/></span><div><h2 className="text-lg font-semibold">Hermes Agent</h2><p className="mt-1 text-sm text-slate-500">Riset, monitoring dan publikasi melalui agent AI.</p></div></div><span role="status" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-slate-700">{health==="configured"?<CheckCircle2 className="h-4 w-4 text-indigo-600"/>:<AlertCircle className="h-4 w-4"/>}{status}</span></div>
  <p className="mt-4 text-sm leading-relaxed text-slate-600">{health==="setup"?"Penggunaan manual tetap tersedia. Untuk mengaktifkan agent, siapkan Local Bridge di server Hermes terlebih dahulu.":health==="configured"?"Konfigurasi server tersedia; buka sesi operator untuk memeriksa akun dan koneksi aktual.":health==="error"?"Status server gagal diperiksa. Coba lagi; dashboard manual tidak terpengaruh.":"Memeriksa apakah gateway sudah disiapkan."}</p>
  {health==="error"&&<button onClick={()=>void check()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"><RefreshCw className="h-4 w-4"/> Coba lagi</button>}
  <div className="mt-5 grid gap-3 md:grid-cols-3">{[{n:1,t:"Siapkan Local Bridge",d:"Penyimpanan dan akses aman di server Hermes."},{n:2,t:"Hubungkan akun",d:"Daftarkan akun TikTok dengan kunci operator."},{n:3,t:"Pasang skill Hermes",d:"Gunakan instruksi siap salin tanpa mengubah chat."}].map(x=><div key={x.n} className="rounded-xl border p-3"><span className="text-xs font-semibold text-indigo-700">Langkah {x.n}</span><h3 className="mt-1 text-sm font-semibold">{x.t}</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">{x.d}</p></div>)}</div>
  <a className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium text-indigo-700" href="https://github.com/el-utama/creatorpulse-studio/tree/main/local-bridge" target="_blank" rel="noreferrer">Panduan Local Bridge</a>
 </section>
 <HermesOnboarding ready={health==="configured"}/>
 {health==="configured"&&<section className="studio-panel space-y-4"><div><h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-5 w-5 text-indigo-700"/> Akses operator</h2><p className="mt-1 text-sm text-slate-500">Kunci hanya disimpan selama halaman integrasi terbuka. Jangan kirim ke agent.</p></div>
 {!unlocked?<form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={e=>{e.preventDefault();if(key.trim())setUnlocked(true);}}><label className="min-w-0 flex-1 text-sm">Kunci operator<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} className="mt-1 block h-11 w-full rounded-lg border px-3"/></label><button disabled={!key.trim()} className="min-h-11 rounded-lg bg-indigo-700 px-4 text-sm font-medium text-white disabled:opacity-50">Muat data operator</button></form>:<><div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3"><span className="text-sm font-medium">Sesi operator lokal</span><button disabled={busy} onClick={()=>{setUnlocked(false);setKey("");setOk(false);setMessage("");}} className="min-h-10 rounded-lg border bg-white px-3 text-sm">Kunci sesi</button></div>
 <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-medium">Akun aktif: {accountName||"Belum tersedia"}</p><p className="text-xs text-slate-500">Hubungkan akun agar dapat dipantau oleh agent.</p></div><button disabled={busy||ok||!accountName} onClick={enroll} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium text-indigo-700 disabled:opacity-50"><Link2 className="h-4 w-4"/>{busy?"Menghubungkan…":ok?"Terhubung":"Hubungkan akun aktif"}</button></div>
 {message&&<p role="status" className={ok?"text-sm text-green-700":"text-sm text-red-700"}>{message}</p>}</>}
 </section>}
 {health==="configured"&&unlocked&&<AgentWorkspace key={revision} operatorKey={key}/>}
 </div>
}
