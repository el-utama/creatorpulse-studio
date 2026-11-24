import { createHash } from "node:crypto";
import { APP_CONFIG } from "@/config/app";

type Reply = { publish_id: string; success?: boolean; warning?: string; message?: string };
type RecordValue = { state: "pending" } | { state: "complete"; body: Reply; status: number };
type LocalEntry = { expires: number; value: RecordValue };
const local = new Map<string,LocalEntry>();
const ttl = 86400;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command: (string | number)[]) {
  if (!redisUrl || !redisToken) throw new Error("Idempotency storage configuration incomplete");
  const res = await fetch(redisUrl, {method:"POST",headers:{Authorization:`Bearer ${redisToken}`,"Content-Type":"application/json"},body:JSON.stringify(command),cache:"no-store"});
  const data = await res.json();
  if (!res.ok || data.error) throw new Error("Idempotency storage unavailable");
  return data.result;
}
export async function publicationKey(token: string, requestId: string) {
  const res = await fetch(APP_CONFIG.tiktokUserInfoUrl+"?fields=open_id",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  const data = await res.json();
  const id = data.data?.user?.open_id;
  if (!res.ok || data.error?.code !== "ok" || typeof id !== "string" || !id) throw new Error("Cannot confirm account");
  return "creatorpulse:publish:v1:"+createHash("sha256").update(JSON.stringify([id,requestId])).digest("hex");
}
export async function reservePublication(key: string): Promise<RecordValue | null> {
  const pending: RecordValue = {state:"pending"};
  if (redisUrl || redisToken) {
    const acquired = await redis(["SET",key,JSON.stringify(pending),"EX",ttl,"NX"]);
    if (acquired === "OK") return null;
    const previous = await redis(["GET",key]);
    // Never issue a second upstream request if the existing record cannot be read.
    return typeof previous === "string" ? JSON.parse(previous) as RecordValue : pending;
  }
  const now = Date.now();
  for (const [k,v] of local) if (v.expires <= now) local.delete(k);
  const previous = local.get(key);
  if (previous) return previous.value;
  if (local.size >= 1000) throw new Error("Publication queue temporarily full");
  local.set(key,{expires:now+ttl*1000,value:pending});
  return null;
}
export async function finishPublication(key: string, body: Reply, status = 200) {
  const value: RecordValue = {state:"complete",body,status};
  if (redisUrl || redisToken) {
    await redis(["SET",key,JSON.stringify(value),"EX",ttl]);
  } else {
    local.set(key,{expires:Date.now()+ttl*1000,value});
  }
}
