from langchain_google_genai import ChatGoogleGenerativeAI
from backend.state import AgentState
from dotenv import load_dotenv

load_dotenv()

llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")

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
    
    response = llm.invoke(prompt)
    content = response.content
    
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
        "critique": feedback
    }