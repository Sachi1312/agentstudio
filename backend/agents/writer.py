from langchain_openai import ChatOpenAI
from langchain_core.runnables import RunnableConfig
from backend.state import AgentState
from backend.retry import with_retry
from backend import broadcast
import os
from dotenv import load_dotenv

load_dotenv()

llm = ChatOpenAI(
    model="openrouter/auto",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    openai_api_base="https://openrouter.ai/api/v1",
    stream_usage=True,
)

_PREAMBLE_STARTS = ("here's", "here is", "below is", "sure,", "certainly", "i've revised", "this is a revised", "of course")

def _strip_preamble(text: str) -> str:
    # Prompt instructions don't guarantee compliance — the model sometimes
    # still leads with a conversational line like "Here's a revised version
    # of your article..." before the real headline, which then gets read as
    # the title everywhere downstream. Drop an obvious lead-in line if
    # present; leave the text untouched otherwise.
    lines = text.strip().split("\n")
    first = lines[0].strip().lower()
    if first.endswith(":") or first.startswith(_PREAMBLE_STARTS):
        return "\n".join(lines[1:]).strip()
    return text.strip()

def writer_agent(state: AgentState, config: RunnableConfig) -> AgentState:
    topic = state["topic"]
    summary = state["summary"]
    critique = state.get("critique", "")
    revision_count = state.get("revision_count", 0)
    thread_id = config.get("configurable", {}).get("thread_id")

    style_guidance = """
        Write like a knowledgeable person explaining this to someone smart but
        unfamiliar with it — not like an AI-generated summary. Concretely:
        - Vary sentence length. Mix short, punchy sentences with longer ones.
          Don't fall into a steady rhythm of same-length sentences.
        - Vary how paragraphs open. Don't start every paragraph with the same
          kind of clause or transition word.
        - Avoid AI-tell phrases: "in today's fast-paced world", "it's
          important to note that", "in conclusion", "moreover", "furthermore",
          "delve into", "underscores", "landscape" (as in "the X landscape"),
          "tapestry", "testament to". Avoid em-dashes as a crutch for nearly
          every sentence.
        - Avoid mechanical rule-of-three lists ("X, Y, and Z") as a go-to
          sentence structure — use them occasionally, not as a pattern.
        - Prefer concrete specifics (numbers, examples, named things) over
          vague generalities.
        - It's fine to have a point of view. Flat neutrality reads as robotic.
        """

    if revision_count == 0:
        prompt = f"""
        You are a professional writer. Write a well structured, engaging, in-depth article based on the research summary below.

        Topic: {topic}

        Research Summary:
        {summary}

        Write a full article with:
        - A compelling headline
        - A strong opening paragraph
        - 7 to 9 body paragraphs covering different angles in real depth — not
          a shallow overview. Aim for roughly 1,400-1,800 words total.
        - A conclusion

        {style_guidance}

        Output ONLY the article itself, starting directly with the headline.
        Do not include any preamble, meta-commentary, or explanation of what
        you did (e.g. no "Here's an article about...").
        """
    else:
        prompt = f"""
        You are a professional writer. You are revising your article based on critic feedback.

        Topic: {topic}

        Your previous draft:
        {state.get("draft", "")}

        Critic feedback:
        {critique}

        Rewrite the article addressing all the feedback. Improve the weak areas while keeping what worked well.
        Keep it a full-length, in-depth piece — roughly 1,400-1,800 words, not a summary.

        {style_guidance}

        Output ONLY the rewritten article itself, starting directly with the
        headline. Do not include any preamble, meta-commentary, or
        explanation of what you changed (e.g. no "Here's a revised version
        of your article...").
        """

    # Streamed so the frontend can show the article being written token by
    # token instead of waiting for the whole thing at once. Cost isn't
    # available on streamed responses the way it is on non-streamed ones
    # (OpenRouter only reports it on the full response), so this node's
    # contribution to a run's total cost_usd is undercounted by whatever
    # this call cost — token count stays accurate via usage_metadata either
    # way.
    def stream_call():
        full = None
        for chunk in llm.stream(prompt):
            if chunk.content:
                broadcast.emit(thread_id, chunk.content)
            full = chunk if full is None else full + chunk
        return full

    response = with_retry()(stream_call)()
    tokens = (response.usage_metadata or {}).get("total_tokens", 0) or 0

    return {
        "draft": _strip_preamble(response.content),
        "revision_count": revision_count + 1,
        "tokens_used": tokens,
        "cost_usd": 0.0
    }
