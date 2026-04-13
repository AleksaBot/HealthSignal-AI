from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserRead(BaseModel):
    id: int
    first_name: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True
