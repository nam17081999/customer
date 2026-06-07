#!/usr/bin/env python3
import json, asyncio, websockets, sys

async def main():
    # Use the orders tab (already logged in)
    WS_URL = "ws://127.0.0.1:9222/devtools/page/EFE35A0C0E9584AB72D21F48B440A661"
    async with websockets.connect(WS_URL, max_size=2**20) as ws:
        # Enable Page domain
        await ws.send(json.dumps({'id':1,'method':'Page.enable'}))
        await asyncio.sleep(0.3)
        resp = json.loads(await ws.recv())
        
        # Get current page content
        await ws.send(json.dumps({'id':2,'method':'Runtime.evaluate','params':{'expression':'document.querySelector("main")?.innerHTML?.substring(0,200) || document.body?.innerText?.substring(0,200) || "empty"'}}))
        resp = json.loads(await ws.recv())
        print('Current page content:')
        print(resp.get('result',{}).get('result',{}).get('value',''))
        
        # Check URL
        await ws.send(json.dumps({'id':3,'method':'Runtime.evaluate','params':{'expression':'window.location.href'}}))
        resp = json.loads(await ws.recv())
        print('URL:', resp.get('result',{}).get('result',{}).get('value',''))
        
        # Get all links
        await ws.send(json.dumps({'id':4,'method':'Runtime.evaluate','params':{'expression':'Array.from(document.querySelectorAll("a[href*=\\\"orders\\\"]")).map(a=>a.href).slice(0,5)'}}))
        resp = json.loads(await ws.recv())
        links = resp.get('result',{}).get('result',{}).get('value',[])
        print(f"Links: {links}")

asyncio.get_event_loop().run_until_complete(main())
