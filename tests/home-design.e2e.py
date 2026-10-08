import asyncio,json,os
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True); c=await b.new_context(viewport={"width":1280,"height":1800}); page=await c.new_page(); errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://localhost:8080/')
  with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f: s=json.load(f)
  await page.evaluate('([k,v])=>localStorage.setItem(k,v)',[s['storage_key'],json.dumps(s['session'])])
  await page.goto('http://localhost:8080/admin'); await page.get_by_role('heading',name='Personalização do Site',exact=True).wait_for()
  panel=page.get_by_role('region',name='Personalização do Site')
  original='premium-map' if await panel.locator('article').filter(has=page.get_by_role('heading',name='Mapa Logístico Premium',exact=True)).get_by_text('Design ativo').count() else 'current'
  target='current' if original=='premium-map' else 'premium-map'; title='Mapa Logístico Premium' if target=='premium-map' else 'Design atual'
  card=panel.locator('article').filter(has=page.get_by_role('heading',name=title,exact=True))
  async with page.expect_popup() as popup: await card.get_by_role('button',name='Pré-visualizar').click()
  preview=await popup.value; await preview.wait_for_load_state(); await preview.close()
  await card.get_by_role('button',name='Aplicar design').click(); await panel.get_by_role('button',name='Salvar alterações').click()
  await panel.get_by_text('Design da página inicial salvo para todos os visitantes.').wait_for()
  public=await b.new_context(viewport={"width":1280,"height":1800}); visitor=await public.new_page(); await visitor.goto('http://localhost:8080/'); await visitor.wait_for_timeout(1200)
  heading=await visitor.get_by_role('heading',level=1).inner_text(); assert ('boas mãos' in heading)==(target=='premium-map'); print('saved design read back anonymously',target)
  await panel.get_by_role('button',name='Restaurar design anterior').click(); await panel.get_by_role('button',name='Salvar alterações').click(); await page.wait_for_timeout(1200)
  await visitor.reload(); await visitor.wait_for_timeout(1000); heading=await visitor.get_by_role('heading',level=1).inner_text(); assert ('boas mãos' in heading)==(original=='premium-map'); print('restored original',original)
  await page.screenshot(path='/tmp/browser/home-design/settings.png')
  await visitor.goto('http://localhost:8080/?design=premium-map'); await visitor.wait_for_timeout(1500)
  await visitor.set_viewport_size({'width':390,'height':844}); await visitor.screenshot(path='/tmp/browser/home-design/mobile.png')
  assert await visitor.evaluate('document.documentElement.scrollWidth<=window.innerWidth'); print('mobile no horizontal overflow')
  print('errors',errors); await b.close()
asyncio.run(main())
