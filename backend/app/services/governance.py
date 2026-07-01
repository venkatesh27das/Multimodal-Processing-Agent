import re
from dataclasses import dataclass, field
from pathlib import Path

from backend.app.models.domain import FileProfile, FileRecord

EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_PATTERN = re.compile(r"\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b")
RESTRICTED_HINTS = {"restricted", "confidential", "secret", "privileged", "legal_hold"}


@dataclass(frozen=True)
class GovernanceFinding:
    code: str
    severity: str
    message: str
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class GovernanceReport:
    allowed: bool
    pii_detected: bool
    restricted_document: bool
    findings: list[GovernanceFinding]
    policy_version: str = "mvp-0.1"

    def to_dict(self) -> dict[str, object]:
        return {
            "allowed": self.allowed,
            "pii_detected": self.pii_detected,
            "restricted_document": self.restricted_document,
            "policy_version": self.policy_version,
            "findings": [
                {
                    "code": finding.code,
                    "severity": finding.severity,
                    "message": finding.message,
                    "metadata": finding.metadata,
                }
                for finding in self.findings
            ],
        }


class PIIDetector:
    """Lightweight placeholder detector for MVP governance signals."""

    def detect(self, file_record: FileRecord) -> list[GovernanceFinding]:
        text = file_record.original_filename
        findings: list[GovernanceFinding] = []
        if EMAIL_PATTERN.search(text) or PHONE_PATTERN.search(text):
            findings.append(
                GovernanceFinding(
                    code="pii.filename_hint",
                    severity="medium",
                    message="Potential PII was detected in the filename.",
                )
            )
        return findings


class RestrictedDocumentDetector:
    """Placeholder restricted document flagger based on metadata and constraints."""

    def detect(
        self,
        file_record: FileRecord,
        governance_constraints: dict[str, object],
    ) -> list[GovernanceFinding]:
        filename = Path(file_record.original_filename).stem.lower()
        hints = sorted(hint for hint in RESTRICTED_HINTS if hint in filename)
        explicit_flag = governance_constraints.get("restricted_document") is True
        if not hints and not explicit_flag:
            return []

        return [
            GovernanceFinding(
                code="document.restricted",
                severity="high",
                message="Document was flagged as restricted.",
                metadata={"filename_hints": hints, "explicit_flag": explicit_flag},
            )
        ]


class PolicyChecker:
    def __init__(
        self,
        pii_detector: PIIDetector | None = None,
        restricted_detector: RestrictedDocumentDetector | None = None,
    ) -> None:
        self.pii_detector = pii_detector or PIIDetector()
        self.restricted_detector = restricted_detector or RestrictedDocumentDetector()

    def check(
        self,
        *,
        file_record: FileRecord,
        file_profile: FileProfile,
        governance_constraints: dict[str, object],
        agent_interpretation: dict[str, object] | None = None,
    ) -> GovernanceReport:
        findings = [
            *self.pii_detector.detect(file_record),
            *self.restricted_detector.detect(file_record, governance_constraints),
        ]
        if governance_constraints.get("pii_allowed") is False and any(
            finding.code.startswith("pii.") for finding in findings
        ):
            findings.append(
                GovernanceFinding(
                    code="policy.pii_not_allowed",
                    severity="high",
                    message="Potential PII conflicts with the request policy.",
                )
            )
        sensitivity_handling = governance_constraints.get("sensitivity_handling")
        if sensitivity_handling and sensitivity_handling != "none":
            findings.append(
                GovernanceFinding(
                    code="policy.sensitivity_handling",
                    severity="info",
                    message="Sensitivity handling policy was applied.",
                    metadata={
                        "sensitivity_handling": sensitivity_handling,
                        "redaction_confidence_threshold": governance_constraints.get(
                            "redaction_confidence_threshold",
                            0.85,
                        ),
                        "phi_handling": governance_constraints.get("phi_handling", "mask_tokenize"),
                        "audit_sensitive_detections": governance_constraints.get(
                            "audit_sensitive_detections",
                            True,
                        ),
                    },
                )
            )
        if agent_interpretation:
            findings.append(
                GovernanceFinding(
                    code="policy.agent_instruction_interpreted",
                    severity="info",
                    message="Agent instruction interpretation was included in governance context.",
                    metadata=agent_interpretation,
                )
            )

        restricted_document = any(finding.code == "document.restricted" for finding in findings)
        if (
            restricted_document
            and governance_constraints.get("block_restricted_documents") is True
        ):
            findings.append(
                GovernanceFinding(
                    code="policy.restricted_blocked",
                    severity="critical",
                    message="Restricted document processing is blocked by policy.",
                    metadata={"file_type": file_profile.file_type},
                )
            )

        allowed = not any(finding.code == "policy.restricted_blocked" for finding in findings)
        pii_detected = any(finding.code.startswith("pii.") for finding in findings)
        return GovernanceReport(
            allowed=allowed,
            pii_detected=pii_detected,
            restricted_document=restricted_document,
            findings=findings,
        )


policy_checker = PolicyChecker()
