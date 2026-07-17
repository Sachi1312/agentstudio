from langchain_openai import ChatOpenAI
from backend.state import AgentState
from backend.llm_utils import invoke_llm
import os
from dotenv import load_dotenv

load_dotenv()

llm = ChatOpenAI(model="openrouter/auto", openai_api_key=os.getenv("OPENROUTER_API_KEY"), openai_api_base="https://openrouter.ai/api/v1", request_timeout=60)

def summarizer_agent(state: AgentState) -> AgentState:
    topic = state["topic"]
    search_results = state["search_results"]

    prompt = f"""
    You are a summarizer agent. Your job is to condense research into clean, concise key points.

    Topic: {topic}

    Research:
    {search_results}

    Create a structured summary with:
    - 5 to 7 key points
    - Important statistics or data mentioned
    - Main arguments from different perspectives
    - Key sources referenced

    Keep it concise but information-dense. The Writer agent will use this summary to write an article.
    """

    content, tokens, cost = invoke_llm(llm, prompt)

    return {"summary": content, "tokens_used": tokens, "cost_usd": cost}
