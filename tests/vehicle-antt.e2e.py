import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  context=await browser.new_context(viewport={'width':1280,'height':1800})
  with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f:auth=json.load(f)
  page=await context.new_page(); errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m: print('console',m.type,m.text[:400]) if m.type=='error' else None)
  page.on('requestfailed',lambda r: print('failed',r.url.split('?')[0],r.failure))
  await page.goto('http://localhost:8080')
  await page.evaluate('(d)=>localStorage.setItem(d.key,JSON.stringify(d.session))',{'key':auth['storage_key'],'session':auth['session']})
  await page.goto('http://localhost:8080/ops/pedidos/novo'); await page.wait_for_timeout(15000)
  await page.get_by_role('heading',name='Novo frete',exact=True).wait_for(timeout=60000)
  await page.locator('label').filter(has_text='Nome do cliente').locator('input').fill('Tulio')
  await page.get_by_role('button',name='Avançar',exact=True).click()
  for address in ['Avenida Paulista 1000 São Paulo','Avenida Afonso Pena 1000 Belo Horizonte']:
   await page.get_by_placeholder('Digite o endereço...').fill(address)
   suggestion=page.locator('button').filter(has=page.locator('div.font-medium.truncate')).first
   await suggestion.wait_for(timeout=30000)
   await suggestion.click()
   await page.get_by_role('button',name='Avançar',exact=True).click()
  await page.get_by_role('button',name='Avançar',exact=True).click()
  await page.get_by_role('button',name='Avançar',exact=True).click()
  catalog=page.get_by_role('region',name='Comparação de veículos pesados')
  await catalog.wait_for(timeout=30000)
  await page.wait_for_timeout(2500)
  print('catalog',await catalog.inner_text())
  assert await catalog.get_by_role('button').count() >= 7
  await catalog.get_by_role('button',name='Carreta Configuração pendente',exact=False).first.click()
  await page.get_by_role('combobox').filter(has=page.locator('option[value="5"]')).select_option('5')
  await catalog.get_by_text('R$',exact=False).first.wait_for(timeout=30000)
  floor=await catalog.get_by_role('button',name='Carreta 5 eixos',exact=False).first.inner_text()
  print('calculated real floor',floor)
  assert 'R$' in floor
  await page.get_by_role('button',name='Usar valor sugerido',exact=True).click()
  field=page.locator('label').filter(has_text='Valor negociado com cliente').locator('input')
  applied=await field.input_value(); assert float(applied)>0
  await field.fill(str(float(applied)+100))
  await page.get_by_role('checkbox',name='Selecionar todos pesados').check()
  assert await catalog.get_by_role('button',name='Carreta 5 eixos',exact=False).first.get_attribute('aria-pressed')=='true'
  await page.get_by_role('combobox').filter(has=page.locator('option[value="tracao"]')).select_option('tracao')
  await page.wait_for_timeout(2500)
  assert await catalog.get_by_role('button',name='Carreta 5 eixos',exact=False).first.get_attribute('aria-pressed')=='true'
  await catalog.screenshot(path='/tmp/browser/vehicle-antt/catalog-desktop.png')
  await page.set_viewport_size({'width':390,'height':844})
  await catalog.screenshot(path='/tmp/browser/vehicle-antt/catalog-mobile.png')
  await page.wait_for_timeout(6000)
  assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  assert not errors,errors
  print('PASS real route, explicit axles, actual ANTT price, apply/edit, compare retains selection, recalculate, mobile no overflow')
  await browser.close()
asyncio.run(main())
