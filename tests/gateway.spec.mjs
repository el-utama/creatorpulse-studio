import {test,expect} from '@playwright/test';
const enabled=process.env.GATEWAY_TEST==='1';
test.skip(!enabled,'Requires isolated SQLite Local Bridge and mock TikTok');
const operator={Authorization:'Bearer '+ 'o'.repeat(40)};
const agent={Authorization:'Bearer '+ 'a'.repeat(40)};
test('gateway rejects mismatched environment header',async({request})=>{const health=await (await request.get('/api/gateway/v1/health')).json();expect(health.environment).toBe('local');expect((await request.get('/api/gateway/v1/accounts',{headers:{...agent,'X-CreatorPulse-Environment':'sandbox'}})).status()).toBe(403);});
test('enroll and monitor without browser, separate credentials and sourced trend data',async ({context,request})=>{
 const start=await context.request.get('/api/auth/tiktok',{maxRedirects:0});
 const state=new URL(start.headers().location).searchParams.get('state');
 const cb=await context.request.get('/api/auth/tiktok/callback?code=account-a&state='+state,{maxRedirects:0});
 expect(cb.headers().location).toContain('/dashboard');
 expect((await context.request.post('/api/gateway/v1/enroll',{headers:agent})).status()).toBe(403);
 const enrolled=await context.request.post('/api/gateway/v1/enroll',{headers:operator});
 expect(enrolled.status()).toBe(200);
 const id=(await enrolled.json()).id;
 expect((await request.get('/api/gateway/v1/accounts')).status()).toBe(401);
 const list=await request.get('/api/gateway/v1/accounts',{headers:agent});
 expect(list.status()).toBe(200);
 const data=await list.json();
 expect(data.accounts.some(a=>a.id===id)).toBe(true);
 expect(JSON.stringify(data)).not.toContain('account-a-refresh');
 const analytics=await request.get('/api/gateway/v1/accounts/'+id+'/analytics',{headers:agent});
 expect(analytics.status()).toBe(200);
 expect((await analytics.json()).user.open_id).toBe('account-a');
 const browser=await context.request.get('/api/tiktok/analytics');
 expect(browser.status()).toBe(200);
 expect((await browser.json()).user_info.open_id).toBe('account-a');
 const cookies=await context.cookies();
 expect(cookies.some(c=>c.name.endsWith('_v')&&c.httpOnly)).toBe(true);
 expect(cookies.some(c=>c.name.endsWith('_r')||c.name.endsWith('_a'))).toBe(false);
 const observation={topic:'Example trend',type:'hashtag',region:'ID',source:'tiktok_creative_center',sourceUrl:'https://ads.tiktok.com/business/creativecenter/',observedAt:new Date().toISOString(),evidence:'Mock evidence from test',changePct:10,metric:'Reported hashtag post growth'};
 expect((await request.post('/api/gateway/v1/trends',{headers:agent,data:{...observation,sourceUrl:'http://invalid.example'}})).status()).toBe(400);
 expect((await request.post('/api/gateway/v1/trends',{headers:agent,data:observation})).status()).toBe(201);
 const trends=await (await request.get('/api/gateway/v1/trends?region=ID&days=7',{headers:agent})).json();
 expect(trends.provenance).toBe('agent_submitted_unverified');expect(trends.observations.some(o=>o.topic===observation.topic)).toBe(true);
 expect((await request.post('/api/gateway/v1/accounts/'+id+'/disconnect',{headers:agent})).status()).toBe(403);
 expect((await request.post('/api/gateway/v1/publish',{headers:agent,data:{}})).status()).toBe(404);
 expect((await request.post('/api/gateway/v1/accounts/'+id+'/disconnect',{headers:operator})).status()).toBe(200);
 expect((await request.get('/api/gateway/v1/accounts/'+id+'/analytics',{headers:agent})).status()).toBe(404);
});

