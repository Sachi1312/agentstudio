from langchain_google_genai import ChatGoogleGenerativeAI
from backend.state import AgentState
from dotenv import load_dotenv

load_dotenv()

llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")

def writer_agent(state: AgentState) -> AgentState:
    topic = state["topic"]
    summary = state["summary"]
    critique = state.get("critique", "")
    revision_count = state.get("revision_count", 0)
    
    if revision_count == 0:
        prompt = f"""
        You are a professional writer. Write a well structured, engaging article based on the research summary below.
        
        Topic: {topic}
        
        Research Summary:
        {summary}
        
        Write a full article with:
        - A compelling headline
        - A strong opening paragraph
        - 3 to 4 body paragraphs covering different angles
        - A conclusion
        
        Write in a clear, intelligent tone. No fluff.
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
        """
    
    response = llm.invoke(prompt)
    
    return {
        "draft": response.content,
        "revision_count": revision_count + 1
    }