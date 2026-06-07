#!/usr/bin/env python3
import json, asyncio, websockets, sys

async def main():
    WS_URL = "ws://127.0.0.1:9222/devtools/page/EFE35A0C0E9584AB72D21F48B440A661"
    async with websockets.connect(WS_URL, max_size=2**20) as ws:
        # Navigate
        await ws.send(json.dumps({'id':1,'method':'Page.navigate','params':{'url':'http://localhost:3000/orders/abc'}}))
        resp = json.loads(await ws.recv())
        print('Navigate result:', resp.get('result',{}).get('url','unk'))
        
        await asyncio.sleep(3)
        
        # Get page text
        await ws.send(json.dumps({'id':2,'method':'Runtime.evaluate','params':{'expression':'document.body?.innerText?.substring(0,500) || "no body"'}}))
        resp = json.loads(await ws.recv())
        text = resp.get('result',{}).get('result',{}).get('value','')
        print('Body text (first 500):', text)

asyncio.get_event_loop().run_until_complete(main())
