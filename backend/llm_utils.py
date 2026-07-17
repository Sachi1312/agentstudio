from backend.retry import with_retry

def invoke_llm(llm, prompt):
    """Invoke an LLM with retry, returning (content, tokens_used, cost_usd).

    OpenRouter reports actual USD cost per call in response_metadata (it
    knows the real per-model price even though this app requests
    "openrouter/auto" and doesn't know which model actually served the
    request). Falls back to 0 if a field is missing rather than raising —
    usage tracking should never break the agent pipeline.
    """
    invoke = with_retry()(llm.invoke)
    response = invoke(prompt)
    usage = (response.response_metadata or {}).get("token_usage", {}) or {}
    tokens = usage.get("total_tokens", 0) or 0
    cost = usage.get("cost", 0) or 0
    return response.content, tokens, cost