test('immutable inbox draft, operator approval and exactly one execution claim',async ({context,request})=>{
 const start=await context.request.get('/api/auth/tiktok',{maxRedirects:0});
 const state=new URL(start.headers().location).searchParams.get('state');
 await context.request.get('/api/auth/tiktok/callback?code=account-b&state='+state,{maxRedirects:0});
 const enrolled=await context.request.post('/api/gateway/v1/enroll',{headers:operator});
 expect(enrolled.ok()).toBe(true);const accountId=(await enrolled.json()).id;
 const base='/api/gateway/v1/posts',data={requestId:crypto.randomUUID(),accountId,videoUrl:'https://example.com/video.mp4',caption:'Mock caption',mode:'inbox'};
 const created=await request.post(base,{headers:agent,data});expect(created.status()).toBe(201);
 const draft=await created.json();const url=base+'/'+draft.id;
 expect(draft.state).toBe('draft');
 expect((await request.post(url+'/execute',{headers:agent})).status()).toBe(409);
 expect((await request.post(url+'/approve',{headers:agent,data:{...data,confirm:true}})).status()).toBe(403);
 expect((await request.post(url+'/approve',{headers:operator,data:{...data,caption:'changed',confirm:true}})).status()).toBe(400);
 expect((await request.post(base,{headers:agent,data:{...data,caption:'changed'}})).status()).toBe(409);
 expect((await request.post(url+'/approve',{headers:operator,data:{...data,confirm:true}})).ok()).toBe(true);
 const results=await Promise.all([request.post(url+'/execute',{headers:agent}),request.post(url+'/execute',{headers:agent})]);
 const accepted=await Promise.all(results.filter(r=>r.ok()).map(r=>r.json()));
 expect(accepted.length).toBeGreaterThan(0);expect(new Set(accepted.map(x=>x.publishId)).size).toBe(1);
 const again=await (await request.post(url+'/execute',{headers:agent})).json();expect(again.publishId).toBe(accepted[0].publishId);
 expect(again.state).toBe('submitted');
 expect((await request.post(url+'/cancel',{headers:operator})).status()).toBe(409);
 const status=await (await request.post(url+'/status',{headers:agent})).json();expect(status.status).toBe('PUBLISH_COMPLETE');
 expect(status.events.some(x=>x.action==='approved'&&x.actor==='operator')).toBe(true);
 expect((await request.post(base,{headers:agent,data:{...data,requestId:crypto.randomUUID(),mode:'profile'}})).status()).toBe(400);
});

test('stateless MCP uses agent authentication and has no approval tool',async ({request})=>{
 const rpc=(method,params={},headers=agent)=>request.post('/api/mcp',{headers:{...headers,Accept:'application/json, text/event-stream'},data:{jsonrpc:'2.0',id:1,method,params}});
 expect((await rpc('tools/list',{},{})).status()).toBe(401);
 const init=await (await rpc('initialize',{protocolVersion:'2025-11-25'})).json();expect(init.result.protocolVersion).toBe('2025-11-25');
 const tools=await (await rpc('tools/list')).json();expect(tools.result.tools.some(t=>t.name==='prepare_post')).toBe(true);expect(tools.result.tools.some(t=>t.name.includes('approve')&&t.name!=='execute_approved_post')).toBe(false);
 const accounts=await (await rpc('tools/call',{name:'list_accounts',arguments:{}})).json();expect(accounts.result.isError).toBe(false);
 const forbidden=await (await rpc('tools/call',{name:'approve_post',arguments:{}})).json();expect(forbidden.error.code).toBe(-32602);
 const bad=await (await rpc('tools/call',{name:'get_analytics',arguments:{accountId:'../accounts'}})).json();expect(bad.result.isError).toBe(true);
});

