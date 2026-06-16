from langchain_google_genai import ChatGoogleGenerativeAI
from backend.state import AgentState
from dotenv import load_dotenv

load_dotenv()

llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")

def bias_detector_agent(state: AgentState) -> AgentState:
    topic = state["topic"]
    draft = state["draft"]
    
    prompt = f"""
    You are a bias detection agent. Your job is to analyze an article for any signs of bias or one-sided presentation.
    
    Topic: {topic}
    
    Article draft:
    {draft}
    
    Analyze the article for:
    - Tone bias (overly positive or negative framing)
    - Perspective bias (only one side of the argument presented)
    - Language bias (loaded or emotional words)
    - Source bias (over reliance on one type of source)
    
    Respond in exactly this format:
    
    OVERALL: [Unbiased / Slightly Biased / Biased]
    
    TONE: [one sentence assessment]
    PERSPECTIVE: [one sentence assessment]
    LANGUAGE: [one sentence assessment]
    SOURCES: [one sentence assessment]
    
    SUMMARY: [2 sentence overall summary of bias findings]
    """
    
    response = llm.invoke(prompt)
    
    return {"bias_report": response.content}