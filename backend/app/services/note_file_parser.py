from __future__ import annotations

from io import BytesIO
from pathlib import Path

from fastapi import UploadFile, status

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover - handled gracefully at runtime
    PdfReader = None

try:
    from PIL import Image
except Exception:  # pragma: no cover - handled gracefully at runtime
    Image = None

try:
    import pytesseract
except Exception:  # pragma: no cover - handled gracefully at runtime
    pytesseract = None


ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
}


class FileParsingError(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _normalize_text(raw_text: str) -> str:
    return "\n".join(line.strip() for line in raw_text.splitlines() if line.strip()).strip()


def _validate_supported_type(upload: UploadFile) -> str:
    extension = Path(upload.filename or "").suffix.lower()
    content_type = (upload.content_type or "").lower()

    if extension not in ALLOWED_EXTENSIONS and content_type not in ALLOWED_CONTENT_TYPES:
        raise FileParsingError("Unsupported file type. Please upload a PDF, PNG, JPG, or JPEG file.")

    return extension


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    if PdfReader is None:
        raise FileParsingError(
            "PDF parsing is unavailable because the PDF dependency is not installed.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    reader = PdfReader(BytesIO(file_bytes))
    text_parts: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        text_parts.append(page_text)

    text = _normalize_text("\n".join(text_parts))
    if len(text) < 5:
        raise FileParsingError("No extractable text was found in the PDF. Try a clearer PDF or paste text manually.")

    return text


def _extract_text_from_image(file_bytes: bytes) -> str:
    if Image is None or pytesseract is None:
        raise FileParsingError(
            "Image OCR is unavailable. Install pytesseract and Pillow, and ensure Tesseract OCR is installed.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        image = Image.open(BytesIO(file_bytes))
        text = _normalize_text(pytesseract.image_to_string(image) or "")
    except pytesseract.TesseractNotFoundError:
        raise FileParsingError(
            "Image OCR is unavailable because Tesseract is not installed on the server.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        ) from None
    except Exception:
        raise FileParsingError("Unable to process the uploaded image for OCR. Please try another file.") from None

    if len(text) < 5:
        raise FileParsingError("No readable text was found in the image. Try a clearer image or paste text manually.")

    return text


def extract_text_from_upload(upload: UploadFile) -> str:
    extension = _validate_supported_type(upload)
    file_bytes = upload.file.read()
    if not file_bytes:
        raise FileParsingError("Uploaded file is empty. Please select a file with note content.")

    if extension == ".pdf" or (upload.content_type or "").lower() == "application/pdf":
        return _extract_text_from_pdf(file_bytes)

    return _extract_text_from_image(file_bytes)
