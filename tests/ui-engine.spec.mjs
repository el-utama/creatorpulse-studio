import {test,expect} from '@playwright/test';
import {installWorkspaceFixture} from './workspace-fixture.mjs';
const nav=(page,name)=>page.getByRole('navigation',{name:'Workspace navigation'}).getByRole('button',{name,exact:true});
test('workspace design contract: navigation, resize, content scope and readable controls',async({page,context,browserName})=>{
 test.setTimeout(90000);
 const {accounts}=await installWorkspaceFixture(page,context);
 await page.setViewportSize({width:1440,height:900});await page.goto('/dashboard');
 await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();
 await nav(page,'AI Agent').click();await page.getByLabel('Kunci operator',{exact:true}).fill('fixture-operator');
 await page.getByRole('button',{name:'Buka akses'}).click();
 await expect(page.getByText('Bridge data loaded',{exact:true})).toBeVisible();
 await page.setViewportSize({width:1280,height:420});
 const shared=page.getByLabel('Workspace account');
 await shared.selectOption(accounts[1].slot);await expect(page.getByRole('heading',{level:1,name:'AI Agent',exact:true})).toBeVisible();
 await expect(page.getByLabel('Workspace account')).toHaveValue(accounts[1].slot);
 await nav(page,'Overview').click();await expect(page.getByLabel('Workspace account')).toHaveValue(accounts[1].slot);
 await expect(page.locator('.r1-metric-grid').getByText('8.2K',{exact:true})).toBeVisible();
 await expect(page.locator('.r1-metric-grid').getByText('24.8K',{exact:true})).toHaveCount(0);
 await nav(page,'Publishing').click();await expect(page.getByLabel('Workspace account')).toHaveValue(accounts[1].slot);
 await expect(page.locator('.r1-queue').getByText('Behind the scenes',{exact:true}).filter({visible:true})).toBeVisible();
 await expect(page.locator('.r1-queue').getByText('Morning studio routine',{exact:true})).toHaveCount(0);
 await nav(page,'Accounts').click();await expect(page.getByLabel('Workspace account')).toHaveValue(accounts[1].slot);
 await expect(page.locator('.r1-account-directory [data-account-selected=true]').filter({visible:true})).toHaveCount(1);
 await nav(page,'Content').click();await expect(page.getByLabel('Workspace account')).toHaveValue(accounts[1].slot);
 await expect(page.locator('.r1-filter-context').getByText('Studio Beta',{exact:true})).toBeVisible();
 await expect(page.locator('.r1-library').getByText('Behind the scenes',{exact:true}).filter({visible:true})).toBeVisible();
 await expect(shared).toHaveValue(accounts[1].slot);
 await expect(page.locator('.r1-sidebar')).toHaveCount(0);await expect(page.locator('.cp-primary-nav')).toBeVisible();
 for(const width of [1025,1024,900,768,390,320,1440]){
  await page.setViewportSize({width,height:844});
  await expect(page.getByLabel('Workspace account')).toHaveValue(accounts[1].slot);
  await expect(page.locator('.r1-library').getByText('Behind the scenes',{exact:true}).filter({visible:true})).toBeVisible();
  const library=page.locator('.r1-library');
  const visibleRows=library.locator('[data-account-slot]:visible');
  await expect(visibleRows).toHaveCount(1);
  await expect(visibleRows.first()).toHaveAttribute('data-account-slot',accounts[1].slot);
  await expect(visibleRows.first().locator('.r1-video-account')).toHaveText('Studio Beta');
  expect(await page.getByRole('navigation',{name:'Workspace navigation'}).count()).toBe(1);
  await expect(page.getByRole('button',{name:'Operator access: unlocked'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const metrics=await page.locator('.r1-filter-context').evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),width:el.scrollWidth,client:el.clientWidth}));
  expect(metrics.font).toBeGreaterThanOrEqual(13);expect(metrics.width).toBeLessThanOrEqual(metrics.client+1);
  if(width===1025||width===1024||width===390)await page.screenshot({path:'engine-test-results/'+browserName+'-content-'+width+'.png',fullPage:true});
 }
 await page.getByRole('button',{name:'Grid view'}).click();
 await expect(page.locator('.r1-library [data-account-slot]:visible')).toHaveCount(1);
 await expect(page.locator('.r1-library [data-account-slot]:visible .r1-video-account')).toHaveText('Studio Beta');
 await page.getByRole('button',{name:'List view'}).click();
 await page.getByRole('button',{name:'Clear account filter'}).click();await expect(page.getByLabel('Workspace account')).toHaveValue('all');
 await expect(page.locator('.r1-library [data-account-slot]:visible')).toHaveCount(3);
 for(const width of [1440,900,390,320]){
  await page.setViewportSize({width,height:844});
  for(const [label,slug] of [['Overview','overview'],['Accounts','accounts'],['Publishing','publishing'],['AI Agent','agent']]){
   await nav(page,label).click();await expect(page.getByRole('heading',{level:1,name:label,exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   if(width===900||width===390)await page.screenshot({path:'engine-test-results/'+browserName+'-'+slug+'-'+width+'.png',fullPage:true});
  }
 }
 await page.getByRole('button',{name:'Lock session'}).click();
 await expect(page.getByRole('button',{name:'Operator access: locked'})).toBeVisible();
 await nav(page,'Content').click();await expect(page.locator('.r1-filter-context')).toHaveCount(0);
});

test('workspace scroll and toolbar remain reachable across resize and modal',async({page,context,browserName})=>{
 test.setTimeout(90000);
 await installWorkspaceFixture(page,context);
 await page.setViewportSize({width:1440,height:420});await page.goto('/dashboard?view=agent');
 await page.getByLabel('Kunci operator',{exact:true}).fill('fixture-operator');
 await page.getByRole('button',{name:'Buka akses'}).click();
 await expect(page.getByText('Bridge data loaded',{exact:true})).toBeVisible();
 const scrollState=()=>page.evaluate(()=>({y:window.scrollY,max:document.scrollingElement.scrollHeight-document.scrollingElement.clientHeight}));
 for(const width of [1440,1025,1024,900,390,320]){
  await page.setViewportSize({width,height:420});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.mouse.move(width-40,210);await page.mouse.wheel(0,700);
  await expect.poll(async()=>(await scrollState()).y).toBeGreaterThan(0);
  const top=await page.locator('.r1-topbar').boundingBox();
  expect(Math.abs(top.y)).toBeLessThanOrEqual(1);
  const controls=await page.locator('.r1-top-controls').boundingBox();
  expect(controls.x+controls.width).toBeLessThanOrEqual(width+1);
  await page.evaluate(()=>window.scrollTo(0,document.scrollingElement.scrollHeight));
  await expect.poll(async()=>{const s=await scrollState();return Math.abs(s.max-s.y)}).toBeLessThanOrEqual(2);
  const bottom=page.locator('.r1-bottomnav');
  if(width<=1024){
   const navBox=await bottom.boundingBox();expect(navBox.y+navBox.height).toBeCloseTo(420,0);
   const last=await page.locator('#integration-settings').boundingBox();
   expect(last.y+last.height).toBeLessThanOrEqual(navBox.y+1);
  }
  if(width===390||width===1440)await page.screenshot({path:'engine-test-results/'+browserName+'-scrolled-agent-'+width+'.png'});
 }
 await nav(page,'Content').click();await expect(page.getByLabel('Workspace account')).toBeVisible();
 await expect.poll(async()=>(await scrollState()).y).toBeLessThanOrEqual(2);
 for(const width of [320,390,640,900,1024,1025,1440]){
  await page.setViewportSize({width,height:600});
  const bar=page.getByRole('group',{name:'Content controls'});
  const geometry=await bar.evaluate(el=>{const bounds=el.getBoundingClientRect();return [...el.querySelectorAll('input,select,button')].map(e=>{const r=e.getBoundingClientRect();return {inside:r.left>=bounds.left-1&&r.right<=bounds.right+1,width:r.width,height:r.height}})});
  expect(geometry).toHaveLength(4);
  for(const r of geometry){expect(r.inside).toBe(true);expect(r.width).toBeGreaterThan(20);expect(r.height).toBeGreaterThanOrEqual(width<=1024?42:38)}
  await page.getByRole('button',{name:'Grid view'}).click();
  await expect(page.getByRole('button',{name:'Grid view'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'List view'}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
 await page.setViewportSize({width:390,height:420});
 await nav(page,'Publishing').click();
 await expect(page.getByRole('heading',{name:'Publication queue',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Operator access: unlocked'})).toBeVisible();
 const opener=page.locator('.r1-queue-mobile-row').filter({hasText:'Behind the scenes'}).getByRole('button',{name:'Review',exact:true});
 await opener.click();
 const dialog=page.getByRole('dialog',{name:'Review agent draft'});await expect(dialog).toBeVisible();
 const body=dialog.locator('.r1-review-body');
 await expect(dialog.getByText('Studio Beta (@fixture_creator)',{exact:false})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Approve Direct Post'})).toBeDisabled();
 await expect.poll(()=>body.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeGreaterThan(0);
 const before=(await scrollState()).y;
 const db=await body.boundingBox();await body.evaluate(el=>{el.scrollTop=0});await page.mouse.move(db.x+db.width-20,db.y+Math.min(50,db.height/2));await page.mouse.wheel(0,500);
 await expect.poll(()=>body.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 expect(Math.abs((await scrollState()).y-before)).toBeLessThanOrEqual(2);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY)).toBe('hidden');
 await page.screenshot({path:'engine-test-results/'+browserName+'-scrolled-review-390.png'});
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY)).not.toBe('hidden');
 await expect(page.getByRole('button',{name:'Operator access: unlocked'})).toBeVisible();
 await expect(opener).toBeVisible();
});

test('realistic data density keeps dates, headers and full captions usable',async({page,context,browserName})=>{
 test.setTimeout(90000);
 const {accounts,longCaption,longTitle}=await installWorkspaceFixture(page,context,{stress:true});
 await page.setViewportSize({width:1440,height:900});await page.goto('/dashboard');
 await nav(page,'AI Agent').click();await page.getByLabel('Kunci operator',{exact:true}).fill('fixture-operator');await page.getByRole('button',{name:'Buka akses'}).click();
 await expect(page.getByText('Bridge data loaded',{exact:true})).toBeVisible();
 const fit=async()=>{
  const issues=await page.locator('.r1-table:visible').evaluateAll(tables=>tables.flatMap(t=>[...t.querySelectorAll('th,.r1-date,.r1-num')].filter(el=>el.getClientRects().length&&el.scrollWidth>el.clientWidth+1).map(el=>el.textContent)));
  expect(issues).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual((await page.viewportSize()).width);
 };
 for(const width of [1600,1440,1366,1280,1025,900,390,320]){
  await page.setViewportSize({width,height:800});
  for(const view of ['Overview','Accounts','Content','Publishing']){
   await nav(page,view).click();await expect(page.getByRole('heading',{level:1,name:view,exact:true})).toBeVisible();await fit();
   if(view==='Overview'){
    const performance=page.locator('.r1-performance');
    const account=performance.locator('.r1-account-name').filter({hasText:accounts[0].name,visible:true});
    await expect(account).toBeVisible();
    expect(await account.evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(70);
    const compact=performance.locator('.r1-account-mobile-row:visible');
    if(await compact.count())expect(await compact.first().evaluate(el=>getComputedStyle(el).display)).toBe('flex');
   }
   if(view==='Content'){
    await page.getByRole('button',{name:'List view'}).click();
    await expect(page.getByText(longTitle,{exact:true}).filter({visible:true})).toBeVisible();
    const dates=await page.locator('.r1-video-table:visible .r1-date').evaluateAll(els=>els.map(el=>getComputedStyle(el).whiteSpace));
    expect(dates.every(v=>v==='nowrap')).toBe(true);
    if(width===1440||width===1600){
     const header=page.locator('.r1-video-table:visible th[scope="col"]').filter({hasText:/^Comments$/});
     await expect(header).toBeVisible();
     expect(await header.evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);return r.getClientRects().length})).toBe(1);
    }
   }
   if(view==='Publishing'){
    const preview=page.locator('.r1-queue .r1-caption-preview').filter({hasText:'FINAL CAPTION MARKER',visible:true});
    await expect(preview).toBeVisible();
    const m=await preview.evaluate(el=>({height:el.getBoundingClientRect().height,line:parseFloat(getComputedStyle(el).lineHeight),scroll:el.scrollHeight}));
    expect(m.height).toBeLessThanOrEqual(m.line*2+1);expect(m.scroll).toBeGreaterThan(m.height);
   }
   if(width===1440||width===1280||width===390)await page.screenshot({path:'engine-test-results/'+browserName+'-density-'+view.toLowerCase()+'-'+width+'.png'});
  }
 }
 await page.setViewportSize({width:1440,height:800});
 const row=page.locator('.r1-queue').locator('tr,article').filter({hasText:'FINAL CAPTION MARKER',visible:true});
 await row.getByRole('button',{name:'Review',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Review agent draft'});await expect(dialog).toBeVisible();
 await expect(dialog.getByText(longCaption,{exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});

test('empty and unavailable libraries remain distinct; scope cannot change compose target',async({page,context,browserName})=>{
 test.setTimeout(90000);
 const {accounts}=await installWorkspaceFixture(page,context);
 const [alpha,beta,gamma]=accounts;
 let accountWrites=0;
 page.on('request',r=>{if(new URL(r.url()).pathname==='/api/auth/accounts'&&r.method()!=='GET')accountWrites++});
 await page.route('**/api/gateway/v1/accounts/*/videos**',route=>{
  const url=route.request().url();
  if(url.includes('/'+alpha.slot+'/'))return route.fulfill({json:{videos:[],has_more:false,cursor:0}});
  if(url.includes('/'+beta.slot+'/'))return route.fulfill({status:503,json:{error:'Fixture video list unavailable'}});
  return route.fulfill({status:404,json:{error:'Fixture account missing'}});
 });
 await page.setViewportSize({width:1440,height:900});await page.goto('/dashboard?view=agent');
 await page.getByLabel('Kunci operator',{exact:true}).fill('fixture-operator');await page.getByRole('button',{name:'Buka akses'}).click();
 await expect(page.getByText('Bridge data loaded',{exact:true})).toBeVisible();
 await nav(page,'Content').click();
 const alphaButton=page.getByLabel('Workspace account');
 await alphaButton.focus();await alphaButton.press('Home');await alphaButton.press('ArrowDown');await alphaButton.press('Enter');
 await expect(alphaButton).toHaveValue(alpha.slot);
 await expect(page.getByRole('heading',{level:1,name:'Content',exact:true})).toBeVisible();
 await expect(page.getByLabel('Workspace account')).toHaveValue(alpha.slot);
 await expect(page.getByText('No public videos in the loaded library.',{exact:true})).toBeVisible();
 await expect(page.locator('.r1-library .r1-table:visible')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Load more'})).toBeDisabled();
 await page.screenshot({path:'engine-test-results/'+browserName+'-empty-library.png'});
 await page.getByLabel('Workspace account').selectOption(beta.slot);
 await expect(page.getByText('Videos could not be loaded for this selection.',{exact:true})).toBeVisible();
 await page.getByLabel('Search content').fill('not present');
 await expect(page.getByText('Videos could not be loaded for this selection.',{exact:true})).toBeVisible();
 await page.screenshot({path:'engine-test-results/'+browserName+'-unavailable-library.png'});
 await page.getByLabel('Workspace account').selectOption(gamma.slot);
 await expect(page.locator('.r1-library [data-account-slot]:visible')).toHaveCount(1);
 await page.getByLabel('Search content').fill('not present');
 await expect(page.getByText('No videos match your search.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Clear search'}).click();
 await expect(page.locator('.r1-library [data-account-slot]:visible')).toHaveCount(1);
 await nav(page,'Publishing').click();
 await expect(page.getByLabel('Workspace account')).toHaveValue(gamma.slot);
 await page.getByRole('navigation',{name:'Publishing views'}).getByRole('button',{name:'Review',exact:true}).click();
 await expect(page.getByText('No drafts awaiting approval for this account.',{exact:true})).toBeVisible();
 await page.locator('#main-content').getByRole('button',{name:'New post',exact:true}).click();
 const target=page.getByLabel('Target account',{exact:true});
 await expect(target).toHaveValue('');
 await expect(alphaButton).toBeDisabled();
 await target.selectOption(alpha.slot);
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByLabel('URL video')).toBeVisible();
 await page.getByLabel('URL video').fill('https://example.com/video.mp4');await expect(page.getByRole('button',{name:'Refresh workspace'})).toBeDisabled();
 page.once('dialog',d=>d.dismiss());await nav(page,'Overview').click();
 await expect(page.getByLabel('URL video')).toHaveValue('https://example.com/video.mp4');
 await expect(alphaButton).toBeDisabled();
 page.once('dialog',d=>d.accept());await nav(page,'Overview').click();
 await expect(page.getByRole('heading',{level:1,name:'Overview',exact:true})).toBeVisible();
 await expect(page.getByLabel('Workspace account')).toHaveValue(gamma.slot);
 expect(accountWrites).toBe(0);
});


test('operate redesign prioritizes actions and groups performance without decorative cards',async({page,context,browserName})=>{
 const {accounts}=await installWorkspaceFixture(page,context,{stress:true});
 await page.setViewportSize({width:1440,height:900});await page.goto('/dashboard');
 await nav(page,'AI Agent').click();await page.getByLabel('Kunci operator',{exact:true}).fill('fixture-operator');await page.getByRole('button',{name:'Buka akses'}).click();
 await expect(page.getByText('Bridge data loaded',{exact:true})).toBeVisible();await nav(page,'Overview').click();
 for(const width of [1440,1280,900,390,320]){
  await page.setViewportSize({width,height:900});
  const actions=page.locator('.cp-action-center');const summary=page.getByRole('region',{name:'Performance summary'});
  await expect(actions).toBeVisible();await expect(summary).toBeVisible();
  const ab=await actions.boundingBox(),sb=await summary.boundingBox();expect(ab.y).toBeLessThan(sb.y);expect(Math.abs(ab.x-sb.x)).toBeLessThanOrEqual(2);
  await expect(summary.locator('.r1-metric')).toHaveCount(4);await expect(summary.locator('.r1-metric-icon')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:'engine-test-results/'+browserName+'-operate-overview-'+width+'.png'});
 }
 await page.setViewportSize({width:1440,height:900});
 const account=page.getByLabel('Workspace account');await account.selectOption(accounts[1].slot);await expect(account).toHaveValue(accounts[1].slot);await expect(page.getByLabel('Workspace account')).toHaveValue(accounts[1].slot);
 await expect(page.getByRole('heading',{level:1,name:'Overview',exact:true})).toBeVisible();
});


test('account management has one readable permission row and consistent publishing summary',async({page,context,browserName})=>{
 const {accounts}=await installWorkspaceFixture(page,context,{stress:true});
 await page.setViewportSize({width:1440,height:900});await page.goto('/dashboard?view=agent');
 await page.getByLabel('Kunci operator',{exact:true}).fill('fixture-operator');await page.getByRole('button',{name:'Buka akses'}).click();await expect(page.getByText('Bridge data loaded',{exact:true})).toBeVisible();
 for(const width of [1600,1440,1280,900,390,320]){
  await page.setViewportSize({width,height:900});await nav(page,'Accounts').click();
  const list=page.locator('.cp-directory-list');await expect(list.locator('.cp-directory-row')).toHaveCount(3);
  const row=list.locator('.cp-directory-row').filter({hasText:accounts[0].name});await expect(row.getByText(accounts[0].name,{exact:true})).toBeVisible();
  const connected=row.getByText('Connected',{exact:true});await expect(connected).toBeVisible();
  expect(await connected.evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);return r.getClientRects().length})).toBe(1);
  const issues=await list.locator('.cp-directory-row :is(.r1-pill,.r1-num,button)').evaluateAll(els=>els.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent));expect(issues).toEqual([]);
  await expect(row.getByRole('button',{name:'Disconnect '+accounts[0].name})).toBeVisible();await expect(row.getByRole('button',{name:'Open content for '+accounts[0].name})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if([1440,1280,390].includes(width))await page.screenshot({path:'engine-test-results/'+browserName+'-operate-accounts-'+width+'.png'});
  await nav(page,'Publishing').click();await expect(page.locator('.cp-summary-strip .r1-summary-box')).toHaveCount(3);await expect(page.locator('.cp-publishing-tabs .r1-tab-count')).toHaveCount(0);await expect(page.getByRole('button',{name:'Lock session'})).toBeVisible();
  if([1440,1280,390].includes(width))await page.screenshot({path:'engine-test-results/'+browserName+'-operate-publishing-'+width+'.png'});
 }
});


test('desk shell has a single scope control and no sidebar across all workspaces',async({page,context,browserName})=>{
 test.setTimeout(90000);const {accounts}=await installWorkspaceFixture(page,context,{stress:true});
 await page.setViewportSize({width:1440,height:900});await page.goto('/dashboard');await nav(page,'AI Agent').click();await page.getByLabel('Kunci operator',{exact:true}).fill('fixture-operator');await page.getByRole('button',{name:'Buka akses'}).click();await expect(page.getByText('Bridge data loaded',{exact:true})).toBeVisible();
 await page.getByLabel('Workspace account').selectOption(accounts[1].slot);
 for(const width of [1600,1440,1280,1025,900,390,320]){
  await page.setViewportSize({width,height:900});
  for(const view of ['Overview','Accounts','Content','Publishing','AI Agent']){
   await nav(page,view).click();await expect(page.getByRole('heading',{level:1,name:view,exact:true})).toBeVisible();await expect(page.getByLabel('Workspace account')).toHaveCount(1);await expect(page.getByLabel('Workspace account')).toHaveValue(accounts[1].slot);await expect(page.locator('.r1-sidebar')).toHaveCount(0);expect(await page.getByRole('navigation',{name:'Workspace navigation'}).count()).toBe(1);if(width<=639){await expect(page.locator('.cp-scope-identity')).toHaveText(accounts[1].name);await expect(page.locator('.cp-scope-identity')).toBeVisible();expect(await page.locator('.cp-scope-identity').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)}
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   const main=await page.locator('#main-content').boundingBox();expect(main.x).toBeLessThanOrEqual(Math.max(0,(width-1520)/2)+1);
   if(width>1024)await expect(page.locator('.cp-primary-nav')).toBeVisible();else await expect(page.locator('.r1-bottomnav')).toBeVisible();
   if([1440,390].includes(width))await page.screenshot({path:'engine-test-results/'+browserName+'-desk-'+view.toLowerCase().replaceAll(' ','-')+'-'+width+'.png',fullPage:true});
  }
 }
});


test('production workspace defaults to media gallery and one publication job representation',async({page,context,browserName})=>{
 const {accounts}=await installWorkspaceFixture(page,context,{stress:true});await page.setViewportSize({width:1440,height:900});await page.goto('/dashboard?view=agent');await page.getByLabel('Kunci operator',{exact:true}).fill('fixture-operator');await page.getByRole('button',{name:'Buka akses'}).click();await expect(page.getByText('Bridge data loaded',{exact:true})).toBeVisible();await nav(page,'Content').click();await expect(page.getByRole('button',{name:'Grid view'})).toHaveAttribute('aria-pressed','true');
 for(const width of [1440,900,390,320]){await page.setViewportSize({width,height:900});await nav(page,'Content').click();await expect(page.locator('.cp-video-gallery .cp-video-item')).toHaveCount(3);if(width<=380){const operator=page.getByRole('button',{name:/^Operator access:/});await expect(operator).toBeVisible();await expect(operator.locator('svg')).toBeVisible();const icon=await operator.locator('svg').boundingBox();expect(icon.width).toBeGreaterThanOrEqual(16);expect(icon.height).toBeGreaterThanOrEqual(16)}if(width<=639){const search=await page.getByLabel('Search content').boundingBox(),toolbar=await page.getByRole('group',{name:'Content controls'}).boundingBox();expect(search.width).toBeGreaterThan(toolbar.width*.7)}await expect(page.locator('.cp-video-item').first().getByText('Comments',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:'engine-test-results/'+browserName+'-production-content-'+width+'.png',fullPage:true});await nav(page,'Publishing').click();await expect(page.locator('.cp-job').filter({hasText:'FINAL CAPTION MARKER'})).toHaveCount(1);await expect(page.locator('.r1-publication-table')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:'engine-test-results/'+browserName+'-production-publishing-'+width+'.png',fullPage:true});}
 const job=page.locator('.cp-job').filter({hasText:'FINAL CAPTION MARKER'});await job.getByRole('button',{name:'Review',exact:true}).click();await expect(page.getByRole('dialog',{name:'Review agent draft'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
