"""Cache-then-crawl live query pipeline.

Every query embeds the request text and checks the local vector store
first. Enough good matches -> answer instantly from what's already been
ingested. Not enough -> run a live Tavily search, extract + score new
founders via OpenAI, write them into the vector store and live store, then
answer — so the same or a similar query next time is instant.
"""
from __future__ import annotations

import asyncio
import logging

from backend.models.schemas import Candidate, Founder, ParsedQuery, QueryResponse, TeamMember
from backend.services import live_store, openai_client, tavily_client, vector_store
from backend.services.demo_store import get_store

logger = logging.getLogger("synapse.live_query")

# How many team members (missing contacts) to run a dedicated contact search
# for, per founder. Bounded so a 14-person roster can't blow up latency/cost.
MAX_CONTACT_LOOKUPS = 5

# Cosine similarity floor for treating a new query as "the same ask" as a
# past one. This compares query text to query text (symmetric), not query
# to founder-profile text (asymmetric — a question and a description never
# score as similar as you'd expect, even for a verbatim repeat).
QUERY_CACHE_THRESHOLD = 0.90


def _candidates_from_ids(ls: live_store.LiveStore, founder_ids: list[str], relevance: float) -> list[Candidate]:
    candidates = []
    for fid in founder_ids:
        founder = ls.get_founder(fid)
        fit = ls.get_fit(fid)
        if not founder or not fit:
            continue
        candidates.append(Candidate(founder=founder, relevance=relevance, fit=fit, matched_terms=[], graph_context=[]))
    return candidates


async def _enrich(founder: Founder) -> Founder:
    """Second, targeted pass per founder: the broad discovery search is
    hit-or-miss on team rosters, contacts, stats, and images, so a search
    aimed at this specific person/project fills the gaps far more reliably."""
    try:
        data = await tavily_client.search(
            f"{founder.name} {founder.project} founders team contact", max_results=5
        )
    except Exception:
        logger.warning("Enrichment search failed for %r", founder.name, exc_info=True)
        return founder
    return await openai_client.enrich_founder(founder, data)


async def _member_contact(founder: Founder, member: TeamMember) -> None:
    """Targeted contact search for a single team member — fills in their own
    linkedin/email/website when the founder-level enrichment left them blank."""
    context = f"{founder.project} ({founder.name}) — {founder.headline}"
    role = member.role or "founder"
    try:
        data = await tavily_client.search(
            f"{member.name} {role} {founder.project} linkedin twitter github crunchbase", max_results=6
        )
    except Exception:
        logger.warning("Contact search failed for %r", member.name, exc_info=True)
        return
    links = await openai_client.find_member_links(member.name, context, data)
    if links:
        member.links = {**links, **member.links}  # keep anything already found


async def _enrich_member_contacts(founder: Founder) -> Founder:
    """Every team member should have at least one way to reach them. Members
    still missing contacts after enrichment get their own lookup, run in
    parallel and capped so a large roster stays fast. Anyone still without a
    personal link falls back to the company website — a real outreach path,
    never a dead end."""
    targets = [m for m in founder.team if not m.links][:MAX_CONTACT_LOOKUPS]
    if targets:
        await asyncio.gather(*(_member_contact(founder, m) for m in targets))

    # Honest fallback labels: the company site as "website", or the company
    # page as "company" — never dressed up as the person's own profile.
    if founder.links.get("website"):
        fallback = {"website": founder.links["website"]}
    elif founder.links.get("linkedin"):
        fallback = {"company": founder.links["linkedin"]}
    else:
        fallback = None
    if fallback:
        for member in founder.team:
            if not member.links:
                member.links = dict(fallback)
    return founder


# Always aim to surface at least this many candidates when the topic
# supports it — a single result reads as a broken search.
MIN_RESULTS = 3


async def run(query_text: str, limit: int) -> QueryResponse:
    ls = live_store.get_live_store()
    profile = get_store().profile  # VC profile stays demo-seeded regardless of mode
    target = max(limit, MIN_RESULTS)

    query_embedding = await openai_client.embed(query_text)

    # Fast path: the vector DB exists ONLY to short-circuit a repeat/near-
    # duplicate ask. Any genuinely new prompt falls through to a fresh search.
    cached_ids = vector_store.lookup_similar_query(query_embedding, threshold=QUERY_CACHE_THRESHOLD)
    if cached_ids:
        candidates = _candidates_from_ids(ls, cached_ids[:target], relevance=0.95)
        if candidates:
            logger.info("Query cache hit for %r — %d founder(s), no live search needed", query_text, len(candidates))
            ls.set_current_result([c.founder.id for c in candidates])
            return QueryResponse(
                parsed=ParsedQuery(free_text=query_text), candidates=candidates, took_ms=0.0, mode="live"
            )

    logger.info("Query cache miss for %r — running a live Tavily search", query_text)
    tavily_data = await tavily_client.search(query_text, max_results=15)
    extracted = await openai_client.extract_founders(query_text, tavily_data, profile, max_results=target)

    # One broadened retry if the first pass under-delivered, so we hit the
    # minimum without fabricating anyone.
    if len(extracted) < MIN_RESULTS:
        logger.info("Only %d founder(s) on first pass — broadening the search", len(extracted))
        more_data = await tavily_client.search(f"{query_text} startups founders projects", max_results=20)
        more = await openai_client.extract_founders(query_text, more_data, profile, max_results=target)
        seen = {f.id for f, _ in extracted}
        for founder, fit in more:
            if founder.id not in seen:
                extracted.append((founder, fit))
                seen.add(founder.id)

    founder_ids: list[str] = []
    for founder, fit in extracted[:target]:
        founder = await _enrich(founder)
        founder = await _enrich_member_contacts(founder)
        doc = openai_client.founder_document(founder)
        embedding = await openai_client.embed(doc)
        vector_store.upsert(founder.id, embedding, doc)
        ls.upsert(founder, fit)
        founder_ids.append(founder.id)

    vector_store.cache_query(query_text, query_embedding, founder_ids)
    ls.set_current_result(founder_ids)

    return QueryResponse(
        parsed=ParsedQuery(free_text=query_text),
        candidates=_candidates_from_ids(ls, founder_ids, relevance=0.95),
        took_ms=0.0,  # overwritten by the caller with real elapsed time
        mode="live",
    )
