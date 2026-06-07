#!/usr/bin/env python3
import json, asyncio, websockets, sys

async def main():
    # Navigate back to orders
    WS_URL = "ws://127.0.0.1:9222/devtools/page/EFE35A0C0E9584AB72D21F48B440A661"
    async with websockets.connect(WS_URL, max_size=2**20) as ws:
        await ws.send(json.dumps({'id':1,'method':'Page.enable'}))
        await asyncio.sleep(0.3)
        await ws.recv()
        
        # Go back
        await ws.send(json.dumps({'id':2,'method':'Runtime.evaluate','params':{'expression':'window.history.back(); setTimeout(()=>window.location.href=\"/orders\",500)'}}))
        await asyncio.sleep(3)
        
        # Navigate directly
        await ws.send(json.dumps({'id':3,'method':'Page.navigate','params':{'url':'http://localhost:3000/orders'}}))
        resp = json.loads(await ws.recv())
        print('Navigate:', resp.get('result',{}).get('url','unk'))
        await asyncio.sleep(2)
        
        # Check URL
        await ws.send(json.dumps({'id':4,'method':'Runtime.evaluate','params':{'expression':'window.location.href'}}))
        resp = json.loads(await ws.recv())
        print('URL:', resp.get('result',{}).get('result',{}).get('value',''))
        
        # Get page text
        await ws.send(json.dumps({'id':5,'method':'Runtime.evaluate','params':{'expression':'document.body?.innerText?.substring(0,300)'}}))
        resp = json.loads(await ws.recv())
        print('Text:', resp.get('result',{}).get('result',{}).get('value',''))

asyncio.get_event_loop().run_until_complete(main())
