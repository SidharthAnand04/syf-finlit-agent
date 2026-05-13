import asyncio
import sys
sys.path.insert(0, "backend/src")
from supabase_client import log_interaction
from dotenv import load_dotenv

load_dotenv(".env")

async def main():
    await log_interaction(
        session_id="test",
        user_message="hello",
        answer="hi",
        question_type="informational",
        citations=[],
        followups=[],
        chunks_retrieved=0,
        response_time_ms=100,
        is_followup=False
    )
    print("Done!")

asyncio.run(main())
