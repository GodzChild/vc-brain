"""OpenAI-backed extraction, scoring, and embeddings for live mode.

Turns raw Tavily search results into the same Founder/Scorecard/Evidence
shape as the demo dataset. One hard rule enforced by the prompt: every
source_url must be a URL that actually appeared in the Tavily results —
the model is given the exact result set and told never to invent one.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import date

from openai import AsyncOpenAI

from backend.models.schemas import FitResult, Founder, MarketStat, TeamMember, VCProfile
from backend.utils.config import get_settings

logger = logging.getLogger("synapse.openai")

EMBEDDING_MODEL = "text-embedding-3-small"
CHAT_MODEL = "gpt-4o-mini"


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=get_settings().openai_api_key)


def founder_document(founder: Founder) -> str:
    """Text blob embedded for semantic search — mirrors what a future
    query might describe, so a similar future query lands near it."""
    return " · ".join(
        [
            founder.name,
            founder.headline,
            founder.project,
            founder.project_description,
            ", ".join(founder.domains),
            founder.entity_type,
            founder.stage,
            f"{founder.location.city}, {founder.location.country}",
        ]
    )


async def embed(text: str) -> list[float]:
    resp = await _client().embeddings.create(model=EMBEDDING_MODEL, input=text)
    return resp.data[0].embedding


EXTRACTION_SYSTEM_PROMPT = """You are Synapse's founder-scouting analyst. Given web search \
results for a venture scout's query, identify real, distinct founders/builders described in \
those results who match the query, and produce a structured, evidence-backed profile for each.

Be predictive and adaptive: first classify WHAT each entity is, then pull the information an \
investor needs for that kind of entity, in priority order.

"entity_type" is one of: startup, hackathon_project, research, indie_project, other.

If it is a STARTUP, prioritize in this order:
1. Company name, the CEO/founders, team size, socials, emails, public GitHub — whatever the \
results actually contain. Use what you find about the CEO's background and the team's shape to \
judge how well the company is led and whether it can grow.
2. Concrete current stats and market trends: funding raised, users, revenue, retention, growth \
rate, market size — every number goes into "market_stats" with its source.

If it is a HACKATHON PROJECT, prioritize in this order:
1. Team members — every named person into "team" with their role.
2. The prototype: what it does, how far it got.
3. Which competition it was, and how they placed.
4. Socials and contact details for each member, when the results contain them.

If it is RESEARCH (paper, thesis, lab project), prioritize: the authors/researchers into \
"team", what the work demonstrates, its market potential and commercialization path, the \
publishing venue, and any citation/impact numbers into "market_stats".

For every entity also assess the three investor metrics in "vc_metrics", each scored 0-10 \
with a 1-2 sentence rationale and evidence:
- "scalability": can this grow 100x — technology leverage, marginal cost, team's scaling record.
- "market_gap": how real and underserved is the need — market size, competition, timing.
- "innovation": how novel is the tech AND the business model — defensibility, differentiation.

CONTACT INFORMATION IS A MUST-HAVE PRIORITY. For the main founder/CEO and every team member, \
work hard to pull — from the results — their social media (LinkedIn, Twitter/X, personal site), \
email, and the company/project website. Populate "team[].links" and the top-level "links" with \
every real one you find. These are the outreach surface an investor needs; treat a missing \
LinkedIn or website as a gap to fill, not an afterthought. (Still: only URLs that literally \
appear in the results — never guess a handle or construct an email.)

Aim to cite MANY sources — a well-researched profile references 3-10 distinct source URLs across \
its scorecard, signals, metrics, stats, team, and story beats. Spread real citations widely \
rather than reusing one link everywhere.

