"use client";
import {HermesOnboarding} from "@/components/HermesOnboarding";
import {AgentWorkspace} from "@/components/AgentWorkspace";
import {useEffect,useState} from "react";
import {KeyRound,Link2,CheckCircle2} from "lucide-react";
export function GatewayPanel({accountName}:{accountName:string}){
 const [configured,setConfigured]=useState(false),[loaded,setLoaded]=useState(false),[open,setOpen]=useState(false),[key,setKey]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[ok,setOk]=useState(false);
 useEffect(()=>{let alive=true;fetch("/api/gateway/v1/health",{cache:"no-store"}).then(r=>r.json()).then(d=>{if(alive){setConfigured(d.configured===true);setLoaded(true);}}).catch(()=>{});return()=>{alive=false}},[]);
 async function enroll(){
 if(!key||busy)return;setBusy(true);setMessage("");setOk(false);
 try{const r=await fetch("/api/gateway/v1/enroll",{method:"POST",headers:{Authorization:"Bearer "+key}});const d=await r.json();if(!r.ok)throw Error(d.error||"Gagal menghubungkan gateway.");setOk(true);setMessage("Akun terhubung ke gateway. Muat ulang dasbor untuk melanjutkan.");}
 catch(e){setMessage(e instanceof Error?e.message:"Gateway tidak tersedia.");}finally{setKey("");setBusy(false)}
 }
 if(!loaded)return null;
 return <><section className="studio-panel"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Link2 className="h-5 w-5"/></span><div className="min-w-0 flex-1"><h2 className="font-semibold">Integrasi AI Agent</h2><p className="mt-1 text-sm text-slate-500">{configured?"Gateway monitoring, antrean inbox, dan riset tersedia. Hubungkan akun aktif secara eksplisit.":"Local Bridge belum dikonfigurasi. Dasbor manual tetap berfungsi."}</p>{configured&&<button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} className="mt-3 text-sm font-semibold text-indigo-700">Hubungkan {accountName}</button>}</div></div>
 {open&&configured&&<div className="mt-4 space-y-3 rounded-xl border p-4"><p className="text-xs text-slate-600">Izinkan gateway menyimpan kredensial akun aktif secara terenkripsi pada Local Bridge di server Hermes untuk monitoring tanpa browser. Pengiriman ke inbox memerlukan persetujuan terpisah.</p><label className="block text-sm font-medium"><KeyRound className="mr-1 inline h-4 w-4"/> Kunci operator<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} className="mt-2 block w-full rounded-lg border px-3 py-2"/></label><button disabled={busy||!key||ok} onClick={enroll} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm text-white disabled:opacity-50">Hubungkan akun</button>{message&&<p role="status" className={ok?"text-sm text-green-700":"text-sm text-red-700"}>{ok&&<CheckCircle2 className="mr-1 inline h-4 w-4"/>}{message}</p>}</div>}<div className="mt-4"><HermesOnboarding/></div></section>{configured&&<AgentWorkspace/>}</>
}
