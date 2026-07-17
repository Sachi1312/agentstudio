from langchain_openai import ChatOpenAI
from backend.state import AgentState
from backend.llm_utils import invoke_llm
import os
from dotenv import load_dotenv

load_dotenv()

llm = ChatOpenAI(model="openrouter/auto", openai_api_key=os.getenv("OPENROUTER_API_KEY"), openai_api_base="https://openrouter.ai/api/v1", request_timeout=60)

def critic_agent(state: AgentState) -> AgentState:
    topic = state["topic"]
    draft = state["draft"]

    prompt = f"""
    You are a strict but fair critic agent. Your job is to evaluate an article draft and give honest feedback.

    Topic: {topic}

    Article draft:
    {draft}

    Evaluate the article on these criteria:
    - Structure and flow
    - Accuracy and depth of information
    - Balance of perspectives
    - Clarity and readability
    - Strength of opening and conclusion

    Respond in exactly this format and nothing else:

    SCORE: [a single number between 1 and 10]
    FEEDBACK: [your detailed feedback in 3 to 5 sentences]
    """

    content, tokens, cost = invoke_llm(llm, prompt)

    lines = content.strip().split("\n")
    score = 7
    feedback = ""

    for line in lines:
        if line.startswith("SCORE:"):
            try:
                score = int(line.replace("SCORE:", "").strip())
            except:
                score = 7
        if line.startswith("FEEDBACK:"):
            feedback = line.replace("FEEDBACK:", "").strip()

    return {
        "score": score,
        "critique": feedback,
        "tokens_used": tokens,
        "cost_usd": cost
    }
