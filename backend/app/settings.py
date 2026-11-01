from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./quality.db"
    secret_key: str = "forgequality-development-secret-key-32-chars-min"
    access_token_minutes: int = 60
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    initial_admin_username: str = "test-admin"
    initial_admin_password: str = "test-only-password-12345"
    frontend_url: str = "http://localhost:8080"

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")


settings = Settings()
