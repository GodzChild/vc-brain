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

import httpx

from backend.models.schemas import Candidate, Evidence, Founder, ParsedQuery, QueryResponse, TeamMember
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


def _candidates_from_ids(ls: live_store.LiveStore, founder_ids: list[str]) -> list[Candidate]:
    candidates = []
    for fid in founder_ids:
        founder = ls.get_founder(fid)
        fit = ls.get_fit(fid)
        if not founder or not fit:
            continue
        candidates.append(
            Candidate(
                founder=founder,
                relevance=round(fit.fit_score / 100, 3),
                fit=fit,
                matched_terms=[],
                graph_context=[],
            )
        )
    candidates.sort(key=lambda c: c.fit.fit_score, reverse=True)
    return candidates


async def _enrich(founder: Founder, thesis: str) -> Founder:
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
    return await openai_client.enrich_founder(founder, data, thesis)


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


async def _verify_identity(founder: Founder) -> Founder | None:
    """Anchors extracted identities against the project's OWN primary sources
    (its official site, its GitHub org) before the founder is finalized — a
    broad discovery search alone can attach the wrong person to a common name
    or a thinly-covered project. Runs once per founder, after enrichment (so
    team members discovered during enrichment get checked too) and before
    storage. Returns None when the founder entry should be dropped entirely."""
    try:
        primary_data = await tavily_client.primary_source_search(founder.project)
    except Exception:
        logger.warning(
            "Primary-source search failed for %r — skipping identity check", founder.project, exc_info=True
        )
        return founder

    verdicts = await openai_client.verify_identities(founder, primary_data)
    verdict_by_name = {v["name"].lower(): v for v in verdicts}

    main_verdict = verdict_by_name.get(founder.name.lower())
    if main_verdict and not main_verdict.get("verified", False):
        note = main_verdict.get("verification_note") or "Team identity could not be confirmed from primary sources."
        # "Something else supports the project being real" = concrete,
        # evidence-backed substance (_sanitize already required real sources
        # for every market_stat/signal) or at least one OTHER verified person
        # — the same bar for "real" the rest of this codebase already uses.
        has_other_support = bool(founder.market_stats or founder.signals) or any(
            v.get("verified") for v in verdicts if v.get("name", "").lower() != founder.name.lower()
        )
        if not has_other_support:
            logger.warning(
                "Dropping founder entry for project %r — identity unverified (%s) and nothing else "
                "supports the project",
                founder.project,
                note,
            )
            return None
        logger.warning("Main founder identity unverified for project %r (%s) — clearing name", founder.project, note)
        # Same fallback _sanitize applies at extraction time (name -> project
        # name) — replicated here since _sanitize doesn't run again post-hoc.
        founder.name = founder.project
        addition = "Team identity could not be confirmed from primary sources."
        existing_note = founder.scorecard.verify_offline_note
        founder.scorecard.verify_offline_note = f"{existing_note} {addition}" if existing_note else addition

    for member in founder.team:
        if member.name.lower() == founder.name.lower():
            continue  # main founder already handled above
        v = verdict_by_name.get(member.name.lower())
        if v and not v.get("verified", False):
            note = v.get("verification_note") or "Identity could not be confirmed from primary sources."
            # This schema has no numeric/enum confidence on TeamMember — the
            # existing vocabulary for "not confidently sourced" everywhere
            # else in this codebase is Evidence.inferred=True, so use that.
            member.evidence = Evidence(claim=note, source_url=None, source_name="Synapse identity check", inferred=True)
            # Uncertain identity + a confidently-wrong link is worse than the
            # name alone with no links — drop rather than risk it.
            member.links = {}

    return founder


_LINKEDIN_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
}


