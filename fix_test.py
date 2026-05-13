import asyncio
from httpx import AsyncClient

async def main():
    async with AsyncClient() as client:
        res = await client.post("http://localhost:8000/chat", json={"message": "test msg"})
        print("Response:", res.text)
asyncio.run(main())
