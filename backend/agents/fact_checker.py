from langchain_openai import ChatOpenAI
from backend.state import AgentState
from backend.tools.search import wikipedia_search
from backend.llm_utils import invoke_llm
import os
from dotenv import load_dotenv

load_dotenv()

llm = ChatOpenAI(model="openrouter/auto", openai_api_key=os.getenv("OPENROUTER_API_KEY"), openai_api_base="https://openrouter.ai/api/v1")

def fact_checker_agent(state: AgentState) -> AgentState:
    topic = state["topic"]
    draft = state["draft"]

    wiki_result = wikipedia_search(topic)

    prompt = f"""
    You are a fact checking agent. Your job is to verify the claims made in an article against reliable information.

    Topic: {topic}

    Article draft:
    {draft}

    Wikipedia reference:
    {wiki_result}

    Go through the article and:
    - Identify 3 to 5 specific claims made in the article
    - Check each claim against the Wikipedia reference
    - Mark each claim as VERIFIED, UNVERIFIED, or INCORRECT
    - If incorrect, briefly state what the correct information is

    Respond in this format:

    CLAIM 1: [the claim]
    STATUS: [VERIFIED / UNVERIFIED / INCORRECT]
    NOTE: [brief note if needed]

    CLAIM 2: [the claim]
    STATUS: [VERIFIED / UNVERIFIED / INCORRECT]
    NOTE: [brief note if needed]

    and so on.
    """

    content, tokens, cost = invoke_llm(llm, prompt)

    return {"fact_check": content, "tokens_used": tokens, "cost_usd": cost}
