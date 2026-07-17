from langchain_openai import ChatOpenAI
from backend.state import AgentState
from backend.llm_utils import invoke_llm
import os
from dotenv import load_dotenv

load_dotenv()

llm = ChatOpenAI(model="openrouter/auto", openai_api_key=os.getenv("OPENROUTER_API_KEY"), openai_api_base="https://openrouter.ai/api/v1", request_timeout=60)

def translator_agent(state: AgentState) -> AgentState:
    draft = state["draft"]
    language = state.get("language", "English")

    if language.lower() == "english":
        return {"final_output": draft}

    prompt = f"""
    You are a translation agent. Your job is to translate an article into another language while preserving its meaning, tone and structure perfectly.

    Target language: {language}

    Article:
    {draft}

    Translate the entire article into {language}. Keep the same structure, paragraphs and formatting. Only translate the text — do not add or remove any content.
    """

    content, tokens, cost = invoke_llm(llm, prompt)

    return {"final_output": content, "tokens_used": tokens, "cost_usd": cost}
