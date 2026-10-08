import asyncio,json,os
from playwright.async_api import async_playwright
async def main():
 with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f: minted=json.load(f)
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  context=await browser.new_context(viewport={'width':1280,'height':1800})
  page=await context.new_page()
  await page.goto('http://localhost:8080')
  await page.evaluate('(d)=>localStorage.setItem(d.key,JSON.stringify(d.session))',{'key':minted['storage_key'],'session':minted['session']})
  await page.goto('http://localhost:8080/driver/chat')
  await page.get_by_role('button',name='Abrir tulio cesar',exact=True).wait_for(timeout=45000)
  await page.get_by_role('button',name='Abrir tulio cesar',exact=True).click()
  await page.wait_for_timeout(2000)
  await page.get_by_text('Verificação de unificação do chat — histórico preservado.',exact=False).wait_for()
  await page.get_by_role('textbox',name='Buscar conversa',exact=True).fill('pix')
  await page.wait_for_timeout(1000)
  assert await page.get_by_role('button',name='Abrir tulio cesar',exact=True).count()==1
  await page.get_by_role('textbox',name='Buscar conversa',exact=True).fill('')
  assert await page.get_by_role('button',name='Abrir OPERAÇÃO',exact=True).count()==0
  headers={'apikey':os.environ['VITE_SUPABASE_PUBLISHABLE_KEY'],'Authorization':'Bearer '+minted['session']['access_token']}
  url=os.environ['VITE_SUPABASE_URL']+'/rest/v1/'
  async def rpc(name,data):
   r=await context.request.post(url+'rpc/'+name,headers=headers,data=data)
   return r, await r.json()
  r,pair1=await rpc('get_or_create_individual_chat',{'_other':'eed096c1-90db-4dfb-b053-52feeae2c340'})
  r,pair2=await rpc('get_or_create_individual_chat',{'_other':'eed096c1-90db-4dfb-b053-52feeae2c340'})
  assert pair1==pair2=='3a273da5-01c6-4afb-b651-2c8edd0f1252'
  r,_=await rpc('get_unified_chat_messages',{'_room':'42479fa6-c23e-4407-9f83-97821ae448d4'})
  assert r.status>=400
  r,_=await rpc('get_or_create_operation_room',{})
  assert r.status>=400
  r,_=await rpc('send_unified_chat_message',{'_room':'6aa64e94-12df-4300-9218-6f7ccb44d26a','_content':'must be denied'})
  assert r.status>=400
  r=await context.request.get(url+'messages?room_id=eq.42479fa6-c23e-4407-9f83-97821ae448d4&select=id',headers=headers)
  assert await r.json()==[]
  await page.screenshot(path='/tmp/browser/unified-chat/driver-received.png')
  await page.set_viewport_size({'width':390,'height':844})
  await page.screenshot(path='/tmp/browser/unified-chat/driver-mobile-open.png')
  await page.get_by_role('button',name='Voltar',exact=True).click()
  await page.get_by_role('button',name='Abrir marcos',exact=True).click()
  await page.get_by_role('heading',name='marcos',exact=True).wait_for()
  await page.get_by_role('button',name='Voltar',exact=True).click()
  await page.get_by_role('button',name='Abrir PED-021C3022',exact=True).click()
  await page.wait_for_timeout(1800)
  await page.screenshot(path='/tmp/browser/unified-chat/driver-mobile-history.png')
  assert await page.get_by_placeholder('Digite uma mensagem...').count()==0
  assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  print('PASS: driver receives staff message, content search, unique pair identity, group and third-party RLS denial, legacy write denial, mobile back/navigation and no overflow.')
  await browser.close()
asyncio.run(main())
