"""Inspect persisted AI insight reports without printing secrets."""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
BACKEND_SRC = ROOT / "backend" / "src"
sys.path.insert(0, str(BACKEND_SRC))

load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.local")

from supabase_client import rest_get  # noqa: E402


def _shape(value: Any) -> str:
    if isinstance(value, dict):
        keys = ", ".join(list(value.keys())[:12])
        return f"dict keys=[{keys}]"
    if isinstance(value, list):
        return f"list len={len(value)}"
    if isinstance(value, str):
        preview = value[:160].replace("\n", "\\n")
        return f"str len={len(value)} preview={preview!r}"
    return type(value).__name__


async def main() -> None:
    rows = await rest_get(
        "ai_insight_reports",
        {
            "select": (
                "id,created_at,status,health_score,executive_summary,"
                "main_problem,top_action,metadata,report"
            ),
            "order": "created_at.desc",
            "limit": "5",
        },
    )
    print(f"reports={len(rows)}")
    for index, row in enumerate(rows, 1):
        report = row.get("report")
        print(f"\n[{index}] id={row.get('id')} created_at={row.get('created_at')} status={row.get('status')}")
        print(f"summary health_score={row.get('health_score')} main_problem={row.get('main_problem')!r}")
        print(f"report_shape={_shape(report)}")
        if isinstance(report, str):
            try:
                parsed = json.loads(report)
            except json.JSONDecodeError as exc:
                print(f"string_json_parse=failed line={exc.lineno} col={exc.colno} msg={exc.msg}")
            else:
                print(f"string_json_parse=ok parsed_shape={_shape(parsed)}")
                report = parsed
        if isinstance(report, dict):
            raw = report.get("_raw")
            print(f"has_raw_parse_fallback={bool(raw)}")
            if raw:
                print(f"raw_preview={str(raw)[:240].replace(os.linesep, ' ')}")
            for key in (
                "executiveSummary",
                "executive_summary",
                "health",
                "priorityFixes",
                "questionThemes",
                "topic_clusters",
                "contentGaps",
                "content_gaps",
                "riskComplianceSignals",
                "sourceRecommendations",
                "retrievalDiagnostics",
                "quick_wins",
            ):
                print(f"{key}: {_shape(report.get(key))}")


if __name__ == "__main__":
    asyncio.run(main())
