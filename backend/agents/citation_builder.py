from langchain_openai import ChatOpenAI
from backend.state import AgentState
from backend.llm_utils import invoke_llm
import os
from dotenv import load_dotenv

load_dotenv()

llm = ChatOpenAI(model="openrouter/auto", openai_api_key=os.getenv("OPENROUTER_API_KEY"), openai_api_base="https://openrouter.ai/api/v1")

def citation_builder_agent(state: AgentState) -> AgentState:
    topic = state["topic"]
    draft = state["draft"]
    search_results = state["search_results"]
    fact_check = state["fact_check"]

    prompt = f"""
    You are a citation builder agent. Your job is to identify all sources used in an article and format them properly.

    Topic: {topic}

    Article draft:
    {draft}

    Research used:
    {search_results}

    Fact check references:
    {fact_check}

    Extract all sources referenced across the article and research and format them as clean citations.

    Respond in exactly this format for each source:

    SOURCE 1:
    TITLE: [title of the source]
    PUBLISHER: [publisher or website name]
    TYPE: [Web Article / Wikipedia / Research Report / News]
    URL: [url if available, otherwise write N/A]

    SOURCE 2:
    TITLE: [title of the source]
    PUBLISHER: [publisher or website name]
    TYPE: [Web Article / Wikipedia / Research Report / News]
    URL: [url if available, otherwise write N/A]

    and so on. List every source you can identify.
    """

    content, tokens, cost = invoke_llm(llm, prompt)

    return {"citations": content, "tokens_used": tokens, "cost_usd": cost}