async def _link_is_alive(url: str) -> bool:
    # TRADE-OFF, documented per explicit request: LinkedIn and some other
    # sites block simple bot requests (commonly 403, 999, or 429) even for
    # real, working profiles — a bare httpx call can't tell "blocked" apart
    # from "actually dead". A browser User-Agent alone doesn't reliably fix
    # this (LinkedIn still blocks it), so any of those three codes — and any
    # network/timeout exception, equally ambiguous — is treated as "unknown,
    # keep it" rather than proof of death. A wrongly-kept dead link is a
    # smaller harm than wrongly-dropping a real one when we can't tell which
    # it is. Net effect: this now only reliably catches genuine 404s from
    # sites that don't block bots (github.com, most personal/company sites).
    #
    # LinkedIn ALSO serves a soft-404: a real HTTP 200 for a "this page
    # doesn't exist" state (e.g. linkedin.com/404/), which no status-code
    # check can catch. For linkedin.com responses only, sniff the body/
    # final URL for that state and treat it as dead — this is the one case
    # where we CAN tell "gone" apart from "blocked", so it does not get the
    # ambiguous 200-is-fine pass below.
    try:
        async with httpx.AsyncClient(timeout=6, follow_redirects=True, headers=_LINKEDIN_HEADERS) as client:
            resp = await client.get(url)
            if resp.status_code in (403, 999, 429):
                return True  # blocked, not proof of death — keep existing policy
            if resp.status_code >= 400:
                return False
            if "linkedin.com" in url.lower():
                body = resp.text[:3000].lower()
                final_path = str(resp.url).lower()
                if (
                    "page not found" in body
                    or "this page doesn't exist" in body
                    or "/404" in final_path
                ):
                    return False
            return True
    except Exception:
        return True


async def _drop_dead_links(founder: Founder) -> Founder:
    """Confirms every link actually resolves before the founder is stored —
    the name-match guard only checks URL format, never liveness. Every unique
    URL (founder-level + every team member's) is checked exactly once,
    concurrently, with a short per-link timeout so one hanging host can't
    block the whole response."""
    link_sources: list[dict[str, str]] = [founder.links] + [m.links for m in founder.team]
    unique_urls = list({url for links in link_sources for url in links.values()})
    if not unique_urls:
        return founder

    alive_flags = await asyncio.gather(*(_link_is_alive(url) for url in unique_urls))
    alive_urls = {url for url, ok in zip(unique_urls, alive_flags) if ok}

    for links in link_sources:
        for key in list(links):
            if links[key] not in alive_urls:
                del links[key]
    return founder


_ROLE_PRIORITY = {
    "ceo": 0, "founder": 0, "co-founder": 1, "cofounder": 1,
    "cto": 1, "coo": 1, "cmo": 1,
}


def _role_rank(role: str) -> int:
    r = (role or "").strip().lower()
    for key, rank in _ROLE_PRIORITY.items():
        if key in r:
            return rank
    return 2  # everyone else (team members, contributors, etc.)


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
        candidates = _candidates_from_ids(ls, cached_ids[:target])
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
        founder = await _enrich(founder, profile.thesis)
        founder = await _enrich_member_contacts(founder)
        verified_founder = await _verify_identity(founder)
        if verified_founder is None:
            continue  # identity unverified and nothing else supports the project
        founder = await _drop_dead_links(verified_founder)
        doc = openai_client.founder_document(founder)
        embedding = await openai_client.embed(doc)
        vector_store.upsert(founder.id, embedding, doc)
        # Last mutation before storage, so it applies regardless of which
        # extraction/enrichment path added a given team member. Stable sort:
        # people within the same rank keep their original discovery order.
        founder.team.sort(key=lambda m: _role_rank(m.role))
        ls.upsert(founder, fit)
        founder_ids.append(founder.id)

    vector_store.cache_query(query_text, query_embedding, founder_ids)
    ls.set_current_result(founder_ids)

    return QueryResponse(
        parsed=ParsedQuery(free_text=query_text),
        candidates=_candidates_from_ids(ls, founder_ids),
        took_ms=0.0,  # overwritten by the caller with real elapsed time
        mode="live",
    )
