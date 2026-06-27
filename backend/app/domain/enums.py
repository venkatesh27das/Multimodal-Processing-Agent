from enum import StrEnum


class FileType(StrEnum):
    PDF = "pdf"
    DOCX = "docx"
    IMAGE = "image"
    HTML = "html"
    AUDIO = "audio"
    VIDEO = "video"
    UNKNOWN = "unknown"


class Modality(StrEnum):
    DOCUMENT = "document"
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    TABLE = "table"
    LAYOUT = "layout"


class ParserType(StrEnum):
    DETERMINISTIC = "deterministic"
    OCR = "ocr"
    VLM = "vlm"
    SPEECH = "speech"
    VIDEO = "video"
    EXTERNAL = "external"


class JobStatus(StrEnum):
    REGISTERED = "registered"
    QUEUED = "queued"
    PLANNING = "planning"
    RUNNING = "running"
    REVIEW_REQUIRED = "review_required"
    COMPLETE = "complete"
    FAILED = "failed"


class QualityStatus(StrEnum):
    NOT_EVALUATED = "not_evaluated"
    PASSED = "passed"
    FAILED = "failed"
    FALLBACK_REQUIRED = "fallback_required"
    REVIEW_REQUIRED = "review_required"


class ReviewStatus(StrEnum):
    OPEN = "open"
    ASSIGNED = "assigned"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class CostLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class LatencyLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class DeploymentMode(StrEnum):
    LOCAL = "local"
    MANAGED = "managed"
    EXTERNAL = "external"


class QualityTarget(StrEnum):
    LOW = "low"
    BALANCED = "balanced"
    HIGH = "high"


class CostProfile(StrEnum):
    LOW_COST = "low_cost"
    BALANCED = "balanced"
    PREMIUM = "premium"


class LatencyProfile(StrEnum):
    BATCH = "batch"
    INTERACTIVE = "interactive"
    REAL_TIME = "real_time"
