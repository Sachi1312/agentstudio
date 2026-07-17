# The /reject endpoint relies on a specific LangGraph mechanic: writing a
# state update with as_node="critic" while the graph is paused *before*
# critic makes the conditional edge route as if critic had produced that
# output, without actually invoking critic_agent (and therefore without
# critic's own LLM call overwriting the human's rejection feedback). This
# test proves that mechanic in isolation, independent of the real LLM-backed
# agents, so a LangGraph upgrade that changes this behavior fails loudly
# here instead of silently breaking the reject flow in production.
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

class _S(TypedDict):
    score: int
    critique: str
    calls: int

def _build_test_graph():
    def writer(state):
        return {"calls": state.get("calls", 0) + 1}

    def critic(state):
        # If this ever runs during a reject-then-resume, it would overwrite
        # the human's feedback with its own — exactly the bug being guarded
        # against. Marking that it ran lets the test assert it didn't.
        return {"score": 9, "critique": "critic ran and overwrote feedback"}

    def route(state):
        return "revise" if state.get("score", 0) < 7 else "continue"

    g = StateGraph(_S)
    g.add_node("writer", writer)
    g.add_node("critic", critic)
    g.set_entry_point("writer")
    g.add_edge("writer", "critic")
    g.add_conditional_edges("critic", route, {"revise": "writer", "continue": END})
    return g.compile(checkpointer=MemorySaver(), interrupt_before=["critic"])

def test_as_node_update_bypasses_critic_and_preserves_feedback():
    graph = _build_test_graph()
    config = {"configurable": {"thread_id": "test-thread"}}

    list(graph.stream({"score": 0, "critique": "", "calls": 0}, config))
    assert graph.get_state(config).next == ("critic",)

    human_feedback = "make it shorter"
    graph.update_state(config, {"critique": human_feedback, "score": 0}, as_node="critic")
    list(graph.stream(None, config))

    final = graph.get_state(config).values
    assert final["critique"] == human_feedback
    assert final["calls"] == 2  # writer ran again, routed straight past critic
