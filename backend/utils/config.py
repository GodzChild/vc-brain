"""Central config. Every external service is optional — absence of a key
switches that subsystem into demo mode with a local fallback."""
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Explicit path, not the default cwd-walking search — this process's cwd
# varies by how it's launched, and an unrelated .env higher up the tree
# (e.g. in the user's home directory) must never shadow this one.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Settings:
    def __init__(self) -> None:
        self.gemini_api_key: str | None = os.getenv("GEMINI_API_KEY") or None
        self.tavily_api_key: str | None = os.getenv("TAVILY_API_KEY") or None
        self.openai_api_key: str | None = os.getenv("OPENAI_API_KEY") or None
        self.mongodb_uri: str | None = os.getenv("MONGODB_URI") or None
        self.mongodb_db: str = os.getenv("MONGODB_DB", "synapse")
        self.neo4j_uri: str | None = os.getenv("NEO4J_URI") or None
        self.neo4j_user: str = os.getenv("NEO4J_USER", "neo4j")
        self.neo4j_password: str | None = os.getenv("NEO4J_PASSWORD") or None
        self.github_token: str | None = os.getenv("GITHUB_TOKEN") or None
        # Set in Render's dashboard (not committed). Production origin must be
        # exactly https://proffound.o-cthegreatest.workers.dev (no trailing
        # slash) — don't guess a stale .pages.dev value here.
        self.cors_origins: list[str] = [
            o.strip()
            for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
            if o.strip()
        ]
        # Public /query rate limiting. Per-IP sliding window; optional global cap.
        # Set RATE_LIMIT_PER_IP=0 to disable entirely.
        self.rate_limit_per_ip: int = int(os.getenv("RATE_LIMIT_PER_IP", "5"))
        self.rate_limit_window_sec: float = float(os.getenv("RATE_LIMIT_WINDOW_SEC", "300"))
        _global = os.getenv("RATE_LIMIT_GLOBAL")
        self.rate_limit_global: int | None = int(_global) if _global else None

    @property
    def gemini_enabled(self) -> bool:
        return self.gemini_api_key is not None

    @property
    def live_enabled(self) -> bool:
        return self.tavily_api_key is not None and self.openai_api_key is not None

    @property
    def mongo_enabled(self) -> bool:
        return self.mongodb_uri is not None

    @property
    def neo4j_enabled(self) -> bool:
        return self.neo4j_uri is not None and self.neo4j_password is not None


@lru_cache
def get_settings() -> Settings:
    return Settings()
