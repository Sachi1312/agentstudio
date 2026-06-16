from langchain_google_genai import ChatGoogleGenerativeAI
from backend.state import AgentState
from backend.tools.search import duckduckgo_search
from dotenv import load_dotenv

load_dotenv()

llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")

def researcher_agent(state: AgentState) -> AgentState:
    topic = state["topic"]
    
    search_results = duckduckgo_search(topic)
    
    prompt = f"""
    You are a research agent. Your job is to analyze raw search results and extract the most useful and relevant information about the topic.
    
    Topic: {topic}
    
    Raw search results:
    {search_results}
    
    Extract and organize the key facts, statistics, arguments and sources from these results. Be thorough.
    """
    
    response = llm.invoke(prompt)
    
    return {"search_results": response.content}