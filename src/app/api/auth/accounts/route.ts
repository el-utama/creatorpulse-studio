import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {accounts,currentSlot,activate,removeSlot,clearAccounts,validSlot,sameOrigin,MAX_ACCOUNTS} from "@/lib/accounts";
import {APP_CONFIG} from "@/config/app";
const headers={"Cache-Control":"no-store"};
export async function GET(){
 const jar=await cookies();const list=accounts(jar),active=currentSlot(jar);
 const legacy=!active && !!(jar.get(APP_CONFIG.cookieNames.accessToken)?.value||jar.get(APP_CONFIG.cookieNames.refreshToken)?.value);
 return NextResponse.json({accounts:list,active,legacy,limit:MAX_ACCOUNTS},{headers});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Permintaan tidak diizinkan."},{status:403,headers});
 const body=await request.json().catch(()=>null);const jar=await cookies();const list=accounts(jar);
 if(!validSlot(body?.slot)||!list.some(a=>a.slot===body.slot))return NextResponse.json({error:"Akun tidak tersedia. Hubungkan kembali akun TikTok."},{status:404,headers});
 if(body.action==="switch"){activate(jar,body.slot);return NextResponse.json({success:true},{headers});}
 if(body.action==="remove"){
  removeSlot(jar,body.slot);
  const next=list.filter(a=>a.slot!==body.slot);
  if(currentSlot(jar)===body.slot){if(next.length)activate(jar,next[0].slot);else clearAccounts(jar);}
  return NextResponse.json({success:true,remaining:next.length},{headers});
 }
 return NextResponse.json({error:"Tindakan tidak valid."},{status:400,headers});
}
