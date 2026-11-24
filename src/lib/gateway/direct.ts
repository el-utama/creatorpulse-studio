import {GatewayError} from "./store";
import type {CreatorCapabilities} from "@/lib/tiktok";
export const privacyLevels=["SELF_ONLY","PUBLIC_TO_EVERYONE","FOLLOWER_OF_CREATOR","MUTUAL_FOLLOW_FRIENDS"] as const;
export type DirectSettings={privacy:string;disableComment:boolean;disableDuet:boolean;disableStitch:boolean;brandOrganic:boolean;brandContent:boolean;isAigc:boolean;musicConsent:true;policyConsent:true};
const flags=["disableComment","disableDuet","disableStitch","brandOrganic","brandContent","isAigc"] as const;
export function directSettings(value:unknown):DirectSettings{
 if(!value||typeof value!=="object")throw new GatewayError(400,"Pengaturan Direct Post wajib dipilih oleh pengguna.");
 const x=value as Record<string,unknown>;
 if(typeof x.privacy!=="string"||!privacyLevels.some(p=>p===x.privacy)||flags.some(f=>typeof x[f]!=="boolean")||x.musicConsent!==true||x.policyConsent!==true)throw new GatewayError(400,"Pilih privasi, interaksi, pengungkapan konten, serta konfirmasi musik dan kebijakan.");
 return {privacy:x.privacy,disableComment:x.disableComment as boolean,disableDuet:x.disableDuet as boolean,disableStitch:x.disableStitch as boolean,brandOrganic:x.brandOrganic as boolean,brandContent:x.brandContent as boolean,isAigc:x.isAigc as boolean,musicConsent:true,policyConsent:true};
}
export function verifyDirect(settings:DirectSettings,duration:number|undefined,c:CreatorCapabilities){
 if(!Number.isFinite(duration)||!duration||duration<=0||!Number.isFinite(c.max_video_post_duration_sec)||duration>c.max_video_post_duration_sec)throw new GatewayError(400,"Durasi video melebihi batas akun atau belum valid.");
 if(!c.privacy_level_options.includes(settings.privacy)||(process.env.TIKTOK_DIRECT_POST_AUDITED!=="true"&&settings.privacy!=="SELF_ONLY"))throw new GatewayError(400,"Visibilitas tidak tersedia untuk akun ini.");
 if((c.comment_disabled&&!settings.disableComment)||(c.duet_disabled&&!settings.disableDuet)||(c.stitch_disabled&&!settings.disableStitch))throw new GatewayError(400,"Interaksi tidak diizinkan oleh pengaturan akun saat ini.");
 if(settings.brandContent&&!["PUBLIC_TO_EVERYONE","MUTUAL_FOLLOW_FRIENDS"].includes(settings.privacy))throw new GatewayError(400,"Kemitraan berbayar tidak dapat memakai visibilitas privat atau pengikut.");
}
export function directPayload(caption:string,s:DirectSettings){return {title:caption,privacy_level:s.privacy,disable_comment:s.disableComment,disable_duet:s.disableDuet,disable_stitch:s.disableStitch,brand_organic_toggle:s.brandOrganic,brand_content_toggle:s.brandContent,is_aigc:s.isAigc};}
