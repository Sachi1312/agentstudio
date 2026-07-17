from langchain_openai import ChatOpenAI
from backend.state import AgentState
from backend.tools.search import duckduckgo_search, arxiv_search
from backend.llm_utils import invoke_llm
from backend.retry import with_retry
import os
from dotenv import load_dotenv

load_dotenv()

llm = ChatOpenAI(model="openrouter/auto", openai_api_key=os.getenv("OPENROUTER_API_KEY"), openai_api_base="https://openrouter.ai/api/v1")

def researcher_agent(state: AgentState) -> AgentState:
    topic = state["topic"]

    search_results = with_retry()(duckduckgo_search)(topic)
    arxiv_results = arxiv_search(topic)

    prompt = f"""
    You are a research agent. Your job is to analyze raw search results and extract the most useful and relevant information about the topic.

    Topic: {topic}

    Raw web search results:
    {search_results}

    Related academic papers (arXiv — may be empty or irrelevant if this topic isn't a technical/scientific one, in which case ignore this section):
    {arxiv_results or "(none found)"}

    Extract and organize the key facts, statistics, arguments and sources from these results. Be thorough.
    """

    content, tokens, cost = invoke_llm(llm, prompt)

    return {"search_results": content, "tokens_used": tokens, "cost_usd": cost}
