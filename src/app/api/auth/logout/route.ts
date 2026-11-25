import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {clearAccounts,sameOrigin} from "@/lib/accounts";
import {clearOperatorSession} from "@/lib/gateway/operator-session";
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Permintaan tidak diizinkan."},{status:403});
 clearAccounts(await cookies());
 await clearOperatorSession();
 return NextResponse.json({success:true},{headers:{"Cache-Control":"no-store"}});
}
