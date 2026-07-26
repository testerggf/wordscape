from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    debug: bool = True
    cors_origins: list[str] = ["http://localhost:3000"]
    supabase_url: str = ""
    supabase_service_key: str = ""
    encrypt_secret: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
