export async function installWorkspaceFixture(page,context){
 await context.addCookies([{name:'creatorpulse_access_token',value:'mock-only',url:'http://localhost:3000'}]);
 const accounts=[{slot:'a'.repeat(32),name:'Studio Alpha'},{slot:'b'.repeat(32),name:'Studio Beta'},{slot:'c'.repeat(32),name:'Soundframe'}];
 const post=(i,state,status)=>({id:'sample-'+i,accountId:accounts[i%3].slot,accountName:accounts[i%3].name,caption:['Morning studio routine','Behind the scenes','New track teaser','Production update'][i],videoUrl:'https://example.com/video.mp4',mode:i===1?'profile':'inbox',state,status,updatedAt:'2026-11-25T00:00:00Z',events:[]});
 const posts=[post(0,'draft'),post(1,'draft'),post(2,'approved'),post(3,'submitted','SEND_TO_USER_INBOX')];posts[2].approvedUntil=Date.now()+600000;
 await page.route('**/api/auth/accounts',route=>route.fulfill({json:{accounts,active:accounts[0].slot,legacy:false,limit:3}}));
 await page.route('**/api/tiktok/analytics**',route=>{const i=accounts.findIndex(a=>a.slot===new URL(route.request().url()).searchParams.get('account'));if(i<0)return route.fulfill({status:401,json:{error:'Unknown account'}});return route.fulfill({json:{user_info:{open_id:'id-'+i,display_name:accounts[i].name,avatar_url:'',follower_count:[12500,8200,4100][i],likes_count:100,video_count:[42,28,16][i]},videos:{data:[{id:'video-'+i,title:['Morning studio routine','Behind the scenes','New track teaser'][i],cover_image_url:'',create_time:1795564800,share_url:'https://www.tiktok.com/',view_count:[92000,65000,29400][i],like_count:10,comment_count:1,share_count:0}]}}})});
 let operatorSession=false;
 await page.route('**/api/gateway/v1/operator-session',route=>{if(route.request().method()==='POST')operatorSession=true;return route.fulfill({json:{authenticated:operatorSession}})});
 await page.route('**/api/gateway/v1/operator-session/lock',route=>{operatorSession=false;return route.fulfill({json:{authenticated:false}})});
 await page.route('**/api/gateway/v1/health',route=>route.fulfill({json:{configured:true}}));
 await page.route('**/api/gateway/v1/posts',route=>route.fulfill({json:{posts}}));
 await page.route('**/api/gateway/v1/accounts',route=>route.fulfill({json:{accounts:accounts.slice(0,2).map(a=>({id:a.slot,name:a.name}))}}));
 // This is an isolated UI fixture: review must not fall through to an actual gateway session.
 await page.route('**/api/gateway/v1/accounts/*/capabilities',route=>{
  const account=accounts.find(a=>route.request().url().includes('/'+a.slot+'/'));
  if(!operatorSession)return route.fulfill({status:401,json:{code:'operator_session_expired',error:'Fixture operator locked'}});
  if(!account)return route.fulfill({status:404,json:{error:'Fixture account missing'}});
  return route.fulfill({json:{creator_nickname:account.name,creator_username:'fixture_creator',privacy_level_options:['SELF_ONLY'],comment_disabled:false,duet_disabled:false,stitch_disabled:false,max_video_post_duration_sec:60}});
 });
 await page.route('https://example.com/video.mp4',route=>route.fulfill({status:404,body:'Fixture preview unavailable'}));
 await page.route('**/api/gateway/v1/accounts/*/analytics',route=>{const i=accounts.findIndex(a=>route.request().url().includes('/'+a.slot+'/'));return route.fulfill({json:{user:{open_id:'id-'+i,display_name:accounts[i].name,avatar_url:'',follower_count:[12500,8200,4100][i],likes_count:100,video_count:[42,28,16][i]}}})});
 await page.route('**/api/gateway/v1/accounts/*/videos**',route=>{const i=accounts.findIndex(a=>route.request().url().includes('/'+a.slot+'/'));return route.fulfill({json:{videos:[{id:'video-'+i,title:['Morning studio routine','Behind the scenes','New track teaser'][i],cover_image_url:'',create_time:1795564800,share_url:'https://www.tiktok.com/',view_count:[92000,65000,29400][i],like_count:10,comment_count:1,share_count:0}],has_more:false,cursor:0}})});
 await page.route(/\/api\/gateway\/v1\/trends(?:\?|$)/,route=>route.fulfill({json:{observations:[{id:'research-1',topic:'Music production process',source:'Fixture source',sourceUrl:'https://example.com',region:'ID',type:'topic',observedAt:'2026-11-25T00:00:00Z',evidence:'Simulated evidence',changePct:null,metric:null}]}}));
 return {accounts,posts};
}
