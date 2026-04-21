import sys
import os
import asyncio
from dotenv import load_dotenv

# Load env before importing db models
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

import seed_db

if __name__ == '__main__':
    asyncio.run(seed_db.seed())
