from backend.graph import should_revise

def test_low_score_under_revision_cap_routes_to_revise():
    assert should_revise({"score": 4, "revision_count": 1}) == "revise"

def test_high_score_routes_to_continue():
    assert should_revise({"score": 8, "revision_count": 0}) == "continue"

def test_low_score_but_revision_cap_hit_routes_to_continue():
    # Caps the writer<->critic loop at 3 passes regardless of score, so a
    # stubborn low score can't loop forever.
    assert should_revise({"score": 2, "revision_count": 3}) == "continue"

def test_missing_keys_default_to_revise():
    # A brand new run has no score/revision_count yet; should_revise must
    # not crash on a bare/partial state.
    assert should_revise({}) == "revise"

def test_boundary_score_of_seven_is_passing():
    assert should_revise({"score": 7, "revision_count": 0}) == "continue"
