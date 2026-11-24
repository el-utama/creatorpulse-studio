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
  await page.getByRole('button',{name:'Direct Post',exact:true}).click();
  await page.getByLabel('Tautan video HTTPS').fill('https://example.com/video.mp4');
  await expect(page.getByRole('button',{name:'Tinjau publikasi'})).toBeDisabled();
  await page.locator('#privacy').click();
  await expect(page.getByRole('option',{name:'Semua orang'})).toHaveCount(0);
  await page.getByRole('option',{name:'Hanya saya'}).click();
  await page.getByLabel('Pratinjau video').evaluate(video=>{Object.defineProperty(video,'duration',{value:10,configurable:true});video.dispatchEvent(new Event('loadedmetadata'));});
  await expect(page.getByRole('checkbox',{name:'Izinkan komentar'})).toBeDisabled();
  await page.getByRole('button',{name:'Tinjau publikasi'}).click();
  await page.locator('#publication-consent').click();
  await page.getByRole('button',{name:'Publikasikan ke TikTok'}).click();
  await expect(page.getByText('Terpublikasi',{exact:true})).toBeVisible();
});
