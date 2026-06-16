from langchain_google_genai import ChatGoogleGenerativeAI
from backend.state import AgentState
from dotenv import load_dotenv

load_dotenv()

llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")

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
    
    response = llm.invoke(prompt)
    
    return {"summary": response.content}