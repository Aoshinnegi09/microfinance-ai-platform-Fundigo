
import os

def _default_db_uri() -> str:
    host = os.getenv("POSTGRES_HOST")
    if host:
        user = os.getenv("POSTGRES_USER", "microfinance")
        password = os.getenv("POSTGRES_PASSWORD", "microfinance")
        database = os.getenv("POSTGRES_DB", "microfinance")
        port = os.getenv("POSTGRES_PORT", "5432")
        return f"postgresql://{user}:{password}@{host}:{port}/{database}"
    return "sqlite:///microfinance_backend.db"

def _fix_db_url(url: str) -> str:
    if url and "sslmode" in url:
        url = url.split("?")[0]
    return url

class Config:
    _raw_url = os.getenv("DATABASE_URL", _default_db_uri())
    SQLALCHEMY_DATABASE_URI = _fix_db_url(_raw_url)
    SQLALCHEMY_ENGINE_OPTIONS = {"connect_args": {"sslmode": "require"}} if os.getenv("DATABASE_URL") else {}
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret")
    JWT_EXP_SECONDS = int(os.getenv("JWT_EXP_SECONDS", "3600"))
    AI_ENGINE_URL = os.getenv("AI_ENGINE_URL", "http://ai-engine:5001")
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
