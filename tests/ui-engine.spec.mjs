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
