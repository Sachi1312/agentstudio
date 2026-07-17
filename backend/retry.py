import time
import functools

def with_retry(attempts=3, base_delay=1.5, exceptions=(Exception,)):
    """Retry a sync function with exponential backoff.

    Agent nodes make network calls (LLM completions, DuckDuckGo, Wikipedia)
    that can fail transiently — a rate limit, a dropped connection, a
    momentary DNS blip. Without this, one bad network moment kills the
    entire run and dumps a raw traceback to the user (as seen with the
    SSL/APIConnectionError failures during setup). Retries the call up to
    `attempts` times before giving up and re-raising the last error.
    """
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(attempts):
                try:
                    return fn(*args, **kwargs)
                except exceptions as e:
                    last_error = e
                    if attempt < attempts - 1:
                        time.sleep(base_delay * (2 ** attempt))
            raise last_error
        return wrapper
    return decorator
