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
 const shared=page.getByRole('button',{name:'Open shared account Studio Beta',exact:true});
 await shared.click();await expect(page.getByLabel('Filter accounts')).toHaveValue(accounts[1].slot);
 await expect(page.locator('.r1-filter-context').getByText('Studio Beta',{exact:true})).toBeVisible();
 await expect(page.locator('.r1-library').getByText('Behind the scenes',{exact:true}).filter({visible:true})).toBeVisible();
 await expect(shared).toHaveAttribute('aria-pressed','true');
 expect(await page.locator('.r1-sidebar').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 for(const width of [1025,1024,900,768,390,320,1440]){
  await page.setViewportSize({width,height:844});
  await expect(page.getByLabel('Filter accounts')).toHaveValue(accounts[1].slot);
  await expect(page.locator('.r1-library').getByText('Behind the scenes',{exact:true}).filter({visible:true})).toBeVisible();
  expect(await page.getByRole('navigation',{name:'Workspace navigation'}).count()).toBe(1);
  await expect(page.getByRole('button',{name:'Operator access: unlocked'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const metrics=await page.locator('.r1-filter-context').evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),width:el.scrollWidth,client:el.clientWidth}));
  expect(metrics.font).toBeGreaterThanOrEqual(13);expect(metrics.width).toBeLessThanOrEqual(metrics.client+1);
  if(width===1025||width===1024||width===390)await page.screenshot({path:'engine-test-results/'+browserName+'-content-'+width+'.png',fullPage:true});
 }
 await page.getByRole('button',{name:'Clear account filter'}).click();await expect(page.getByLabel('Filter accounts')).toHaveValue('all');
 for(const width of [1440,900,390,320]){
  await page.setViewportSize({width,height:844});
  for(const [label,slug] of [['Overview','overview'],['Accounts','accounts'],['Publishing','publishing'],['AI Agent','agent']]){
   await nav(page,label).click();await expect(page.getByRole('heading',{level:1,name:label,exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   if(width===900||width===390)await page.screenshot({path:'engine-test-results/'+browserName+'-'+slug+'-'+width+'.png',fullPage:true});
  }
 }
 await page.getByRole('button',{name:'Kunci sesi'}).click();
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
 await nav(page,'Content').click();await expect(page.getByLabel('Filter accounts')).toBeVisible();
 await expect.poll(async()=>(await scrollState()).y).toBeLessThanOrEqual(2);
 for(const width of [320,390,640,900,1024,1025,1440]){
  await page.setViewportSize({width,height:600});
  const bar=page.getByRole('group',{name:'Content controls'});
  const geometry=await bar.evaluate(el=>{const bounds=el.getBoundingClientRect();return [...el.querySelectorAll('input,select,button')].map(e=>{const r=e.getBoundingClientRect();return {inside:r.left>=bounds.left-1&&r.right<=bounds.right+1,width:r.width,height:r.height}})});
  expect(geometry).toHaveLength(5);
  for(const r of geometry){expect(r.inside).toBe(true);expect(r.width).toBeGreaterThan(20);expect(r.height).toBeGreaterThan(16)}
  await page.getByRole('button',{name:'Grid view'}).click();
  await expect(page.getByRole('button',{name:'Grid view'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'List view'}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
 await page.setViewportSize({width:390,height:420});
 await nav(page,'Publishing').click();
 await page.locator('.r1-queue-mobile-row').filter({hasText:'Behind the scenes'}).getByRole('button',{name:'Review',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Review agent draft'});await expect(dialog).toBeVisible();
 const body=dialog.locator('.r1-review-body');
 expect(await body.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 const before=(await scrollState()).y;
 const db=await body.boundingBox();await page.mouse.move(db.x+db.width/2,db.y+db.height/2);await page.mouse.wheel(0,500);
 await expect.poll(()=>body.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 expect(Math.abs((await scrollState()).y-before)).toBeLessThanOrEqual(2);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY)).toBe('hidden');
 await page.screenshot({path:'engine-test-results/'+browserName+'-scrolled-review-390.png'});
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY)).not.toBe('hidden');
});
