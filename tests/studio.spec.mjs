import { test, expect } from '@playwright/test';

test('landing and protected dashboard', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/$/);
});

test('mobile dashboard: review, publish once, status, reload history', async ({page,context}) => {
  await page.setViewportSize({width:390,height:844});
  await context.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
  await page.route('**/api/tiktok/analytics', route=>route.fulfill({json:{user_info:{open_id:'test-account',display_name:'Test Creator',avatar_url:'',follower_count:10,following_count:2,likes_count:20,video_count:0},videos:{data:[]}}}));
  let requests=0;
  await page.route('**/api/tiktok/publish', async route=>{requests++; await route.fulfill({json:{publish_id:'mock-publish-1'}});});
  await page.route('**/api/tiktok/publish/status', route=>route.fulfill({json:{status:'SEND_TO_USER_INBOX'}}));
  await page.goto('/dashboard');
  await expect(page.getByRole('heading',{name:'Halo, Test Creator',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Buat post',exact:true}).click();
  await page.getByLabel('Tautan video HTTPS').fill('http://example.com/video.mp4');
  await expect(page.getByRole('button',{name:'Tinjau publikasi'})).toBeDisabled();
  await page.getByLabel('Tautan video HTTPS').fill('https://example.com/video.mp4');
  await page.getByRole('button',{name:'Tinjau publikasi'}).click();
  await expect(page.getByRole('button',{name:'Kirim ke inbox TikTok'})).toBeDisabled();
  await page.locator('#publication-consent').click();
  await page.getByRole('button',{name:'Kirim ke inbox TikTok'}).click();
  await expect(page.getByText('Dikirim ke inbox TikTok',{exact:true})).toBeVisible();
  expect(requests).toBe(1);
  await page.reload();
  await page.getByRole('tab',{name:'Aktivitas'}).click();
  await page.getByRole('button',{name:/mock-publish-1/}).click();
  await expect(page.getByText('Dikirim ke inbox TikTok',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('direct post requires account capabilities and explicit privacy', async ({page,context}) => {
  await page.setViewportSize({width:1440,height:900});
  await context.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
  await page.route('**/api/tiktok/analytics', route=>route.fulfill({json:{user_info:{open_id:'direct-test',display_name:'Test Creator',avatar_url:'',follower_count:0,following_count:0,likes_count:0,video_count:0},videos:{data:[]}}}));
  await page.route('**/api/tiktok/creator',route=>route.fulfill({json:{creator_nickname:'Test Creator',creator_username:'test',privacy_level_options:['SELF_ONLY'],comment_disabled:true,duet_disabled:true,stitch_disabled:true,max_video_post_duration_sec:60}}));
  await page.route('**/api/tiktok/publish',route=>route.fulfill({json:{publish_id:'mock-direct'}}));
  await page.route('**/api/tiktok/publish/status',route=>route.fulfill({json:{status:'PUBLISH_COMPLETE'}}));
  await page.goto('/dashboard');
  await page.getByRole('tab',{name:'Buat post',exact:true}).click();
  await page.route('https://example.com/video.mp4',route=>route.abort());
  await page.getByRole('button',{name:'Direct Post',exact:true}).click();
  await page.getByLabel('Tautan video HTTPS').fill('https://example.com/video.mp4');
  await expect(page.getByRole('button',{name:'Tinjau publikasi'})).toBeDisabled();
  await page.locator('#privacy').click();
  await expect(page.getByRole('option',{name:'Semua orang'})).toHaveCount(0);
  await page.getByRole('option',{name:'Hanya saya'}).click();
  await expect.poll(()=>page.getByLabel('Pratinjau video').evaluate(video=>!!video.error)).toBe(true);
  await page.getByLabel('Pratinjau video').evaluate(video=>{Object.defineProperty(video,'duration',{value:10,configurable:true});video.dispatchEvent(new Event('loadedmetadata'));});
  await expect(page.getByRole('checkbox',{name:'Izinkan komentar'})).toBeDisabled();
  await page.getByRole('button',{name:'Tinjau publikasi'}).click();
  await page.locator('#publication-consent').click();
  await page.getByRole('button',{name:'Publikasikan ke TikTok'}).click();
  await expect(page.getByText('Terpublikasi',{exact:true})).toBeVisible();
});

test('server publication contracts and validation', async ({request}) => {
  const headers = {Cookie:'creatorpulse_access_token=mock-only'};
  const base = {accountId:'mock-stable-account',requestId:crypto.randomUUID(),mode:'inbox',videoUrl:'https://example.com/video.mp4',consent:'true'};
  const denied = await request.post('/api/tiktok/publish',{multipart:base});
  expect(denied.status()).toBe(401);
  const invalid = await request.post('/api/tiktok/publish',{headers,multipart:{...base,consent:'false'}});
  expect(invalid.status()).toBe(400);
  const wrongAccount = await request.post('/api/tiktok/publish',{headers,multipart:{...base,accountId:'wrong-account'}});
  expect(wrongAccount.status()).toBe(409);
  const inbox = await request.post('/api/tiktok/publish',{headers,multipart:base});
  expect(inbox.status()).toBe(200);
  const inboxId = (await inbox.json()).publish_id;
  expect(inboxId).toMatch(/^server-inbox-/);
  const replay = await request.post('/api/tiktok/publish',{headers,multipart:base});
  expect(replay.status()).toBe(200);
  expect((await replay.json()).publish_id).toBe(inboxId);
  const upload = await request.post('/api/tiktok/publish',{headers,multipart:{accountId:'mock-stable-account',requestId:crypto.randomUUID(),mode:'inbox',consent:'true',file:{name:'test.mp4',mimeType:'video/mp4',buffer:Buffer.from([1,2,3,4])}}});
  expect(upload.status()).toBe(200);
  const caps = await request.get('/api/tiktok/creator',{headers});
  expect((await caps.json()).privacy_level_options).toEqual(['SELF_ONLY']);
  const direct = {...base,requestId:crypto.randomUUID(),mode:'profile',caption:'test',privacy:'SELF_ONLY',duration:'10',disableComment:'true',disableDuet:'true',disableStitch:'true'};
  const rejected = await request.post('/api/tiktok/publish',{headers,multipart:{...direct,brandContent:'true'}});
  expect(rejected.status()).toBe(400);
  const posted = await request.post('/api/tiktok/publish',{headers,multipart:direct});
  expect(posted.status()).toBe(200);
  const directId = (await posted.json()).publish_id;
  expect(directId).toMatch(/^server-direct-/);
  const status = await request.post('/api/tiktok/publish/status',{headers,data:{publish_ids:[directId]}});
  expect((await status.json()).status).toBe('PUBLISH_COMPLETE');
});

test('keyboard navigation, narrow layout and logout', async ({page,context}) => {
  await context.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
  await page.route('**/api/tiktok/analytics', route=>route.fulfill({json:{user_info:{open_id:'layout-account',display_name:'Test Creator',avatar_url:'',follower_count:12345678,following_count:2,likes_count:20,video_count:0},videos:{data:[]}}}));
  await page.setViewportSize({width:320,height:700});
  await page.goto('/dashboard');
  await expect(page.getByRole('heading',{name:'Halo, Test Creator',exact:true})).toBeVisible();
  const summary = page.getByRole('tab',{name:'Ringkasan',exact:true});
  await summary.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'Konten'})).toHaveAttribute('aria-selected','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.setViewportSize({width:768,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
  await page.getByRole('button',{name:'Keluar',exact:true}).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/$/);
});

test('pagination, refresh and actionable errors',async ({request})=>{
 const headers={Cookie:'creatorpulse_access_token=mock-only'};
 const first=await request.get('/api/tiktok/analytics',{headers});
 expect(first.status()).toBe(200);
 const data=await first.json();
 expect(data.videos.has_more).toBe(true);
 const next=await request.get('/api/tiktok/analytics?cursor='+data.videos.cursor,{headers});
 expect((await next.json()).videos.data[0].id).toBe('v2');
 expect((await request.get('/api/tiktok/analytics?cursor=-1',{headers})).status()).toBe(400);
 const creator=await request.get('/api/tiktok/creator',{headers:{Cookie:'creatorpulse_access_token=expired; creatorpulse_refresh_token=refresh-test'}});
 expect(creator.status()).toBe(200);
 expect(creator.headers()['set-cookie']).toContain('renewed');
 const rejected=await request.post('/api/tiktok/publish',{headers,multipart:{accountId:'mock-stable-account',requestId:crypto.randomUUID(),mode:'inbox',videoUrl:'https://unverified.example/video.mp4',consent:'true'}});
 expect(rejected.status()).toBe(400);
 expect((await rejected.json()).error).toContain('url_ownership_unverified');
 const failure=await request.post('/api/tiktok/publish/status',{headers,data:{publish_ids:['failed-test']}});
 expect((await failure.json()).failure_reason).toContain('video_pull_failed');
});
test('content loads another page and searches loaded descriptions',async ({page,context})=>{
 await context.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
 const video=(id,title,description)=>({id,title,video_description:description,cover_image_url:'',create_time:1,share_url:'https://www.tiktok.com/',view_count:3,like_count:1,comment_count:0,share_count:0});
 await page.route('**/api/tiktok/analytics**',route=>route.fulfill({json:route.request().url().includes('cursor=123')?{videos:{data:[video('v2','Video lama','musik unik')],has_more:false}}:{user_info:{open_id:'pagination-account',display_name:'Test Creator',avatar_url:'',follower_count:0,following_count:0,likes_count:0,video_count:2},videos:{data:[video('v1','Video baru','test')],has_more:true,cursor:123}}}));
 await page.goto('/dashboard');
 await page.getByRole('tab',{name:'Konten'}).click();
 await expect(page.getByText('Video baru',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Muat video lainnya'}).click();
 await expect(page.getByText('Video lama',{exact:true})).toBeVisible();
 await page.getByLabel('Cari video').fill('musik unik');
 await expect(page.getByText('Video baru',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Video lama',{exact:true})).toBeVisible();
});

test('uncertain publication stays blocked after reload',async ({page,context})=>{
 await context.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
 await page.route('**/api/tiktok/analytics',route=>route.fulfill({json:{user_info:{open_id:'uncertain-account',display_name:'Test Creator',avatar_url:'',follower_count:0,following_count:0,likes_count:0,video_count:0},videos:{data:[]}}}));
 await page.route('**/api/tiktok/publish',route=>route.fulfill({status:502,json:{error:'Hasil belum pasti'}}));
 await page.goto('/dashboard');await page.getByRole('tab',{name:'Buat post'}).click();
 await page.getByLabel('Tautan video HTTPS').fill('https://example.com/video.mp4');
 await page.getByRole('button',{name:'Tinjau publikasi'}).click();
 await page.locator('#publication-consent').click();
 await page.getByRole('button',{name:'Kirim ke inbox TikTok'}).click();
 await expect(page.getByRole('button',{name:'Buka blokir publikasi'})).toBeDisabled();
 await page.reload();await page.getByRole('tab',{name:'Buat post'}).click();
 await expect(page.getByRole('button',{name:'Buka blokir publikasi'})).toBeDisabled();
 await page.getByLabel('Saya sudah memeriksa TikTok dan memastikan aman untuk memulai publikasi baru.').check();
 await page.getByRole('button',{name:'Buka blokir publikasi'}).click();
 await expect(page.getByRole('button',{name:'Buka blokir publikasi'})).toHaveCount(0);
});

test('studio design overview and library views',async ({page,context})=>{
 await context.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
 await page.route('**/api/tiktok/analytics',route=>route.fulfill({json:{user_info:{open_id:'design-account',display_name:'Test Creator',avatar_url:'',follower_count:1000,following_count:20,likes_count:500,video_count:1},videos:{data:[{id:'design-v',title:'Sample video',cover_image_url:'',create_time:1,share_url:'https://www.tiktok.com/',view_count:100,like_count:10,comment_count:2,share_count:1}]}}}));
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Performa konten'})).toBeVisible();await expect(page.getByRole('heading',{name:'Video teratas'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:'test-results/design-overview-'+width+'.png',fullPage:true});}
 await page.getByRole('tab',{name:'Konten',exact:true}).click();await page.getByRole('button',{name:'Tampilan grid'}).click();await expect(page.getByRole('button',{name:'Tampilan grid'})).toHaveAttribute('aria-pressed','true');await expect(page.getByText('Sample video',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Tampilan daftar'}).click();await expect(page.getByRole('button',{name:'Tampilan daftar'})).toHaveAttribute('aria-pressed','true');
});

test('multi-account OAuth, switch, isolation and removal',async ({page,context})=>{
 const connect=async(code,add=false)=>{
  const start=await context.request.get('/api/auth/tiktok'+(add?'?add=1':''),{maxRedirects:0});
  const url=new URL(start.headers().location);
  if(add)expect(url.searchParams.get('disable_auto_auth')).toBe('1');
  const callback=await context.request.get('/api/auth/tiktok/callback?code='+code+'&state='+encodeURIComponent(url.searchParams.get('state')),{maxRedirects:0});
  expect(callback.headers().location).toContain('/dashboard?account_changed=1');
 };
 await connect('account-a');
 await connect('account-b',true);
 const list=await (await context.request.get('/api/auth/accounts')).json();
 expect(list.accounts).toHaveLength(2);
 expect(JSON.stringify(list)).not.toContain('account-a-refresh');
 const a=list.accounts.find(x=>x.name==='Account A');const b=list.accounts.find(x=>x.name==='Account B');
 expect(list.active).toBe(b.slot);
 const profile=async()=> (await (await context.request.get('/api/tiktok/analytics')).json()).user_info.open_id;
 expect(await profile()).toBe('account-b');
 const switchA=await context.request.post('/api/auth/accounts',{data:{action:'switch',slot:a.slot}});
 expect(switchA.ok()).toBe(true);expect(await profile()).toBe('account-a');
 const mismatch=await context.request.post('/api/tiktok/publish',{multipart:{accountId:'account-b',requestId:crypto.randomUUID(),mode:'inbox',consent:'true',videoUrl:'https://example.com/video.mp4'}});
 expect(mismatch.status()).toBe(409);
 await page.goto('/dashboard');await page.getByRole('button',{name:'Account A',exact:true}).click();await expect(page.getByRole('button',{name:'Account B',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Account B',exact:true}).click();await expect(page.getByRole('heading',{name:'Halo, Account B'})).toBeVisible();
 const denied=await context.request.post('/api/auth/accounts',{headers:{Origin:'https://other.example'},data:{action:'remove',slot:b.slot}});expect(denied.status()).toBe(403);
 expect((await context.request.post('/api/auth/accounts',{data:{action:'remove',slot:b.slot}})).ok()).toBe(true);expect(await profile()).toBe('account-a');
 expect((await context.request.post('/api/auth/logout')).ok()).toBe(true);
 expect((await (await context.request.get('/api/auth/accounts')).json()).accounts).toHaveLength(0);
 await page.goto('/dashboard');await expect(page).toHaveURL(/\/$/);
});

test('legacy session migration preserves the original account and duplicate connections do not add slots',async ({context})=>{
 await context.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
 const connect=async(code)=>{
  const start=await context.request.get('/api/auth/tiktok?add=1',{maxRedirects:0});
  const state=new URL(start.headers().location).searchParams.get('state');
  const callback=await context.request.get('/api/auth/tiktok/callback?code='+code+'&state='+state,{maxRedirects:0});
  expect(callback.headers().location).toContain('/dashboard?account_changed=1');
 };
 await connect('account-a');await connect('account-a');
 const data=await (await context.request.get('/api/auth/accounts')).json();
 expect(data.accounts).toHaveLength(2);expect(data.legacy).toBe(false);
 expect(data.accounts.map(a=>a.name)).toContain('Mock Creator');
 await connect('account-b');
 expect((await (await context.request.get('/api/auth/accounts')).json()).accounts).toHaveLength(3);
 const list=await (await context.request.get('/api/auth/accounts')).json();
 const invalid=await context.request.post('/api/auth/accounts',{data:{action:'switch',slot:'a'.repeat(32)}});
 expect(invalid.status()).toBe(404);
 expect((await (await context.request.get('/api/auth/accounts')).json()).active).toBe(list.active);
});

test('unconfigured gateway is disabled without affecting browser authentication',async ({request})=>{
 const health=await request.get('/api/gateway/v1/health');expect(health.ok()).toBe(true);expect((await health.json()).configured).toBe(false);
 expect((await request.get('/api/gateway/v1/accounts')).status()).toBe(503);
 expect((await request.post('/api/gateway/v1/trends',{data:{topic:'test'}})).status()).toBe(503);
 expect((await request.post('/api/gateway/v1/enroll')).status()).toBe(503);
});

test('AI workspace: clear setup state, discoverable copy action, no overflow', async ({page,context})=>{
 await context.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
 await page.route('**/api/tiktok/analytics',route=>route.fulfill({json:{user_info:{open_id:'ux-account',display_name:'Nama Kreator Sangat Panjang untuk Uji Layout',avatar_url:'',follower_count:100,following_count:1,likes_count:200,video_count:0},videos:{data:[]}}}));
 await page.route('**/api/gateway/v1/health',route=>route.fulfill({json:{configured:false}}));
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:900});await page.goto('/dashboard');
  await expect(page.getByRole('heading',{name:'Performa konten'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Salin instruksi Hermes'})).toHaveCount(0);
  await page.getByRole('tab',{name:'AI Agent'}).click();
  await expect(page.getByRole('heading',{name:'Integrasi AI',exact:true})).toBeVisible();
  await expect(page.getByText('Belum disiapkan',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Salin instruksi Hermes'})).toBeVisible();
  await expect(page.getByLabel('Kunci operator',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Panduan Local Bridge'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:'test-results/ux-ai-setup-'+width+'.png',fullPage:true});
 }
 await page.getByText('Lihat teks instruksi',{exact:true}).click();
 await expect(page.getByLabel('Instruksi pemasangan Hermes')).toHaveValue(/branch main/);
});
test('AI workspace: health failure is actionable and operator key has one entry point',async ({page,context})=>{
 await context.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
 await page.route('**/api/tiktok/analytics',route=>route.fulfill({json:{user_info:{open_id:'ux-operator',display_name:'Test Creator',avatar_url:'',follower_count:1,following_count:1,likes_count:1,video_count:0},videos:{data:[]}}}));
 let fail=true;
 await page.route('**/api/gateway/v1/health',route=>route.fulfill(fail?{status:503,json:{error:'Unavailable'}}:{json:{configured:true}}));
 await page.route('**/api/gateway/v1/posts',route=>route.fulfill({json:{posts:[]}}));
 await page.route('**/api/gateway/v1/trends?*',route=>route.fulfill({json:{observations:[]}}));
 await page.route('**/api/gateway/v1/accounts',route=>route.fulfill({json:{accounts:[]}}));
 await page.setViewportSize({width:390,height:844});await page.goto('/dashboard');await page.getByRole('tab',{name:'AI Agent'}).click();
 await expect(page.getByText('Status belum dapat diperiksa',{exact:true})).toBeVisible();fail=false;
 await page.getByRole('button',{name:'Coba lagi',exact:true}).click();
 await expect(page.getByText('Konfigurasi tersedia',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Kunci operator',{exact:true})).toHaveCount(1);
 await page.getByLabel('Kunci operator',{exact:true}).fill('mock-operator');await page.getByRole('button',{name:'Muat data operator'}).click();
 await expect(page.getByRole('heading',{name:'Persetujuan publikasi'})).toBeVisible();
 await expect(page.getByLabel('Kunci operator',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Belum ada rencana publikasi.',{exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/ux-ai-operator-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'test-results/ux-ai-operator-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Kunci sesi'}).click();await expect(page.getByRole('heading',{name:'Operasional agent'})).toHaveCount(0);
 await expect(page.getByLabel('Kunci operator',{exact:true})).toHaveValue('');
});
