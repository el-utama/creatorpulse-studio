import {NextResponse} from "next/server";
import {authorize,GatewayError} from "@/lib/gateway/store";
import {GET as gatewayGet,POST as gatewayPost} from "@/app/api/gateway/v1/[...path]/route";
const slot={type:"string",pattern:"^[a-f0-9]{32}$"},id={type:"string",format:"uuid"},region={type:"string",pattern:"^[A-Z]{2}$"},days={type:"integer",minimum:1,maximum:90};
const object=(properties:Record<string,unknown>,required:string[]=[])=>({type:"object",properties,required,additionalProperties:false});
const definitions=[
 {name:"list_accounts",description:"List authorized TikTok accounts; never returns tokens.",inputSchema:object({})},
 {name:"get_analytics",description:"Current profile and account statistics.",inputSchema:object({accountId:slot},["accountId"])},
 {name:"list_videos",description:"List account videos with cursor pagination.",inputSchema:object({accountId:slot,cursor:{type:"integer",minimum:0}},["accountId"])},
 {name:"get_capabilities",description:"Read TikTok account publication capabilities.",inputSchema:object({accountId:slot},["accountId"])},
 {name:"list_trends",description:"Read stored agent-submitted observations; not a verified live ranking.",inputSchema:object({region,days})},
 {name:"record_trend",description:"Record a sourced observation from research. Never invent metrics; identify evidence and observation time.",inputSchema:object({topic:{type:"string"},type:{enum:["topic","hashtag","music","video","keyword"]},region,source:{enum:["tiktok_creative_center","tiktok_discovery_api","google_trends","web_research","manual"]},sourceUrl:{type:"string",format:"uri"},observedAt:{type:"string",format:"date-time"},evidence:{type:"string"},changePct:{type:"number"},metric:{type:"string"}},["topic","type","region","source","sourceUrl","observedAt","evidence"])},
 {name:"prepare_post",description:"Create an immutable inbox draft. Requires a unique requestId. Caption is a suggestion; human completes posting in TikTok.",inputSchema:object({requestId:id,accountId:slot,videoUrl:{type:"string",format:"uri"},caption:{type:"string"},mode:{const:"inbox"}},["requestId","accountId","videoUrl","caption","mode"])},
 {name:"list_posts",description:"Inspect queue and approval state.",inputSchema:object({})},
 {name:"get_post",description:"Read exact draft and publication status.",inputSchema:object({postId:id},["postId"])},
 {name:"execute_approved_post",description:"Send approved draft to TikTok inbox once; cannot approve. Never retry uncertain outcomes.",inputSchema:object({postId:id},["postId"])},
 {name:"get_publish_status",description:"Check status of submitted inbox post.",inputSchema:object({postId:id},["postId"])}
];
const headers={"Cache-Control":"no-store"};
const result=(id:unknown,value:unknown)=>NextResponse.json({jsonrpc:"2.0",id,result:value},{headers});
const error=(id:unknown,code:number,message:string,status=200)=>NextResponse.json({jsonrpc:"2.0",id,error:{code,message}},{status,headers});
function segment(value:unknown,pattern:RegExp){if(typeof value!=="string"||!pattern.test(value))throw new GatewayError(400,"Invalid identifier.");return value;}
async function callTool(req:Request,name:string,a:Record<string,unknown>){
 let path:string[],method="GET",query="",body:unknown;
 const account=()=>segment(a.accountId,/^[a-f0-9]{32}$/);
 const post=()=>segment(a.postId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
 switch(name){
 case "list_accounts":path=["accounts"];break;
 case "get_analytics":path=["accounts",account(),"analytics"];break;
 case "get_capabilities":path=["accounts",account(),"capabilities"];break;
 case "list_videos":path=["accounts",account(),"videos"];query="?cursor="+encodeURIComponent(String(a.cursor??0));break;
 case "list_trends":path=["trends"];query="?region="+encodeURIComponent(String(a.region??"ID"))+"&days="+encodeURIComponent(String(a.days??7));break;
 case "record_trend":path=["trends"];method="POST";body=a;break;
 case "prepare_post":path=["posts"];method="POST";body=a;break;
 case "list_posts":path=["posts"];break;
 case "get_post":path=["posts",post()];break;
 case "execute_approved_post":path=["posts",post(),"execute"];method="POST";break;
 case "get_publish_status":path=["posts",post(),"status"];method="POST";break;
 default:throw new GatewayError(400,"Unknown tool.");
 }
 const url=new URL("/api/gateway/v1/"+path.join("/")+query,req.url);
 const request=new Request(url,{method,headers:{Authorization:req.headers.get("authorization")||"","Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const ctx={params:Promise.resolve({path})};
 const reply=await (method==="GET"?gatewayGet(request,ctx):gatewayPost(request,ctx));
 const data=await reply.json();
 return {content:[{type:"text",text:JSON.stringify(data)}],isError:!reply.ok};
}
export async function POST(request:Request){
 try{authorize(request);}catch(e){return error(null,-32000,e instanceof GatewayError?e.message:"Unauthorized",e instanceof GatewayError?e.status:401);}
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(process.env.APP_URL||request.url).origin)return error(null,-32000,"Origin not allowed",403);
 const contentType=request.headers.get("content-type")||"";
 if(!contentType.includes("application/json"))return error(null,-32600,"Expected application/json",415);
 const raw=await request.text();if(raw.length>65536)return error(null,-32600,"Request too large",413);
 let p;try{p=JSON.parse(raw);}catch{return error(null,-32700,"Parse error",400);}
 if(!p||Array.isArray(p)||p.jsonrpc!=="2.0"||typeof p.method!=="string")return error(null,-32600,"Invalid request",400);
 if(p.id===undefined)return new Response(null,{status:202,headers});
 if(typeof p.id!=="string"&&typeof p.id!=="number")return error(null,-32600,"Invalid id",400);
 const version=request.headers.get("mcp-protocol-version");
 if(version&&!["2025-03-26","2025-06-18","2025-11-25"].includes(version))return error(p.id,-32600,"Unsupported protocol version",400);
 if(p.method==="initialize")return result(p.id,{protocolVersion:["2025-03-26","2025-06-18","2025-11-25"].includes(p.params?.protocolVersion)?p.params.protocolVersion:"2025-11-25",capabilities:{tools:{}},serverInfo:{name:"creatorpulse-studio",version:"3.2.0"}});
 if(p.method==="ping")return result(p.id,{});
 if(p.method==="tools/list")return result(p.id,{tools:definitions});
 if(p.method==="tools/call"){
  const name=p.params?.name,a=p.params?.arguments??{};
  if(!definitions.some(d=>d.name===name)||!a||typeof a!=="object"||Array.isArray(a))return error(p.id,-32602,"Invalid tool or arguments");
  try{return result(p.id,await callTool(request,name,a));}catch(e){return result(p.id,{content:[{type:"text",text:e instanceof GatewayError?e.message:"Tool failed."}],isError:true});}
 }
 return error(p.id,-32601,"Method not found");
}
export async function GET(){return new Response(null,{status:405,headers:{...headers,Allow:"POST"}});}
export async function DELETE(){return new Response(null,{status:405,headers:{...headers,Allow:"POST"}});}
