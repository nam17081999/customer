#!/usr/bin/env python3
import json, asyncio, websockets

async def main():
    WS_URL = "ws://127.0.0.1:9222/devtools/page/EFE35A0C0E9584AB72D21F48B440A661"
    async with websockets.connect(WS_URL, max_size=2**20) as ws:
        await ws.send(json.dumps({'id':1,'method':'Page.enable'}))
        await asyncio.sleep(0.3)
        await ws.recv()
        await ws.recv()
        
        # Check URL
        await ws.send(json.dumps({'id':2,'method':'Runtime.evaluate','params':{'expression':'window.location.href'}}))
        resp = json.loads(await ws.recv())
        url = resp.get('result',{}).get('result',{}).get('value','')
        print(f'URL: {url}')
        
        # Get page text
        await ws.send(json.dumps({'id':3,'method':'Runtime.evaluate','params':{'expression':'document.body?.innerText?.substring(0,500) || "no body"'}}))
        resp = json.loads(await ws.recv())
        text = resp.get('result',{}).get('result',{}).get('value','')
        print(f'Text: {text}')

asyncio.get_event_loop().run_until_complete(main())
