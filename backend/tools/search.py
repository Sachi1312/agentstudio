from duckduckgo_search import DDGS
import wikipedia

def duckduckgo_search(query: str) -> str:
    with DDGS() as ddgs:
        results = ddgs.text(query, max_results=5)
        if not results:
            return "No results found."
        output = ""
        for r in results:
            output += f"Title: {r['title']}\n"
            output += f"Summary: {r['body']}\n"
            output += f"URL: {r['href']}\n\n"
        return output

def wikipedia_search(query: str) -> str:
    try:
        result = wikipedia.summary(query, sentences=5)
        return result
    except Exception as e:
        return f"Wikipedia search failed: {str(e)}"