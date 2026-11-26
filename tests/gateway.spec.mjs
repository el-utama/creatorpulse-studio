import {test,expect} from '@playwright/test';
const enabled=process.env.GATEWAY_TEST==='1';
test.skip(!enabled,'Requires isolated SQLite Local Bridge and mock TikTok');
const operator={Authorization:'Bearer '+ 'o'.repeat(40)};
const agent={Authorization:'Bearer '+ 'a'.repeat(40)};
test('gateway rejects mismatched environment header',async({request})=>{const health=await (await request.get('/api/gateway/v1/health')).json();expect(health.environment).toBe('local');expect((await request.get('/api/gateway/v1/accounts',{headers:{...agent,'X-CreatorPulse-Environment':'sandbox'}})).status()).toBe(403);});
test('enroll and monitor without browser, separate credentials and sourced trend data',async ({context,request,browser:browserInstance})=>{
 const start=await context.request.get('/api/auth/tiktok',{maxRedirects:0});
 const state=new URL(start.headers().location).searchParams.get('state');
 const cb=await context.request.get('/api/auth/tiktok/callback?code=account-a&state='+state,{maxRedirects:0});
 expect(cb.headers().location).toContain('/dashboard');
 expect((await context.request.post('/api/gateway/v1/enroll',{headers:agent})).status()).toBe(403);
 const marker={'X-CreatorPulse-Operator-Session':'1'};
 expect((await context.request.post('/api/gateway/v1/operator-session',{headers:{...marker,...operator}})).status()).toBe(200);
 const enrolled=await context.request.post('/api/gateway/v1/enroll',{headers:marker});
 expect(enrolled.status()).toBe(200);
 const initialEnrollment=await enrolled.json();const id=initialEnrollment.id;expect(initialEnrollment.alreadyEnrolled).toBe(false);
 const bindingName='creatorpulse_account_'+id+'_v';
 const originalBinding=(await context.cookies()).find(c=>c.name===bindingName)?.value;expect(originalBinding).toBeTruthy();
 const duplicate=await context.request.post('/api/gateway/v1/enroll',{headers:marker});expect(duplicate.ok()).toBe(true);expect((await duplicate.json()).alreadyEnrolled).toBe(true);
 expect((await context.cookies()).find(c=>c.name===bindingName)?.value).toBe(originalBinding);
 expect((await request.get('/api/gateway/v1/accounts')).status()).toBe(401);
 const list=await request.get('/api/gateway/v1/accounts',{headers:agent});
 expect(list.status()).toBe(200);
 const data=await list.json();
 expect(data.accounts.some(a=>a.id===id)).toBe(true);
 expect(JSON.stringify(data)).not.toContain('account-a-refresh');
 // A second independent browser must unlock its own session, not enroll again.
 const second=await browserInstance.newContext();
 try{
  const base='/api/gateway/v1/';
  expect((await (await second.request.get(base+'operator-session',{headers:marker})).json()).authenticated).toBe(false);
  expect((await second.request.get(base+'accounts',{headers:marker})).status()).toBe(401);
  const authStart=await second.request.get('/api/auth/tiktok',{maxRedirects:0});
  const authState=new URL(authStart.headers().location).searchParams.get('state');
  const authDone=await second.request.get('/api/auth/tiktok/callback?code=account-a&state='+authState,{maxRedirects:0});expect(authDone.headers().location).toContain('/dashboard');
  const secondPage=await second.newPage();await secondPage.goto('/dashboard?view=agent');
  await expect(secondPage.getByText('Unlock this browser to view shared enrollment',{exact:true})).toBeVisible();
  await expect(secondPage.getByLabel('Kunci operator',{exact:true})).toBeVisible();
  await secondPage.getByLabel('Kunci operator',{exact:true}).fill('o'.repeat(40));
  await secondPage.getByRole('button',{name:'Buka akses'}).click();
  await expect(secondPage.getByText('Bridge data loaded',{exact:true})).toBeVisible();
  await expect(secondPage.getByText('1 / 3 enrolled',{exact:true})).toBeVisible();
  await expect(secondPage.getByText('Already enrolled · shared across devices',{exact:true})).toBeVisible();
  await expect(secondPage.getByRole('button',{name:'Hubungkan akun',exact:true})).toHaveCount(0);
  await expect(secondPage.getByText('No Hermes MCP validation report in the last 24 hours.',{exact:true})).toBeVisible();
  const diagnostic=base+'hermes-validation';
  const validReport={schema:1,commit:'a'.repeat(40),accounts:1,adapter_readonly:'passed',hermes_cli_test_exit:0};
  const reporter={...agent,'X-CreatorPulse-Environment':'local'};
  expect((await request.get(diagnostic)).status()).toBe(401);
  expect((await request.get(diagnostic,{headers:agent})).status()).toBe(403);
  expect((await request.post(diagnostic,{data:validReport})).status()).toBe(401);
  expect((await request.post(diagnostic,{headers:operator,data:validReport})).status()).toBe(403);
  expect((await second.request.post(diagnostic,{headers:marker,data:validReport})).status()).toBe(401);
  expect((await request.post(diagnostic,{headers:agent,data:validReport})).status()).toBe(403);
  expect((await request.post(diagnostic,{headers:{...reporter,'X-CreatorPulse-Environment':'sandbox'},data:validReport})).status()).toBe(403);
  for(const data of [{...validReport,hermes_cli_test_exit:1},{...validReport,reportedAt:'forged'},{...validReport,commit:'bad'}])expect((await request.post(diagnostic,{headers:reporter,data})).status()).toBe(400);
  expect((await request.post(diagnostic,{headers:reporter,data:{...validReport,accounts:2}})).status()).toBe(409);
  expect((await (await context.request.get(diagnostic,{headers:marker})).json()).state).toBe('none');
  const accepted=await request.post(diagnostic,{headers:reporter,data:validReport});expect(accepted.status()).toBe(201);
  const receipt=await accepted.json();expect(receipt.state).toBe('reported');expect(receipt.report.source).toBe('controller_report');
  expect(Math.abs(Date.now()-Date.parse(receipt.report.reportedAt))).toBeLessThan(10000);
  expect((await (await context.request.get(diagnostic,{headers:marker})).json())).toEqual(receipt);
  expect((await (await second.request.get(diagnostic,{headers:marker})).json())).toEqual(receipt);
  const agentRead=await (await request.get(base+'accounts',{headers:agent})).json();expect(agentRead.hermesValidation).toBeUndefined();
  await secondPage.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(secondPage.getByText('Hermes MCP · Last validated:',{exact:false})).toBeVisible();
  await expect(secondPage.locator('time[datetime="'+receipt.report.reportedAt+'"]')).toBeVisible();
  const firstRecords=await (await context.request.get(base+'accounts',{headers:marker})).json();
  const secondRecords=await (await second.request.get(base+'accounts',{headers:marker})).json();
  expect(secondRecords.accounts.map(a=>a.id)).toEqual(firstRecords.accounts.map(a=>a.id));
  expect(secondRecords.accounts.some(a=>a.id===id)).toBe(true);
  expect(firstRecords.hermesValidation).toEqual(receipt);expect(secondRecords.hermesValidation).toEqual(receipt);
  // Separate browser directory and shared enrollment, including vault-only accounts.
  const directory=await browserInstance.newContext();
  try{
   await directory.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
   const page=await directory.newPage();await page.goto('/dashboard');
   await expect(page.getByText('Public posts',{exact:true}).first()).toBeVisible();
   await page.goto('/dashboard?view=accounts');
   await expect(page.getByRole('heading',{name:'Account directory'})).toBeVisible();
   await expect(page.getByText('This browser',{exact:true}).first()).toBeVisible();
   await expect(page.getByText('Unlock operator access to view shared agent enrollment.',{exact:false})).toBeVisible();
   expect((await directory.request.post(base+'operator-session',{headers:{...marker,...operator}})).status()).toBe(200);
   await page.reload();
   await expect(page.getByRole('heading',{name:'Other enrolled accounts'})).toBeVisible();
   await expect(page.getByText('Account A',{exact:true}).first()).toBeVisible();
   for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   }
  }finally{await directory.close();}
  // Even a stale client submitting enroll directly must not rotate the vault.
  const beforeDuplicate=await second.cookies();
  const stale=await second.request.post(base+'enroll',{headers:marker});expect(stale.ok()).toBe(true);expect((await stale.json()).alreadyEnrolled).toBe(true);
  const accountCookies=all=>all.filter(c=>c.name.startsWith('creatorpulse_account_'+id+'_')).map(c=>[c.name,c.value]).sort();
  expect(accountCookies(await second.cookies())).toEqual(accountCookies(beforeDuplicate));
  expect((await context.cookies()).find(c=>c.name===bindingName)?.value).toBe(originalBinding);
  expect((await (await second.request.get(base+'accounts',{headers:marker})).json()).accounts).toEqual(firstRecords.accounts);
  expect((await context.request.get('/api/tiktok/analytics')).status()).toBe(200);
  expect((await second.request.get('/api/tiktok/analytics')).status()).toBe(200);
  await secondPage.reload();
  await expect(secondPage.getByText('1 / 3 enrolled',{exact:true})).toBeVisible();
  await expect(secondPage.locator('time[datetime="'+receipt.report.reportedAt+'"]')).toBeVisible();
  await expect(secondPage.getByText('Already enrolled · shared across devices',{exact:true})).toBeVisible();
  await expect(secondPage.getByRole('button',{name:'Hubungkan akun',exact:true})).toHaveCount(0);
  // Real shared SQLite history for the same enrolled account; mock TikTok only.
  const sent=await context.request.post('/api/tiktok/publish',{multipart:{accountId:'account-a',requestId:crypto.randomUUID(),mode:'inbox',videoUrl:'https://example.com/shared-history.mp4',consent:'true'}});
  expect(sent.status()).toBe(200);const publicationId=(await sent.json()).publish_id;
  const historyUrl='/api/tiktok/history?account='+id;
  const firstHistory=await (await context.request.get(historyUrl,{headers:marker})).json();
  expect(firstHistory.access).toBe('operator');expect(firstHistory.records.some(r=>r.id===publicationId)).toBe(true);
  expect((await (await second.request.get(historyUrl,{headers:marker})).json()).records).toEqual(firstHistory.records);
  expect((await request.get(historyUrl,{headers:marker})).status()).toBe(401);
  expect((await request.get(historyUrl,{headers:{...marker,...agent}})).status()).toBe(403);
  expect((await request.get(historyUrl,{headers:{...marker,...operator}})).status()).toBe(403);
  expect((await second.request.get('/api/tiktok/history?account='+'f'.repeat(32),{headers:marker})).status()).toBe(403);
  expect((await second.request.get(historyUrl,{headers:{...marker,Origin:'https://other.invalid'}})).status()).toBe(403);
  // Reproduce the failure: browser retains the account metadata but cannot read analytics.
  const accessName='creatorpulse_account_'+id+'_a',refreshName='creatorpulse_account_'+id+'_r';
  const browserAccess=(await second.cookies()).find(c=>c.name===accessName);
  expect(browserAccess).toBeTruthy();
  await second.addCookies([{...browserAccess,value:'expired'}]);await second.clearCookies({name:refreshName});
  expect((await second.request.get('/api/tiktok/analytics?account='+id)).status()).toBe(401);
  expect((await second.request.get(historyUrl)).status()).toBe(401);
  const fallback=await second.request.get(historyUrl,{headers:marker});expect(fallback.status()).toBe(200);
  expect((await fallback.json()).records).toEqual(firstHistory.records);
  await secondPage.goto('/dashboard?view=status');
  await expect(secondPage.getByRole('button',{name:'Details '+publicationId})).toBeVisible();
  await secondPage.getByRole('button',{name:'Details '+publicationId}).click();
  await expect(secondPage.getByText('Live status check requires a readable TikTok browser session. The stored record is available.',{exact:true})).toBeVisible();
  await secondPage.getByRole('button',{name:'Refresh history'}).click();
  await expect(secondPage.getByRole('button',{name:'Details '+publicationId})).toBeVisible();
  expect((await second.request.post(base+'operator-session/lock',{headers:marker})).status()).toBe(200);
  expect((await second.request.get(historyUrl,{headers:marker})).status()).toBe(401);
  await secondPage.reload();
  await expect(secondPage.getByText('Publication history not fully verified. Refresh or check the browser account session.',{exact:true})).toBeVisible();
  await expect(secondPage.getByRole('button',{name:'Details '+publicationId})).toHaveCount(0);
  expect((await (await context.request.get(base+'operator-session',{headers:marker})).json()).authenticated).toBe(true);
 }finally{await second.close();}

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
 const firstTrend=await request.post('/api/gateway/v1/trends',{headers:agent,data:observation});
 expect(firstTrend.status()).toBe(201);
 const saved=await firstTrend.json();expect(saved.duplicate).toBe(false);
 const repeated=await request.post('/api/gateway/v1/trends',{headers:agent,data:{...observation,topic:'  EXAMPLE   trend ',sourceUrl:observation.sourceUrl+'#anchor',evidence:'New wording, same source and day'}});
 expect(repeated.status()).toBe(200);
 const repeatedTrend=await repeated.json();expect(repeatedTrend.duplicate).toBe(true);expect(repeatedTrend.observation.id).toBe(saved.observation.id);expect(repeatedTrend.observation.evidence).toBe(observation.evidence);
 const concurrent={...observation,topic:'Concurrent trend fixture'};
 const results=await Promise.all([1,2].map(()=>request.post('/api/gateway/v1/trends',{headers:agent,data:concurrent})));
 expect(results.filter(r=>r.status()===201)).toHaveLength(1);
 expect(results.every(r=>[200,201,409].includes(r.status()))).toBe(true);
 const retry=await request.post('/api/gateway/v1/trends',{headers:agent,data:concurrent});
 expect(retry.status()).toBe(200);expect((await retry.json()).duplicate).toBe(true);
 const nextSource=await request.post('/api/gateway/v1/trends',{headers:agent,data:{...observation,sourceUrl:observation.sourceUrl+'?dataset=other'}});
 expect(nextSource.status()).toBe(201);
 const previousDay=await request.post('/api/gateway/v1/trends',{headers:agent,data:{...observation,observedAt:new Date(Date.parse(observation.observedAt)-86400000).toISOString()}});
 expect(previousDay.status()).toBe(201);
 const trends=await (await request.get('/api/gateway/v1/trends?region=ID&days=7',{headers:agent})).json();
 expect(trends.provenance).toBe('agent_submitted_unverified');
 expect(trends.observations.filter(o=>o.id===saved.observation.id)).toHaveLength(1);
 expect(trends.observations.filter(o=>o.topic===concurrent.topic)).toHaveLength(1);
 expect(trends.observations.filter(o=>o.topic===observation.topic)).toHaveLength(3);
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
 const status=await (await request.post(url+'/status',{headers:agent})).json();expect(status.status).toBe('PUBLISH_COMPLETE');expect(status.statusSource).toBe('tiktok');
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

test('local MP4 agent upload binds review to exact bytes and prevents repeat submission',async ({request})=>{
 const {createHash}=await import('node:crypto');
 const accounts=await (await request.get('/api/gateway/v1/accounts',{headers:agent})).json();
 const accountId=accounts.accounts[0].id;
 const bytes=Buffer.from('0000ftypisomfixture');
 const media={name:'test_upload.mp4',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 const base='/api/gateway/v1/posts';
 const data={requestId:crypto.randomUUID(),accountId,localMedia:media,caption:'Local video',mode:'inbox'};
 const url=base+'/'+data.requestId;
 const binary={...agent,'Content-Type':'video/mp4'};
 expect((await request.post(base,{headers:agent,data:{...data,videoUrl:'https://example.com/video.mp4'}})).status()).toBe(400);
 expect((await request.post(base,{headers:agent,data:{...data,localMedia:{...media,size:4194305}}})).status()).toBe(400);
 const draft=await request.post(base,{headers:agent,data});expect(draft.status()).toBe(201);
 expect((await draft.json()).localMedia).toEqual(media);
 expect((await request.post(base,{headers:agent,data:{...data,localMedia:{...media,name:'other.mp4'}}})).status()).toBe(409);
 expect((await request.post(url+'/execute-file',{headers:binary,data:bytes})).status()).toBe(409);
 const approval={...data,videoUrl:'',confirm:true,mediaSha256:media.sha256};
 expect((await request.post(url+'/approve',{headers:agent,data:approval})).status()).toBe(403);
 expect((await request.post(url+'/approve',{headers:operator,data:{...approval,mediaSha256:'0'.repeat(64)}})).status()).toBe(400);
 expect((await request.post(url+'/approve',{headers:operator,data:approval})).status()).toBe(200);
 expect((await request.post(url+'/execute',{headers:agent})).status()).toBe(400);
 const modified=Buffer.from(bytes);modified[modified.length-1]^=1;
 expect((await request.post(url+'/execute-file',{headers:binary,data:modified})).status()).toBe(400);
 const sent=await request.post(url+'/execute-file',{headers:binary,data:bytes});expect(sent.status()).toBe(200);
 const accepted=await sent.json();expect(accepted.state).toBe('submitted');expect(accepted.publishId).toMatch(/^server-inbox-/);
 expect(accepted.events.filter(e=>e.action==='upload_initialized')).toHaveLength(1);
 const again=await (await request.post(url+'/execute-file',{headers:binary,data:bytes})).json();
 expect(again.publishId).toBe(accepted.publishId);
 expect(again.events.filter(e=>e.action==='execution_claimed')).toHaveLength(1);
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

test('operator session persists across reload, is browser-scoped and does not grant agent privileges',async({browser,request})=>{
 const one=await browser.newContext(),two=await browser.newContext();
 const base='/api/gateway/v1/',marker={'X-CreatorPulse-Operator-Session':'1'};
 try{
 const status=async ctx=>(await (await ctx.request.get(base+'operator-session',{headers:marker})).json()).authenticated;
 expect(await status(one)).toBe(false);
 expect((await one.request.post(base+'operator-session',{headers:{...marker,...agent}})).status()).toBe(403);
 expect((await one.request.post(base+'operator-session',{headers:{...marker,Authorization:'Bearer wrong'}})).status()).toBe(403);
 expect((await one.request.post(base+'operator-session',{headers:{...marker,...operator,Origin:'https://other.invalid'}})).status()).toBe(403);
 expect((await one.request.post(base+'operator-session',{headers:{...marker,...operator}})).status()).toBe(200);
 expect(await status(one)).toBe(true);expect(await status(two)).toBe(false);
 const cookie=(await one.cookies()).find(c=>c.name==='creatorpulse_operator_session');
 expect(cookie.httpOnly).toBe(true);expect(cookie.sameSite).toBe('Strict');expect(cookie.value).not.toContain('o'.repeat(40));
 expect((await one.request.get(base+'accounts')).status()).toBe(401);
 expect((await one.request.get(base+'accounts',{headers:marker})).status()).toBe(200);
 expect((await one.request.get(base+'accounts',{headers:{...marker,Origin:'https://other.invalid'}})).status()).toBe(403);
 expect((await one.request.post(base+'accounts/'+'f'.repeat(32)+'/disconnect',{headers:{...marker,...agent}})).status()).toBe(403);
 expect((await request.get(base+'accounts',{headers:agent})).status()).toBe(200);
 await one.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
 const page=await one.newPage();await page.goto('/dashboard?view=agent');
 await expect(page.getByRole('heading',{name:'Agent activity'})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Agent activity'})).toBeVisible();
 await expect(page.getByLabel('Kunci operator',{exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.cookie.includes('creatorpulse_operator_session'))).toBe(false);
 expect(await page.evaluate(()=>JSON.stringify(localStorage).includes('o'.repeat(40)))).toBe(false);
 expect((await one.request.post(base+'operator-session/lock',{headers:marker})).status()).toBe(200);
 expect(await status(one)).toBe(false);
 expect((await one.request.get(base+'accounts',{headers:marker})).status()).toBe(401);
 expect((await one.request.post(base+'operator-session',{headers:{...marker,...operator}})).status()).toBe(200);
 expect((await one.request.post('/api/auth/logout')).status()).toBe(200);
 expect(await status(one)).toBe(false);
 }finally{await one.close();await two.close();}
});

test('manual history persists across authenticated browser contexts and migration never publishes',async({browser,request})=>{
 const one=await browser.newContext(),two=await browser.newContext(),other=await browser.newContext();
 try{
 for(const c of [one,two])await c.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
 await other.addCookies([{name:'creatorpulse_access_token',value:'account-a',url:'http://localhost:3000'}]);
 const url='/api/tiktok/history';
 expect((await request.get(url)).status()).toBe(401);
 const base={accountId:'mock-stable-account',requestId:crypto.randomUUID(),mode:'inbox',videoUrl:'https://example.com/manual.mp4',consent:'true'};
 const sent=await one.request.post('/api/tiktok/publish',{multipart:base});expect(sent.status()).toBe(200);const id=(await sent.json()).publish_id;
 const retry=await two.request.post('/api/tiktok/publish',{multipart:base});expect((await retry.json()).publish_id).toBe(id);
 let rows=(await (await two.request.get(url)).json()).records;expect(rows.filter(r=>r.id===id)).toHaveLength(1);
 expect((await (await other.request.get(url)).json()).records.some(r=>r.id===id)).toBe(false);
 expect((await two.request.post('/api/tiktok/publish/status',{data:{publish_ids:[id]}})).ok()).toBe(true);
 rows=(await (await one.request.get(url)).json()).records;expect(rows.find(r=>r.id===id).status).toBe('PUBLISH_COMPLETE');
 const old={id:'legacy-history-test',createdAt:'2025-01-01T00:00:00.000Z',mode:'inbox'};
 const oldPage=await one.newPage();await oldPage.addInitScript(record=>localStorage.setItem('creatorpulse:publications:mock-stable-account',JSON.stringify([record])),old);
 await oldPage.goto('/dashboard?view=status');
 await expect.poll(async()=>{const r=await two.request.get(url);return (await r.json()).records.some(x=>x.id===old.id)}).toBe(true);
 expect(await oldPage.evaluate(()=>JSON.parse(localStorage.getItem('creatorpulse:publications:mock-stable-account')).length)).toBe(1);
 expect((await other.request.post(url,{data:old})).ok()).toBe(false);
 for(let i=0;i<2;i++)expect((await one.request.post(url,{data:old})).ok()).toBe(true);
 rows=(await (await two.request.get(url)).json()).records;expect(rows.filter(r=>r.id===old.id)).toHaveLength(1);expect(rows.find(r=>r.id===old.id).imported).toBe(1);
 expect((await two.request.post(url,{headers:{Origin:'https://other.invalid'},data:old})).status()).toBe(403);
 expect((await request.post(url,{data:old})).status()).toBe(401);
 const page=await two.newPage();await page.goto('/dashboard?view=status');await expect(page.getByRole('button',{name:'Details '+id})).toBeVisible();await expect(page.getByRole('button',{name:'Details '+old.id})).toBeVisible();
 }finally{await one.close();await two.close();await other.close();}
});

test('definitive init rejection cannot execute again and status is stored only',async ({request})=>{
 const accounts=await (await request.get('/api/gateway/v1/accounts',{headers:agent})).json();
 const base='/api/gateway/v1/posts',data={requestId:crypto.randomUUID(),accountId:accounts.accounts[0].id,videoUrl:'https://example.com/unverified.mp4',caption:'Rejected fixture',mode:'inbox'};
 const created=await request.post(base,{headers:agent,data});expect(created.status()).toBe(201);
 const url=base+'/'+data.requestId;
 const before=await (await request.post(url+'/status',{headers:agent})).json();expect(before.statusSource).toBe('stored');
 expect((await request.post(url+'/approve',{headers:operator,data:{...data,confirm:true}})).status()).toBe(200);
 const executed=await request.post(url+'/execute',{headers:agent});expect(executed.status()).toBe(200);
 const rejected=await executed.json();expect(rejected.state).toBe('rejected');expect(rejected.publishId).toBeUndefined();expect(rejected.events.at(-1).action).toBe('execution_rejected');
 expect((await request.post(url+'/execute',{headers:agent})).status()).toBe(409);
 const status=await (await request.post(url+'/status',{headers:agent})).json();expect(status.statusSource).toBe('stored');expect(status.state).toBe('rejected');expect(status.events).toEqual(rejected.events);
 expect((await request.post(url+'/archive',{headers:operator})).status()).toBe(200);
});
