"""Run against localhost with an approved session minted by lovable auth-session.
No credentials or session contents are printed or stored in this test.
"""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f:
        minted=json.load(f)
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        context=await browser.new_context(viewport={'width':1280,'height':1800})
        page=await context.new_page()
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        await page.goto('http://localhost:8080')
        await page.evaluate('(d)=>localStorage.setItem(d.key,JSON.stringify(d.session))',{'key':minted['storage_key'],'session':minted['session']})
        await page.goto('http://localhost:8080/ops/chat')
        await page.get_by_role('heading',name='Meus chats').last.wait_for(timeout=45000)
        await page.get_by_role('button',name='Abrir tulio Cesar',exact=True).wait_for(timeout=20000)
        await page.get_by_role('button',name='Abrir tulio Cesar',exact=True).click()
        await page.get_by_role('heading',name='tulio Cesar',exact=True).wait_for()
        await page.get_by_text('Me manda seu pix',exact=True).wait_for()
        assert await page.get_by_text('Referência: PED-F2032B67',exact=True).count() == 2
        await page.get_by_placeholder('Digite uma mensagem...').fill('Verificação de unificação do chat — histórico preservado.')
        await page.get_by_role('button',name='Enviar mensagem',exact=True).click()
        await page.get_by_text('Verificação de unificação do chat — histórico preservado.',exact=True).wait_for()
        await page.get_by_role('textbox',name='Buscar conversa',exact=True).fill('PED-F2032B67')
        await page.wait_for_timeout(1500)
        assert await page.get_by_role('button',name='Abrir tulio Cesar',exact=True).count() == 1
        await page.get_by_role('textbox',name='Buscar conversa',exact=True).fill('pix')
        await page.wait_for_timeout(1500)
        assert await page.get_by_role('button',name='Abrir tulio Cesar',exact=True).count() == 1
        await page.get_by_role('textbox',name='Buscar conversa',exact=True).fill('')
        await page.get_by_role('button',name='Abrir OPERAÇÃO',exact=True).click()
        await page.get_by_role('heading',name='OPERAÇÃO',exact=True).wait_for()
        Path('/tmp/browser/unified-chat').mkdir(parents=True,exist_ok=True)
        await page.screenshot(path='/tmp/browser/unified-chat/staff-group.png')
        await page.get_by_role('button',name='Abrir PED-021C3022',exact=True).click()
        await page.get_by_text('Histórico operacional · Somente leitura',exact=True).wait_for()
        assert await page.get_by_placeholder('Digite uma mensagem...').count() == 0
        await page.screenshot(path='/tmp/browser/unified-chat/staff-history.png')
        assert not errors,errors
        print('PASS: staff unique conversation, preserved freight references, send/read, freight/content search, separate group, read-only shared history.')
        await browser.close()
asyncio.run(main())
