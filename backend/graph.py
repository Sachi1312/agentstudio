from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from backend.state import AgentState
from backend.agents.researcher import researcher_agent
from backend.agents.summarizer import summarizer_agent
from backend.agents.writer import writer_agent
from backend.agents.critic import critic_agent
from backend.agents.fact_checker import fact_checker_agent
from backend.agents.bias_detector import bias_detector_agent
from backend.agents.citation_builder import citation_builder_agent
from backend.agents.translator import translator_agent

def should_revise(state: AgentState) -> str:
    score = state.get("score", 0)
    revision_count = state.get("revision_count", 0)
    
    if score < 7 and revision_count < 3:
        return "revise"
    return "continue"

def build_graph():
    graph = StateGraph(AgentState)
    
    graph.add_node("researcher", researcher_agent)
    graph.add_node("summarizer", summarizer_agent)
    graph.add_node("writer", writer_agent)
    graph.add_node("critic", critic_agent)
    graph.add_node("fact_checker", fact_checker_agent)
    graph.add_node("bias_detector", bias_detector_agent)
    graph.add_node("citation_builder", citation_builder_agent)
    graph.add_node("translator", translator_agent)
    
    graph.set_entry_point("researcher")
    
    graph.add_edge("researcher", "summarizer")
    graph.add_edge("summarizer", "writer")
    graph.add_edge("writer", "critic")
    graph.add_edge("fact_checker", "bias_detector")
    graph.add_edge("bias_detector", "citation_builder")
    graph.add_edge("citation_builder", "translator")
    graph.add_edge("translator", END)
    
    graph.add_conditional_edges(
        "critic",
        should_revise,
        {
            "revise": "writer",
            "continue": "fact_checker"
        }
    )
    
    memory = MemorySaver()
    return graph.compile(
        checkpointer=memory,
        interrupt_before=["critic"]
    )

agent_graph = build_graph()