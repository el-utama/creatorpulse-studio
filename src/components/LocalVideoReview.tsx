"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import type {LocalMedia} from "@/lib/gateway/posts";

export function LocalVideoReview({media,onReset,children}:{media:LocalMedia;onReset:()=>void;children:(url?:string,digest?:string,duration?:number)=>ReactNode}){
 const [url,setUrl]=useState(""),[error,setError]=useState(""),[duration,setDuration]=useState<number|null>(null);
 const generation=useRef(0),currentUrl=useRef("");
 useEffect(()=>()=>{generation.current++;if(currentUrl.current)URL.revokeObjectURL(currentUrl.current)},[]);
 async function choose(file:File|undefined){
  const id=++generation.current;onReset();setDuration(null);setUrl("");setError("");
  if(currentUrl.current){URL.revokeObjectURL(currentUrl.current);currentUrl.current="";}
  if(!file)return;
  try{
   if(file.size!==media.size)throw Error("File size does not match the draft.");
   const bytes=await file.arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
   if(id!==generation.current)return;
   if(hash!==media.sha256)throw Error("SHA-256 does not match. Select the original video.");
   const next=URL.createObjectURL(new Blob([bytes],{type:"video/mp4"}));currentUrl.current=next;setUrl(next);
  }catch(e){if(id===generation.current)setError(e instanceof Error?e.message:"Unable to verify file.");}
 }
 return <div className="space-y-3 min-w-0"><label className="block text-sm font-medium">Select matching local video
 <input type="file" accept="video/mp4,.mp4" className="mt-1 block w-full text-sm" onChange={e=>void choose(e.target.files?.[0])}/></label>
 <p className="text-xs text-slate-600">The file stays in your browser during review. It must match the draft SHA-256.</p>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 {url&&<video key={url} src={url} controls preload="metadata" className="max-h-64 w-full rounded bg-black" onLoadedData={e=>{const value=e.currentTarget.duration;setDuration(Number.isFinite(value)&&value>0?value:null)}} onError={()=>{setDuration(null);onReset();setError("Video preview could not be loaded.");}}/>}
 {duration!==null&&<p className="text-xs text-green-700">File matches draft. Preview the video before approval.</p>}
 {children(duration!==null?url:undefined,duration!==null?media.sha256:undefined,duration??undefined)}</div>;
}
