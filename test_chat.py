import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        res = await client.post("http://localhost:8000/chat", json={"message": "how do credit cards work?"})
        print(res.status_code)

asyncio.run(main())
