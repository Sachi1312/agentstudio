from ddgs import DDGS
import requests
import time
import xml.etree.ElementTree as ET

WIKI_HEADERS = {"User-Agent": "agentstudio/1.0 (research assistant)"}
WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI_REST_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/{}"
ARXIV_API = "http://export.arxiv.org/api/query"
ARXIV_NS = {"atom": "http://www.w3.org/2005/Atom"}

def duckduckgo_search(query: str) -> str:
    with DDGS(timeout=15) as ddgs:
        results = ddgs.text(query, max_results=5)
        if not results:
            return "No results found."
        output = ""
        for r in results:
            output += f"Title: {r['title']}\n"
            output += f"Summary: {r['body']}\n"
            output += f"URL: {r['href']}\n\n"
        return output

def arxiv_search(query: str, max_results: int = 3) -> str:
    # Keyless — no API key/signup needed, unlike most academic/news APIs.
    # DuckDuckGo/Wikipedia skew toward general-web and encyclopedic content;
    # this adds a source that's actually useful for technical/scientific
    # topics. Returns "" (not an error string) for non-matching topics so
    # callers can cleanly omit an empty section rather than showing a
    # placeholder that reads like a real absence-of-results claim.
    try:
        r = requests.get(
            ARXIV_API,
            params={"search_query": f"all:{query}", "start": 0, "max_results": max_results},
            timeout=10,
        )
    except requests.RequestException:
        return ""

    if r.status_code != 200:
        return ""

    try:
        root = ET.fromstring(r.text)
    except ET.ParseError:
        return ""

    entries = root.findall("atom:entry", ARXIV_NS)
    if not entries:
        return ""

    output = ""
    for entry in entries:
        title_el = entry.find("atom:title", ARXIV_NS)
        summary_el = entry.find("atom:summary", ARXIV_NS)
        link_el = entry.find("atom:id", ARXIV_NS)
        title = (title_el.text or "").strip() if title_el is not None else ""
        summary = (summary_el.text or "").strip() if summary_el is not None else ""
        link = (link_el.text or "").strip() if link_el is not None else ""
        if not title:
            continue
        output += f"Title: {title}\n"
        output += f"Summary: {summary[:400]}\n"
        output += f"URL: {link}\n\n"
    return output

def wikipedia_search(query: str, retries: int = 2) -> str:
    # The `wikipedia` PyPI package is unmaintained and its internal requests
    # fail unpredictably (crashing into JSONDecodeError on rate limits or
    # empty responses). Talk to Wikipedia's own APIs directly instead:
    # resolve the best matching title via search, then fetch its summary
    # from the REST API, checking status codes at every step.
    for attempt in range(retries + 1):
        try:
            search_resp = requests.get(
                WIKI_API,
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "srlimit": 1,
                    "format": "json",
                },
                headers=WIKI_HEADERS,
                timeout=10,
            )
        except requests.RequestException as e:
            return f"[Wikipedia unavailable: {e}]"

        if search_resp.status_code == 429:
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            return "[Wikipedia rate-limited: no reference data available for this run]"

        if search_resp.status_code != 200:
            return f"[Wikipedia unavailable: HTTP {search_resp.status_code}]"

        hits = search_resp.json().get("query", {}).get("search", [])
        if not hits:
            return "[No Wikipedia page found for this topic]"
        title = hits[0]["title"]

        try:
            summary_resp = requests.get(
                WIKI_REST_SUMMARY.format(requests.utils.quote(title)),
                headers=WIKI_HEADERS,
                timeout=10,
            )
        except requests.RequestException as e:
            return f"[Wikipedia unavailable: {e}]"

        if summary_resp.status_code == 429:
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            return "[Wikipedia rate-limited: no reference data available for this run]"

        if summary_resp.status_code != 200:
            return f"[Wikipedia unavailable: HTTP {summary_resp.status_code}]"

        extract = summary_resp.json().get("extract", "")
        return extract or "[Wikipedia page has no summary text]"

    return "[Wikipedia lookup failed]"
