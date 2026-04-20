from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRead(BaseModel):
    id: int
    first_name: str
    email: EmailStr
    email_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserNameUpdateRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)

    @field_validator("first_name")
    @classmethod
    def normalize_first_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("First name is required")
        return normalized


class UserEmailUpdateRequest(BaseModel):
    new_email: EmailStr
    current_password: str = Field(min_length=1, max_length=128)


class UserPasswordUpdateRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