test('direct mode requires human settings, validates visibility and sends exact final payload',async ({request})=>{
 const accounts=await (await request.get('/api/gateway/v1/accounts',{headers:agent})).json();const accountId=accounts.accounts[0].id;
 const base='/api/gateway/v1/posts',data={requestId:crypto.randomUUID(),accountId,videoUrl:'https://example.com/direct.mp4',caption:'Draft',mode:'profile',duration:20};
 const created=await request.post(base,{headers:agent,data});expect(created.status()).toBe(201);const post=await created.json();const url=base+'/'+post.id;
 const direct={privacy:'SELF_ONLY',disableComment:true,disableDuet:true,disableStitch:true,brandOrganic:false,brandContent:false,isAigc:true,musicConsent:true,policyConsent:true};
 const approval={...data,confirm:true,approvedCaption:'Edited by human',direct};
 expect((await request.post(url+'/approve',{headers:agent,data:approval})).status()).toBe(403);
 expect((await request.post(url+'/execute',{headers:agent})).status()).toBe(409);
 for(const invalid of [{...approval,direct:undefined},{...approval,direct:{...direct,privacy:'PUBLIC_TO_EVERYONE'}},{...approval,direct:{...direct,disableComment:false}},{...approval,direct:{...direct,brandContent:true}},{...approval,direct:{...direct,musicConsent:false}},{...approval,duration:21}]) expect((await request.post(url+'/approve',{headers:operator,data:invalid})).status()).toBe(400);
 const approved=await request.post(url+'/approve',{headers:operator,data:approval});expect(approved.status()).toBe(200);expect((await approved.json()).approvedCaption).toBe('Edited by human');
 const sent=await (await request.post(url+'/execute',{headers:agent})).json();expect(sent.state).toBe('submitted');expect(sent.publishId).toMatch(/^server-direct-/);expect(sent.direct.privacy).toBe('SELF_ONLY');
 const repeated=await (await request.post(url+'/execute',{headers:agent})).json();expect(repeated.publishId).toBe(sent.publishId);
});

test('terminal archival frees active queue but never permits reusing an executed id',async ({request})=>{
 const accounts=await (await request.get('/api/gateway/v1/accounts',{headers:agent})).json();const accountId=accounts.accounts[0].id;
 const base='/api/gateway/v1/posts',data={requestId:crypto.randomUUID(),accountId,videoUrl:'https://example.com/archive.mp4',caption:'Archive',mode:'inbox'};
 const draft=await (await request.post(base,{headers:agent,data})).json();const url=base+'/'+draft.id;
 expect((await request.post(url+'/archive',{headers:operator})).status()).toBe(409);
 expect((await request.post(url+'/cancel',{headers:operator})).ok()).toBe(true);
 expect((await request.post(url+'/archive',{headers:agent})).status()).toBe(403);
 expect((await request.post(url+'/archive',{headers:operator})).ok()).toBe(true);
 const old=await (await request.get(url,{headers:agent})).json();expect(old.archived).toBe(true);expect(old.state).toBe('cancelled');
 const list=await (await request.get(base,{headers:agent})).json();expect(list.posts.some(p=>p.id===draft.id)).toBe(false);
 expect((await request.post(base,{headers:agent,data:{...data,caption:'different'}})).status()).toBe(409);
 expect((await request.post(url+'/execute',{headers:agent})).status()).toBe(409);
});

test('old browser binding cannot regain access after disconnect and reenroll',async ({browser,request})=>{
 const one=await browser.newContext(),two=await browser.newContext();
 try{
 const enroll=async ctx=>{const start=await ctx.request.get('/api/auth/tiktok',{maxRedirects:0});const state=new URL(start.headers().location).searchParams.get('state');await ctx.request.get('/api/auth/tiktok/callback?code=account-a&state='+state,{maxRedirects:0});const r=await ctx.request.post('/api/gateway/v1/enroll',{headers:operator});expect(r.ok()).toBe(true);return (await r.json()).id;};
 const id=await enroll(one);expect((await one.request.get('/api/tiktok/analytics')).status()).toBe(200);
 const base='/api/gateway/v1/posts',data={requestId:crypto.randomUUID(),accountId:id,videoUrl:'https://example.com/reconnect.mp4',caption:'Before disconnect',mode:'inbox'};
 const draft=await (await request.post(base,{headers:agent,data})).json();
 expect((await request.post(base+'/'+draft.id+'/approve',{headers:operator,data:{...data,confirm:true}})).ok()).toBe(true);
 expect((await request.post('/api/gateway/v1/accounts/'+id+'/disconnect',{headers:operator})).ok()).toBe(true);
 expect(await enroll(two)).toBe(id);expect((await two.request.get('/api/tiktok/analytics')).status()).toBe(200);
 expect((await one.request.get('/api/tiktok/analytics')).status()).toBe(401);
 expect((await request.post(base+'/'+draft.id+'/execute',{headers:agent})).status()).toBe(409);
 }finally{await one.close();await two.close();}
});
