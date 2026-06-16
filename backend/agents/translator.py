from langchain_google_genai import ChatGoogleGenerativeAI
from backend.state import AgentState
from dotenv import load_dotenv

load_dotenv()

llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")

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
    
    response = llm.invoke(prompt)
    
    return {"final_output": response.content}