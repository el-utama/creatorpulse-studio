"use client";
import {useEffect,useId,useRef,type ReactNode} from "react";
import {X} from "lucide-react";
export function ReviewDialog({title,children,onDismiss}:{title:string;children:ReactNode;onDismiss:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),heading=useId();
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.showModal();return()=>{if(dialog.open)dialog.close();if(opener?.isConnected&&opener.getClientRects().length)opener.focus({preventScroll:true});};},[]);
 return <dialog ref={ref} className="r1-review-dialog" aria-labelledby={heading} onCancel={e=>{e.preventDefault();onDismiss()}}><header className="r1-panel-head"><h2 id={heading}>{title}</h2><button type="button" autoFocus className="r1-btn r1-icon-only" aria-label="Close review" onClick={onDismiss}><X size={18}/></button></header><div className="r1-review-body">{children}</div></dialog>
}
