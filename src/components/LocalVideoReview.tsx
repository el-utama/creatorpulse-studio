"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import type {LocalMedia} from "@/lib/gateway/posts";

export function LocalVideoReview({media,onReset,children}:{media:LocalMedia;onReset:()=>void;children:(url?:string,digest?:string)=>ReactNode}){
 const [url,setUrl]=useState(""),[error,setError]=useState(""),[loaded,setLoaded]=useState(false);
 const generation=useRef(0),currentUrl=useRef("");
 useEffect(()=>()=>{generation.current++;if(currentUrl.current)URL.revokeObjectURL(currentUrl.current)},[]);
 async function choose(file:File|undefined){
  const id=++generation.current;onReset();setLoaded(false);setUrl("");setError("");
  if(currentUrl.current){URL.revokeObjectURL(currentUrl.current);currentUrl.current="";}
  if(!file)return;
  try{
   if(file.size!==media.size)throw Error("Ukuran file tidak cocok dengan draft.");
   const bytes=await file.arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
   if(id!==generation.current)return;
   if(hash!==media.sha256)throw Error("SHA-256 berbeda. Pilih file yang sama dengan draft.");
   const next=URL.createObjectURL(new Blob([bytes],{type:"video/mp4"}));currentUrl.current=next;setUrl(next);
  }catch(e){if(id===generation.current)setError(e instanceof Error?e.message:"Tidak dapat memverifikasi file.");}
 }
 return <div className="space-y-3"><label className="block text-sm">Pilih salinan video lokal yang sama untuk tinjauan
 <input type="file" accept="video/mp4,.mp4" className="mt-1 block w-full text-sm" onChange={e=>void choose(e.target.files?.[0])}/></label>
 <p className="text-xs text-slate-600">File tidak dikirim saat review. SHA-256 harus cocok dengan draft agent.</p>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 {url&&<video key={url} src={url} controls preload="metadata" className="max-h-64 w-full rounded bg-black" onLoadedData={()=>setLoaded(true)} onError={()=>{setLoaded(false);onReset();setError("Pratinjau file tidak dapat dimuat.");}}/>}
 {loaded&&<p className="text-xs text-green-700">File cocok dengan draft. Tinjau video sebelum menyetujui.</p>}
 {children(loaded?url:undefined,loaded?media.sha256:undefined)}</div>;
}
