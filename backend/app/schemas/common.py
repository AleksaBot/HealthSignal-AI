from pydantic import BaseModel


class DisclaimerMixin(BaseModel):
    disclaimer: str = (
        "Educational decision support only. Not medical diagnosis. Consult a licensed clinician for medical decisions."
    )
