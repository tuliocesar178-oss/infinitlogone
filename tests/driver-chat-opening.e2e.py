import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as source:
        auth = json.load(source)
    screenshots = Path('/tmp/browser/driver-chat')
    screenshots.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 1800})
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto('http://localhost:8080')
        await page.evaluate('(d) => localStorage.setItem(d.key, JSON.stringify(d.session))',
                            {'key': auth['storage_key'], 'session': auth['session']})
        await page.goto('http://localhost:8080/driver/fretes')
        await page.get_by_role('button', name='Chat', exact=True).first.click(timeout=45000)
        dialog = page.get_by_role('dialog', name='Meus chats')
        await dialog.get_by_placeholder('Digite uma mensagem...').wait_for(timeout=45000)
        await dialog.get_by_text('Verificação de unificação do chat — histórico preservado.', exact=True).wait_for()
        assert await dialog.get_by_text('Histórico operacional · Somente leitura', exact=True).count() == 0
        await page.screenshot(path=str(screenshots / 'quick-chat-desktop.png'))
        await page.set_viewport_size({'width': 390, 'height': 844})
        await dialog.get_by_role('button', name='Voltar', exact=True).click()
        await dialog.get_by_role('button', name='Abrir marcos', exact=True).click()
        await dialog.get_by_role('heading', name='marcos', exact=True).wait_for()
        await dialog.get_by_role('button', name='Voltar', exact=True).click()
        await dialog.get_by_role('button', name='Abrir tulio cesar', exact=True).wait_for()
        await page.screenshot(path=str(screenshots / 'quick-chat-mobile-list.png'))
        await dialog.get_by_role('button', name='Fechar chat', exact=True).click()
        await page.goto('http://localhost:8080/driver/chat?roomId=5a726669-92be-4b0f-895a-61da33ec8282')
        await page.get_by_placeholder('Digite uma mensagem...').wait_for(timeout=45000)
        await page.get_by_role('heading', name='tulio cesar', exact=True).wait_for()
        await page.screenshot(path=str(screenshots / 'merged-chat-mobile.png'))
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        print('PASS: freight shortcut opens authorized writable chat; messages load; back and switching work; merged links resolve; no runtime errors.')
        await browser.close()

asyncio.run(main())