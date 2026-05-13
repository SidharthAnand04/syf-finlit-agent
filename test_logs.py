import asyncio
import sys
sys.path.insert(0, "backend/src")
from supabase_client import rest_get
from dotenv import load_dotenv

load_dotenv(".env")

async def main():
    rows = await rest_get("chat_logs")
    print("Found", len(rows), "rows")

asyncio.run(main())
