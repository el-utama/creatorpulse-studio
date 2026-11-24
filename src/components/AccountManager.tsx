"use client";
import {useEffect,useState} from "react";
import {ChevronDown,Plus,Check,Trash2,Users} from "lucide-react";
type Account={slot:string;name:string};
type State={accounts:Account[];active:string|null;legacy:boolean;limit:number};
const reasons:Record<string,string>={account_limit:"Batas akun tercapai.",cookie_limit:"Kapasitas sesi browser tidak mencukupi.",existing_session_expired:"Sesi akun lama perlu dihubungkan kembali sebelum menambah akun.",authorization_cancelled:"Penambahan akun dibatalkan.",connection_failed:"Akun belum dapat dihubungkan.",invalid_state:"Sesi otorisasi berakhir. Coba lagi."};
export function AccountManager({name,disabled=false}:{name?:string;disabled?:boolean}){
 const [data,setData]=useState<State|null>(null);const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [confirm,setConfirm]=useState<string|null>(null);
 useEffect(()=>{
  let alive=true;fetch("/api/auth/accounts",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{if(alive)setData(d)}).catch(()=>{if(alive)setError("Daftar akun belum dapat dimuat.")});
  const params=new URLSearchParams(location.search);const reason=params.get("account_error");if(reason){setError(reasons[reason]||"Akun belum dapat dihubungkan.");setOpen(true);}
  if(params.has("account_changed")){try{localStorage.setItem("creatorpulse:account-change",crypto.randomUUID())}catch{}}
  if(reason||params.has("account_changed"))history.replaceState(null,"","/dashboard");
  const onStorage=(e:StorageEvent)=>{if(e.key==="creatorpulse:account-change")location.reload()};
  window.addEventListener("storage",onStorage);return()=>{alive=false;window.removeEventListener("storage",onStorage)};
 },[]);
 const count=(data?.accounts.length||0)+(data?.legacy?1:0);
 async function act(action:"switch"|"remove",slot:string){
  if(busy||disabled)return;setBusy(true);setError("");
  try {const res=await fetch("/api/auth/accounts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,slot})});const result=await res.json();if(!res.ok)throw Error(result.error||"Tindakan gagal.");try{localStorage.setItem("creatorpulse:account-change",crypto.randomUUID())}catch{}location.assign(action==="remove"&&result.remaining===0?"/":"/dashboard");}
  catch(e){setError(e instanceof Error?e.message:"Tindakan gagal.");setBusy(false)}
 }
 return <div className="relative min-w-0"><button type="button" aria-expanded={open} aria-controls="account-menu" disabled={disabled||busy} onClick={()=>setOpen(!open)} className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border bg-white px-3 text-left text-sm"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-700"><Users className="h-4 w-4"/></span><span className="min-w-0 flex-1 truncate font-medium">{name||"Kelola akun"}</span><ChevronDown className="h-4 w-4 shrink-0 text-slate-500"/></button>
 {open&&<section id="account-menu" aria-label="Kelola akun TikTok" className="absolute left-0 right-0 top-full z-40 mt-2 min-w-0 space-y-3 rounded-xl border bg-white p-3 shadow-lg sm:left-auto sm:w-80"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Akun TikTok</h2><span className="text-xs text-slate-500">{data?count+"/"+data.limit:"…"}</span></div>
 {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
 {data?.legacy&&<div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm">{name||"Akun saat ini"} <span className="text-xs text-indigo-700">• Aktif</span></div>}
 {data?.accounts.map(a=><div key={a.slot} className="flex items-center gap-2 border-b pb-2"><button type="button" disabled={busy||disabled||a.slot===data.active} onClick={()=>act("switch",a.slot)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left text-sm"><span className="truncate">{a.name}</span>{a.slot===data.active&&<Check className="h-4 w-4 shrink-0 text-indigo-700"/>}</button><button type="button" disabled={busy||disabled} aria-label={"Lepas "+a.name} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700" onClick={()=>setConfirm(a.slot)}><Trash2 className="h-4 w-4"/></button>{confirm===a.slot&&<div className="absolute inset-x-3 bottom-3 rounded-lg border bg-white p-3 shadow"><p className="text-xs">Lepas akun ini dari browser? Akun TikTok tidak dihapus.</p><div className="mt-2 flex gap-2"><button onClick={()=>setConfirm(null)} className="rounded border px-3 py-2 text-xs">Batal</button><button disabled={busy} onClick={()=>act("remove",a.slot)} className="rounded bg-red-700 px-3 py-2 text-xs text-white">Lepas akun</button></div></div>}</div>)}
 {data&&count<data.limit&&!disabled?<a href="/api/auth/tiktok?add=1" className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-700 px-3 text-sm font-medium text-white"><Plus className="h-4 w-4"/> Tambah akun</a>:<p className="text-xs text-slate-500">{data?"Batas sesi browser tercapai.":"Memuat akun…"}</p>}
 <p className="text-xs leading-relaxed text-slate-500">Untuk akun lain, pilih atau ganti akun pada halaman TikTok. Akun tersimpan hanya di browser ini.</p></section>}</div>
}
