from typing import TypedDict, Optional

class AgentState(TypedDict):
    topic: str
    search_results: str
    summary: str
    draft: str
    critique: str
    score: int
    fact_check: str
    bias_report: str
    citations: str
    final_output: str
    revision_count: int
    human_approved: bool