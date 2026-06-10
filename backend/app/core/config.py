import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "Axis Tracker API"
    API_V1_STR: str = "/api"
    
    # Database Configuration
    POSTGRES_USER: str = Field(default="postgres")
    POSTGRES_PASSWORD: str = Field(default="postgres")
    POSTGRES_SERVER: str = Field(default="postgres")
    POSTGRES_PORT: str = Field(default="5432")
    POSTGRES_DB: str = Field(default="axis_tracker")
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Redis Configuration
    REDIS_URL: str = Field(default="redis://redis:6379/0")

    # API Security
    # In production, this should be generated securely.
    SECRET_KEY: str = Field(default="SUPER_SECRET_AXIS_TRACKER_KEY_2026_CHANGEME")
    
    # Allowed CORS Origins
    # We will dynamically allow local chrome extension IDs or standard extensions
    ALLOWED_ORIGINS: str = Field(default="chrome-extension://*,http://localhost:5173,http://localhost:3000")

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
