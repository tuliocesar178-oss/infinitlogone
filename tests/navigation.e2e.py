import asyncio,json,os
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  ctx=await browser.new_context(viewport={'width':1280,'height':1800})
  page=await ctx.new_page(); errors=[];page.on('console',lambda m:print('console error',m.text) if m.type=='error' else None);page.on('pageerror',lambda e:errors.append(str(e)))
  minted=json.load(open(os.path.expanduser('~/.cache/lovable-auth/session.json')))
  await page.goto('http://localhost:8080');await page.evaluate('(v)=>localStorage.setItem(v.key,v.session)',{'key':minted['storage_key'],'session':json.dumps(minted['session'])})
  await page.goto('http://localhost:8080/driver/fretes'); await page.wait_for_timeout(12000)
  await page.get_by_role('link',name='Iniciar navegação',exact=True).first.click()
  await page.get_by_role('button',name='Iniciar navegação',exact=True).wait_for(timeout=30000)
  order_id=page.url.rsplit('/',1)[-1]
  print('navigation url',page.url)
  await page.wait_for_timeout(12000);print("canvas dimensions",await page.locator("canvas").evaluate_all("els=>els.map(e=>({w:e.clientWidth,h:e.clientHeight}))"));await page.screenshot(path="/tmp/browser/navigation/desktop.png")
  await page.get_by_role('button',name='Abrir em outro aplicativo').click()
  print('google',await page.get_by_role('link',name='Google Maps').get_attribute('href'))
  print('waze',await page.get_by_role('link',name='Waze').get_attribute('href'))
  await page.get_by_role('button',name='Continuar no Mapbox').click()
  await page.wait_for_timeout(1500)
  print('GPS denied',await page.get_by_role('alert').all_text_contents())
  await page.screenshot(path='/tmp/browser/navigation/gps-denied.png')
  await page.get_by_role('button',name='Encerrar',exact=True).click()
  # Verify real Directions with stored pickup as origin; no GPS or telemetry fabricated/saved.
  result=await page.evaluate('''async orderId => {
   const {supabase}=await import('/src/integrations/supabase/client.ts');
   const {data:order,error}=await supabase.from('orders').select('origin_lng,origin_lat,destination_lng,destination_lat').eq('id',orderId).single();
   if(error || order?.origin_lng == null || order?.origin_lat == null) throw new Error('Coordenadas de coleta indisponíveis para o teste');
   const {getNavigationDirections}=await import('/src/lib/navigation/directions.functions.ts');
   const data=await getNavigationDirections({data:{orderId,position:[order.destination_lng,order.destination_lat]}});
   if (!(data.routes[0].distance > 0)) throw new Error('O cálculo não retornou trajeto rodoviário entre os endereços reais');
   return {count:data.routes.length,distance:data.routes[0].distance,steps:data.routes[0].legs[0].steps.map(s=>s.maneuver.instruction),target:data.target.kind};
  }''',order_id)
  print('real directions',json.dumps(result,ensure_ascii=False))
  await page.set_viewport_size({'width':390,'height':844});await page.screenshot(path='/tmp/browser/navigation/mobile.png')
  print('overflow',await page.evaluate('document.documentElement.scrollWidth > innerWidth'));print('errors',errors)
  await browser.close()
asyncio.run(main())