Confidence calibration — be precise, not generous:
- "high": directly stated by a primary source (the project's own page, official results list) \
or corroborated by 2+ independent results.
- "medium": stated once by a credible secondary source.
- "low": thin, indirect, or aggregated mentions only.
- "verify_offline": identity or claim cannot be pinned down from the results — say why in \
"verify_offline_note".

Hard rules:
- Every "source_url" you write MUST be copied verbatim from the provided search results. \
Never invent, guess, or modify a URL.
- If a claim isn't directly stated in the results, either omit it or set "inferred": true with \
"source_url": null and phrase the claim as an inference.
- Only include images from the provided image URLs, and only when they plausibly depict that \
founder or their project. Judge each image by its URL and filename: if the slug or domain ties \
it to a different organization, role, or person (e.g. someone else's company in the filename), \
exclude it. Common names collide — omit images rather than risk showing the wrong person.
- "market_stats" must be concrete, already-measured numbers, each with evidence citing a real \
source_url. No projections, no vague claims, no unsourced numbers — omit instead.
- Dimension scores are 0-10 (lead, pitch, sell, scale, grit); confidence is "high", "medium", \
"low", or "verify_offline" based on how directly the evidence supports the score.
- fit_score is 0-100, your own opinion of fit against the given VC thesis — always inferred.
- Return between 0 and {max_results} founders. Fewer, accurate founders beats padding with \
weak or duplicate matches. If the results don't describe any real founder, return an empty list.
- "id" must be a URL-safe slug shaped like "f-lowercase-hyphenated-name".
- "stage" is one of: idea, prototype, launched, revenue.
- "location.city" and "location.country" must never be null — use your best inference from \
context, or "" if truly unknown. Same for every other text field: use "" instead of null.
- "location.lat"/"location.lng" must be real approximate coordinates for the city (or the \
country's centroid if only the country is known) — from your own geographic knowledge, not the \
search results. Never use 0.0/0.0 unless the location genuinely is at the equator and prime \
meridian.
- "links" must only contain keys you have a real URL for — omit a key entirely rather than \
setting its value to null. Same for every "team[].links" entry: only socials/emails that \
literally appear in the results — never guess a handle or construct an email address.
- A profile URL may only be attached to a team member if it is clearly THAT person's own \
profile (their name in the URL slug or the results saying so). The profile of someone who \
merely wrote about them — a journalist, a judge, a poster — must never be attached to them. \
When in doubt, leave the member's links empty.
- "team" must list every named person the results attach to the project, including the main \
founder. If the results name nobody else, a single-entry team is fine.
- All three "vc_metrics" entries are required (scalability, market_gap, innovation). Ground each \
rationale in the results; when the results give you nothing for an axis, score conservatively, \
mark it "low" confidence, and let the evidence list stay empty rather than fabricating support.

Depth requirements — thin output is a failure mode, not a safe default:
- "signals" must capture every concrete, dateable milestone the results support: launches, \
funding, traction numbers, awards, hackathon wins, velocity indicators. A launch mentioned in \
the results (e.g. "launched on Product Hunt") IS itself a signal with kind "launch" — always \
include it with a real source_url. Only leave "signals" empty if the results truly describe \
nothing dateable.
- Every "story_beats[]" entry's "facts" array must contain at least one Evidence citing a real \
source_url from the results — reuse the same claims/sources backing the scorecard and signals \
where relevant. An empty "facts" array is only acceptable when nothing in the results supports \
that particular beat, which should be rare across six beats and multiple search results.

Story beats — each beat has a fixed role, and each "body" must be a FULL PARAGRAPH (4-6 \
sentences), specific and concrete, citing real numbers/dates/named details from the results. A \
single sentence is a failure. The beats, in order:
- "hook": the company/startup/project ITSELF — what it is, what it does, the product, its \
  early-stage status and traction. This is the opener; make it about the venture, not the person.
- "background": the FOUNDER/CEO — who they are, their history, prior work, credibility, and what \
  makes them the right person to build this. This is the person's story.
- "scorecard": how they score across the five execution dimensions and why.
- "signals": the concrete recent milestones — launches, wins, funding, traction — with dates.
- "fit": your read on fit against the VC thesis (this beat's facts should be your inferred \
  opinion, marked inferred:true, not a sourced claim).
- "contact": how to reach them and the warm path in — reference their socials/website/email.

- Respond with JSON only, matching this exact shape:

{{
  "founders": [
    {{
      "id": "f-...",
      "name": "...",
      "headline": "...",
      "project": "...",
      "project_description": "...",
      "domains": ["..."],
      "stage": "...",
      "entity_type": "startup | hackathon_project | research | indie_project | other",
      "location": {{"city": "...", "country": "...", "lat": 0.0, "lng": 0.0}},
      "images": ["..."],
      "team": [
        {{"name": "...", "role": "CEO", "links": {{"linkedin": "https://real-result-url"}},
          "evidence": {{"claim": "...", "source_url": "https://real-result-url", "source_name": "...", "inferred": false}}}}
      ],
      "vc_metrics": [
        {{"metric": "scalability", "score": 0.0, "confidence": "...", "rationale": "1-2 sentences",
          "evidence": [{{"claim": "...", "source_url": "https://real-result-url", "source_name": "...", "inferred": false}}]}},
        {{"metric": "market_gap", "score": 0.0, "confidence": "...", "rationale": "1-2 sentences", "evidence": []}},
        {{"metric": "innovation", "score": 0.0, "confidence": "...", "rationale": "1-2 sentences", "evidence": []}}
      ],
      "market_stats": [
        {{"label": "Funding raised", "value": "$2.3M",
          "evidence": {{"claim": "...", "source_url": "https://real-result-url", "source_name": "...", "inferred": false}}}}
      ],
      "scorecard": {{
        "overall": 0.0,
        "confidence": "...",
        "dimensions": [
          {{"dimension": "lead", "score": 0.0, "confidence": "...",
            "evidence": [{{"claim": "...", "source_url": "https://real-result-url", "source_name": "...", "inferred": false}}]}},
          {{"dimension": "pitch", "score": 0.0, "confidence": "...",
            "evidence": [{{"claim": "...", "source_url": "https://real-result-url", "source_name": "...", "inferred": false}}]}},
          {{"dimension": "sell", "score": 0.0, "confidence": "...", "evidence": []}},
          {{"dimension": "scale", "score": 0.0, "confidence": "...", "evidence": []}},
          {{"dimension": "grit", "score": 0.0, "confidence": "...", "evidence": []}}
        ],
        "verify_offline_note": null
      }},
      "signals": [
        {{"kind": "launch", "text": "...", "date": null,
          "evidence": {{"claim": "...", "source_url": "https://real-result-url", "source_name": "...", "inferred": false}}}}
      ],
      "story_beats": [
        {{"beat": "hook", "title": "...", "body": "2-4 sentences, specific and concrete — not a one-liner",
          "facts": [{{"claim": "...", "source_url": "https://real-result-url", "source_name": "...", "inferred": false}}]}},
        {{"beat": "background", "title": "...", "body": "2-4 sentences",
          "facts": [{{"claim": "...", "source_url": "https://real-result-url", "source_name": "...", "inferred": false}}]}},
        {{"beat": "scorecard", "title": "...", "body": "2-4 sentences",
          "facts": [{{"claim": "...", "source_url": "https://real-result-url", "source_name": "...", "inferred": false}}]}},
        {{"beat": "signals", "title": "...", "body": "2-4 sentences",
          "facts": [{{"claim": "...", "source_url": "https://real-result-url", "source_name": "...", "inferred": false}}]}},
        {{"beat": "fit", "title": "...", "body": "2-4 sentences",
          "facts": [{{"claim": "Fit assessment is a model opinion, not a sourced fact", "source_url": null, "source_name": "Synapse fit engine", "inferred": true}}]}},
        {{"beat": "contact", "title": "...", "body": "2-4 sentences",
          "facts": [{{"claim": "...", "source_url": "https://real-result-url", "source_name": "...", "inferred": false}}]}}
      ],
      "links": {{"github": "...", "website": "..."}},
      "discovered_via": ["..."],
      "entity_resolution_confidence": 1.0,
      "fit_score": 0.0,
      "fit_rationale": "..."
    }}
  ]
}}
"""


# Names that are placeholders/roles rather than a real person — these create
# duplicate, contactless "ghost" members, so they're dropped.
_PLACEHOLDER_EXACT = {
    "", "na", "n/a", "tbd", "founder", "founders", "co-founder", "cofounder", "ceo", "cto",
    "cmo", "coo", "team member", "team", "the team", "leadership",
}
# Phrases that mark a non-name even inside a longer string ("Name: Not Available").
_PLACEHOLDER_SUBSTR = (
    "unknown", "unnamed", "not available", "not disclosed", "not specified", "not provided",
    "undisclosed", "anonymous", "no name", "placeholder",
)


def _real_person_name(name: object) -> bool:
    if not isinstance(name, str):
        return False
    n = name.strip().lower()
    if n in _PLACEHOLDER_EXACT:
        return False
    return not any(p in n for p in _PLACEHOLDER_SUBSTR)


def _slug_matches_name(url: str, name: str) -> bool:
    """A personal profile URL's path should contain some fragment of the person's
    own name. Code-level check on top of the prompt instruction, since the model
    won't always comply perfectly."""
    name_tokens = [t for t in re.split(r"\s+", name.lower()) if len(t) > 2]
    if not name_tokens:
        return True
    path = url.lower()
    return any(token in path for token in name_tokens)


def _clean_member_links(links: object, member_name: str = "") -> dict:
    """A team member's links must be THEIR OWN — a company page
    (linkedin.com/company/…) is not a personal profile, so it's dropped here.
    A member with no real personal link gets a fallback later, in live_query."""
    out: dict[str, str] = {}
    for k, v in (links or {}).items() if isinstance(links, dict) else []:
        if not isinstance(v, str) or not v:
            continue
        if "linkedin.com/company/" in v.lower() or "linkedin.com/school/" in v.lower():
            continue
        if k in ("linkedin", "twitter", "github", "crunchbase", "angellist") and member_name:
            if not _slug_matches_name(v, member_name):
                continue
        out[k] = v
    return out


def _sanitize(entry: dict) -> dict:
    """Defensively coerces common model slip-ups (null instead of "" or an
    omitted key) so a single missing field doesn't drop an otherwise-good
    extraction. Pydantic still validates everything after this."""
    location = entry.get("location") or {}
    entry["location"] = {
        "city": location.get("city") or "",
        "country": location.get("country") or "",
        "lat": location.get("lat") or 0.0,
        "lng": location.get("lng") or 0.0,
    }
    entry["links"] = {k: v for k, v in (entry.get("links") or {}).items() if isinstance(v, str) and v}
    entry["images"] = [u for u in (entry.get("images") or []) if isinstance(u, str) and u]
    for text_field in ("headline", "project", "project_description"):
        if entry.get(text_field) is None:
            entry[text_field] = ""
    # A placeholder top-level name ("N/A", "Unknown") reads as broken — fall
    # back to the project/company name so the header is never a dead label.
    if "name" in entry and not _real_person_name(entry.get("name")):
        entry["name"] = entry.get("project") or entry.get("name") or ""

    def _evidence_or_none(e: object) -> dict | None:
        return e if isinstance(e, dict) and e.get("claim") else None

    def _evidence_list(evs: object) -> list[dict]:
        return [e for e in (evs if isinstance(evs, list) else []) if isinstance(e, dict) and e.get("claim")]

    entry["team"] = [
        {
            "name": m["name"],
            "role": m.get("role") or "",
            "links": _clean_member_links(m.get("links"), m.get("name") or ""),
            "evidence": _evidence_or_none(m.get("evidence")),
        }
        for m in (entry.get("team") or [])
        if isinstance(m, dict) and _real_person_name(m.get("name"))
    ]
    entry["vc_metrics"] = [
        {
            "metric": metric["metric"],
            "score": min(max(float(metric.get("score") or 0), 0), 10),
            "confidence": metric.get("confidence") or "low",
            "rationale": metric.get("rationale") or "",
            "evidence": _evidence_list(metric.get("evidence")),
        }
        for metric in (entry.get("vc_metrics") or [])
        if isinstance(metric, dict) and metric.get("metric") in ("scalability", "market_gap", "innovation")
    ]
    # Stats are only as good as their sources — an unsourced number is
    # dropped outright rather than shown as if it were verified.
    entry["market_stats"] = [
        {"label": s["label"], "value": str(s["value"]), "evidence": s["evidence"]}
        for s in (entry.get("market_stats") or [])
        if isinstance(s, dict)
        and s.get("label")
        and s.get("value")
        and isinstance(s.get("evidence"), dict)
        and s["evidence"].get("claim")
        and s["evidence"].get("source_url")
    ]
    return entry


async def extract_founders(
    query: str, tavily_data: dict, profile: VCProfile, max_results: int = 3
) -> list[tuple[Founder, FitResult]]:
    results = tavily_data.get("results", [])
    images = [img.get("url") if isinstance(img, dict) else img for img in tavily_data.get("images", [])]

    user_payload = {
        "scout_query": query,
        "vc_thesis": profile.thesis,
        "vc_focus_domains": profile.focus_domains,
        "vc_focus_geos": profile.focus_geos,
        "vc_preferred_stages": profile.preferred_stages,
        "search_results": [
            {"title": r.get("title"), "url": r.get("url"), "content": r.get("content")} for r in results
        ],
        "available_images": images,
    }

    resp = await _client().chat.completions.create(
        model=CHAT_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT.format(max_results=max_results)},
            {"role": "user", "content": json.dumps(user_payload)},
        ],
    )
    raw = json.loads(resp.choices[0].message.content or "{}")

    out: list[tuple[Founder, FitResult]] = []
    for entry in raw.get("founders", [])[:max_results]:
        try:
            fit_score = float(entry.pop("fit_score"))
            fit_rationale = str(entry.pop("fit_rationale"))
            entry["first_seen"] = date.today().isoformat()
            founder = Founder.model_validate(_sanitize(entry))
            fit = FitResult(founder_id=founder.id, fit_score=fit_score, rationale=fit_rationale, inferred=True)
            out.append((founder, fit))
        except Exception:
            logger.warning("Skipping malformed extracted founder entry", exc_info=True)
    return out


ENRICHMENT_SYSTEM_PROMPT = """You are Synapse's enrichment analyst. You are given one \
already-extracted profile and a fresh, targeted web search about that specific person/project. \
Extract ONLY additive detail the profile is missing:

- "team": named people with roles, and any socials/emails the results literally contain.
- "links": additional real URLs for the project (github, linkedin, twitter, website, demo...).
- "market_stats": concrete numbers (funding, users, growth, team size, market size) with sources.
- "images": you are the final auditor of the image list. Return the complete corrected list: \
start from "current_images", DROP any image whose URL/filename/domain ties it to a different \
organization, role, or person than this profile (common names collide — e.g. a filename naming \
someone's role at an unrelated company), then add any "available_images" that plausibly depict \
this person/project. ORDER the list so a headshot/portrait of the main founder/CEO comes FIRST \
(this image represents the person) — filenames or slugs containing the founder's name, "profile", \
"headshot", "portrait", or a LinkedIn/Twitter avatar host are strong signals. Returning an empty \
list is correct when nothing qualifies.

Rules: every source_url and every link must be copied verbatim from these search results — \
never invent or reconstruct one. Never guess an email or social handle. A profile URL may only \
be attached to a team member if it is clearly THAT person's own profile (their name in the URL \
slug or the results saying so) — the profile of someone who merely wrote about them must never \
be attached; when in doubt, leave links empty. If the results are about a DIFFERENT \
person/project with a similar name, return empty fields rather than contaminating the profile. \
Judge every image by its URL and filename: if the slug or domain ties it to a different \
organization, role, or person than this profile, exclude it — common names collide, and \
showing the wrong person is worse than showing no image. market_stats must be concrete \
measured numbers with sourced evidence — no projections or unsourced claims. \
Respond with JSON only:
{"team": [{"name": "...", "role": "...", "links": {}, "evidence": {"claim": "...", "source_url": "...", "source_name": "...", "inferred": false}}],
 "links": {}, "market_stats": [{"label": "...", "value": "...", "evidence": null}], "images": []}
"""


async def enrich_founder(founder: Founder, tavily_data: dict) -> Founder:
    """Merges additive detail (team, links, stats, images) from a targeted
    per-founder search into the profile. Merge is additive-only: existing
    values always win, so enrichment can deepen but never overwrite."""
    results = tavily_data.get("results", [])
    images = [img.get("url") if isinstance(img, dict) else img for img in tavily_data.get("images", [])]
    if not results and not images:
        return founder

    payload = {
        "profile": {
            "name": founder.name,
            "project": founder.project,
            "entity_type": founder.entity_type,
            "known_team": [m.name for m in founder.team],
            "known_links": founder.links,
            "known_stats": [s.label for s in founder.market_stats],
            "current_images": founder.images,
        },
        "search_results": [
            {"title": r.get("title"), "url": r.get("url"), "content": r.get("content")} for r in results
        ],
        "available_images": images,
    }
    try:
        resp = await _client().chat.completions.create(
            model=CHAT_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": ENRICHMENT_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(payload)},
            ],
        )
        raw = json.loads(resp.choices[0].message.content or "{}")
        sanitized = _sanitize(
            {
                "team": raw.get("team"),
                "links": raw.get("links"),
                "market_stats": raw.get("market_stats"),
                "images": raw.get("images"),
                "location": founder.location.model_dump(),
            }
        )

        known_members = {m.name.lower() for m in founder.team}
        for member in sanitized["team"]:
            if member["name"].lower() not in known_members:
                founder.team.append(TeamMember.model_validate(member))
            else:  # merge any newly-found links into the existing member
                existing = next(m for m in founder.team if m.name.lower() == member["name"].lower())
                existing.links = {**member["links"], **existing.links}
        founder.links = {**sanitized["links"], **founder.links}
        known_stats = {s.label.lower() for s in founder.market_stats}
        founder.market_stats.extend(
            MarketStat.model_validate(s) for s in sanitized["market_stats"] if s["label"].lower() not in known_stats
        )
        # Images REPLACE rather than append: the enrichment call audits the
        # current list against this specific person/project and returns the
        # corrected set — dropping name-collision images is the point.
        if "images" in raw:
            founder.images = list(dict.fromkeys(sanitized["images"]))
    except Exception:
        logger.warning("Enrichment failed for %r — keeping base profile", founder.name, exc_info=True)
    return founder


MEMBER_CONTACT_SYSTEM_PROMPT = """You are given ONE person's name, the project/company they work \
on, and web search results from a search for that person. Return that specific person's own \
contact/profile links that literally appear in the results. Accepted keys: linkedin, twitter, \
github, email, crunchbase, angellist, website (their personal site).

Hard rules:
- Copy every URL verbatim from the results. Never invent, guess, or construct a URL or email.
- A link counts if the result makes clear it is THIS person's own profile — their name in the URL \
slug, OR the surrounding result text identifying it as theirs — AND it is consistent with the \
given company/context. Reject namesakes at other companies; a wrong profile is worse than none.
- Capture whatever you can find: a Crunchbase or personal site still counts if LinkedIn isn't \
present. Include every distinct real link, not just one.
- For "email", only include a real address that literally appears in the results.
- If truly nothing qualifies, return an empty object.

Respond with JSON only: {"links": {"linkedin": "https://...", "email": "..."}}"""


async def find_member_links(member_name: str, context: str, tavily_data: dict) -> dict[str, str]:
    """Pulls a single team member's own contact links from a search targeted
    at that person — the broad per-founder enrichment rarely surfaces each
    individual's profile, so each member gets their own focused lookup."""
    results = tavily_data.get("results", [])
    if not results:
        return {}
    payload = {
        "person": member_name,
        "context": context,
        "search_results": [
            {"title": r.get("title"), "url": r.get("url"), "content": r.get("content")} for r in results
        ],
    }
    try:
        resp = await _client().chat.completions.create(
            model=CHAT_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": MEMBER_CONTACT_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(payload)},
            ],
        )
        raw = json.loads(resp.choices[0].message.content or "{}")
        return _clean_member_links(raw.get("links"), member_name)
    except Exception:
        logger.warning("Member contact lookup failed for %r", member_name, exc_info=True)
        return {}
