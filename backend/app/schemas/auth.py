from pydantic import BaseModel, EmailStr, Field, field_validator


class AuthSignupRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("first_name")
    @classmethod
    def normalize_first_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("First name is required")
        return normalized


class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    dev_reset_link: str | None = None


class ResetPasswordConfirmRequest(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    new_password: str = Field(min_length=8, max_length=128)


class EmailVerificationConfirmRequest(BaseModel):
    token: str = Field(min_length=20, max_length=512)


class AuthActionResponse(BaseModel):
    message: str
    dev_verification_link: str | None = None
