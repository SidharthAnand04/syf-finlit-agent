import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        res = await client.post("http://localhost:8000/chat", json={
            "message": "how do credit cards work? part 2",
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "markdown": True
        })
        print(res.status_code)
        print(res.text)

asyncio.run(main())
