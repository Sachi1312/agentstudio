from typing import TypedDict, Optional, Annotated
import operator

class AgentState(TypedDict):
    topic: str
    language: str
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
    # Annotated with operator.add so each agent's per-call usage accumulates
    # across the whole run (including revision loops) instead of the last
    # node's number overwriting everyone else's.
    tokens_used: Annotated[int, operator.add]
    cost_usd: Annotated[float, operator.add]