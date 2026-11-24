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
  await expect(page.getByText('Test Creator').first()).toBeVisible();
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
  await expect(page.getByText('Test Creator').first()).toBeVisible();
  const summary = page.getByRole('tab',{name:'Ringkasan'});
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
 const rejected=await request.post('/api/tiktok/publish',{headers,multipart:{requestId:crypto.randomUUID(),mode:'inbox',videoUrl:'https://unverified.example/video.mp4',consent:'true'}});
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
