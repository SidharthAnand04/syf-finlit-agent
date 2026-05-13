import json
import asyncio
from sqlalchemy import text
from src.db import get_session
import time

async def seed():
    # Read the JSON file
    with open('../kb/url_sources.json', 'r') as f:
        sources_data = json.load(f)
    print(f"Loaded {len(sources_data)} sources from JSON")

    # Insert into database
    async with get_session() as session:
        for source in sources_data:
            await session.execute(
                text("INSERT INTO sources (id, type, name, url, tags, enabled) VALUES (:id, 'url', :name, :url, :tags, 1)"),
                {
                    "id": int(time.time() * 1000) % 1000000000,
                    "name": source["name"],
                    "url": source["url"],
                    "tags": json.dumps({"description": source["description"]})
                }
            )
            time.sleep(0.01)
        await session.commit()
        print("Successfully seeded the database!")

if __name__ == "__main__":
    asyncio.run(seed())
