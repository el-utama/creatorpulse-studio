import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {clearAccounts,sameOrigin} from "@/lib/accounts";
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Permintaan tidak diizinkan."},{status:403});
 clearAccounts(await cookies());
 return NextResponse.json({success:true},{headers:{"Cache-Control":"no-store"}});
}
