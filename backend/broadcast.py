_broadcasters = {}

def register(thread_id, fn):
    """fn is called with each text chunk from the worker thread."""
    _broadcasters[thread_id] = fn

def unregister(thread_id):
    _broadcasters.pop(thread_id, None)

def emit(thread_id, text):
    fn = _broadcasters.get(thread_id)
    if fn:
        fn(text)
