from dataclasses import dataclass

from sqlalchemy.orm import Session

from backend.app.domain.enums import (
    CostLevel,
    CostProfile,
    FileType,
    LatencyLevel,
    LatencyProfile,
    Modality,
    QualityTarget,
)
from backend.app.models.domain import FileProfile, ParserDefinition, SkillDefinition
from backend.app.schemas.domain import ParserScoreBreakdown, ParserSelectionResponse
from backend.app.services.parser_registry import parser_registry

PREFERRED_PRIMARY_BY_FILE_TYPE: dict[FileType, str] = {
    FileType.DOCX: "docx_text",
    FileType.HTML: "html_text",
    FileType.IMAGE: "image_ocr",
    FileType.AUDIO: "audio_transcription",
    FileType.VIDEO: "video_parser",
}

FALLBACK_BY_PRIMARY: dict[str, str] = {
    "pdf_native_text": "azure_document_intelligence",
    "azure_document_intelligence": "mock_vlm",
    "tesseract_ocr": "mock_vlm",
    "image_ocr": "mock_vlm",
}

COST_PENALTIES: dict[CostProfile, dict[CostLevel, float]] = {
    CostProfile.LOW_COST: {CostLevel.LOW: 0.0, CostLevel.MEDIUM: 0.12, CostLevel.HIGH: 0.28},
    CostProfile.BALANCED: {CostLevel.LOW: 0.0, CostLevel.MEDIUM: 0.06, CostLevel.HIGH: 0.12},
    CostProfile.PREMIUM: {CostLevel.LOW: 0.0, CostLevel.MEDIUM: 0.02, CostLevel.HIGH: 0.04},
}

LATENCY_PENALTIES: dict[LatencyProfile, dict[LatencyLevel, float]] = {
    LatencyProfile.REAL_TIME: {
        LatencyLevel.LOW: 0.0,
        LatencyLevel.MEDIUM: 0.15,
        LatencyLevel.HIGH: 0.32,
    },
    LatencyProfile.INTERACTIVE: {
        LatencyLevel.LOW: 0.0,
        LatencyLevel.MEDIUM: 0.06,
        LatencyLevel.HIGH: 0.16,
    },
    LatencyProfile.BATCH: {
        LatencyLevel.LOW: 0.0,
        LatencyLevel.MEDIUM: 0.02,
        LatencyLevel.HIGH: 0.05,
    },
}

QUALITY_MULTIPLIERS: dict[QualityTarget, float] = {
    QualityTarget.LOW: 0.85,
    QualityTarget.BALANCED: 1.0,
    QualityTarget.HIGH: 1.12,
}


@dataclass(frozen=True)
class ScoredParser:
    parser: ParserDefinition
    breakdown: ParserScoreBreakdown


class ParserSelector:
    def plan(
        self,
        db: Session,
        *,
        file_profile: FileProfile,
        requested_output_contract: dict[str, object],
        quality_target: QualityTarget,
        cost_profile: CostProfile,
        latency_profile: LatencyProfile,
        governance_constraints: dict[str, object],
    ) -> ParserSelectionResponse:
        candidates = parser_registry.find_candidate_parsers(db, file_profile)
        candidates = self._augment_candidates_for_selection(db, file_profile, candidates)
        if not candidates:
            raise ValueError("No candidate parsers are available for this file profile")

        scored = [
            self._score_parser(
                parser,
                file_profile=file_profile,
                requested_output_contract=requested_output_contract,
                quality_target=quality_target,
                cost_profile=cost_profile,
                latency_profile=latency_profile,
                governance_constraints=governance_constraints,
            )
            for parser in candidates
        ]
        scored.sort(key=lambda item: item.breakdown.total_score, reverse=True)

        primary = self._choose_primary(file_profile, scored, quality_target)
        fallback = self._choose_fallback(
            db,
            primary.parser,
            scored,
            file_profile,
            governance_constraints,
        )
        secondary = self._choose_secondary(primary.parser, fallback, scored)
        skill_id = self._infer_skill(db, file_profile, requested_output_contract)

        return ParserSelectionResponse(
            file_id=file_profile.file_id,
            primary_parser_id=primary.parser.parser_id,
            fallback_parser_id=fallback.parser_id if fallback else None,
            secondary_parser_id=secondary.parser_id if secondary else None,
            selected_skill_id=skill_id,
            decision_score=round(primary.breakdown.total_score, 4),
            decision_explanation=self._explain_decision(
                file_profile=file_profile,
                primary=primary.parser,
                fallback=fallback,
                secondary=secondary,
                skill_id=skill_id,
            ),
            score_breakdown=[item.breakdown for item in scored],
        )

    def _augment_candidates_for_selection(
        self,
        db: Session,
        file_profile: FileProfile,
        candidates: list[ParserDefinition],
    ) -> list[ParserDefinition]:
        candidate_ids = {candidate.parser_id for candidate in candidates}
        wanted_ids = set(candidate_ids)
        file_type = FileType(file_profile.file_type)

        if file_type == FileType.PDF:
            if file_profile.is_scanned:
                wanted_ids.update({"azure_document_intelligence", "tesseract_ocr", "mock_vlm"})
            else:
                wanted_ids.update({"pdf_native_text", "azure_document_intelligence"})
        elif file_type == FileType.IMAGE:
            wanted_ids.update({"image_ocr", "mock_vlm"})

        if not wanted_ids:
            return candidates

        return (
            db.query(ParserDefinition)
            .filter(ParserDefinition.parser_id.in_(wanted_ids))
            .filter(ParserDefinition.enabled.is_(True))
            .all()
        )

    def _score_parser(
        self,
        parser: ParserDefinition,
        *,
        file_profile: FileProfile,
        requested_output_contract: dict[str, object],
        quality_target: QualityTarget,
        cost_profile: CostProfile,
        latency_profile: LatencyProfile,
        governance_constraints: dict[str, object],
    ) -> ScoredParser:
        expected_quality_score = min(
            1.0,
            parser.expected_quality * QUALITY_MULTIPLIERS[quality_target],
        )
        cost_penalty = COST_PENALTIES[cost_profile][CostLevel(parser.cost_level)]
        latency_penalty = LATENCY_PENALTIES[latency_profile][LatencyLevel(parser.latency_level)]
        risk_penalty = self._risk_penalty(
            parser,
            file_profile=file_profile,
            requested_output_contract=requested_output_contract,
            governance_constraints=governance_constraints,
        )
        historical_success_bonus = 0.0
        total_score = (
            expected_quality_score
            - cost_penalty
            - latency_penalty
            - risk_penalty
            + historical_success_bonus
        )

        return ScoredParser(
            parser=parser,
            breakdown=ParserScoreBreakdown(
                parser_id=parser.parser_id,
                expected_quality_score=round(expected_quality_score, 4),
                cost_penalty=round(cost_penalty, 4),
                latency_penalty=round(latency_penalty, 4),
                risk_penalty=round(risk_penalty, 4),
                historical_success_bonus=historical_success_bonus,
                total_score=round(total_score, 4),
            ),
        )

    def _risk_penalty(
        self,
        parser: ParserDefinition,
        *,
        file_profile: FileProfile,
        requested_output_contract: dict[str, object],
        governance_constraints: dict[str, object],
    ) -> float:
        penalty = 0.0
        file_type = FileType(file_profile.file_type)
        modalities = {Modality(modality) for modality in file_profile.modalities}

        if (
            file_type == FileType.PDF
            and file_profile.is_scanned
            and parser.parser_id == "pdf_native_text"
        ):
            penalty += 0.55
        if file_type == FileType.PDF and not file_profile.is_scanned and parser.parser_id in {
            "tesseract_ocr",
            "mock_vlm",
        }:
            penalty += 0.18
        if file_type == FileType.IMAGE and parser.parser_id == "pdf_native_text":
            penalty += 0.5
        if Modality.TABLE in modalities and "table" not in parser.supported_modalities:
            penalty += 0.08
        if (
            requested_output_contract.get("tables") is True
            and "table" not in parser.supported_modalities
        ):
            penalty += 0.08
        if governance_constraints.get("external_services_allowed") is False:
            if parser.deployment_mode == "external":
                penalty += 0.35
        if governance_constraints.get("requires_explainability") is True:
            if parser.parser_id in {"mock_vlm"}:
                penalty += 0.18
        return penalty

    def _choose_primary(
        self,
        file_profile: FileProfile,
        scored: list[ScoredParser],
        quality_target: QualityTarget,
    ) -> ScoredParser:
        by_id = {item.parser.parser_id: item for item in scored}
        file_type = FileType(file_profile.file_type)

        if file_type == FileType.PDF:
            if file_profile.is_scanned:
                if quality_target == QualityTarget.HIGH and "azure_document_intelligence" in by_id:
                    azure = by_id["azure_document_intelligence"]
                    tesseract = by_id.get("tesseract_ocr")
                    if tesseract is None:
                        return azure
                    if azure.breakdown.total_score >= tesseract.breakdown.total_score:
                        return azure
                if "tesseract_ocr" in by_id:
                    return by_id["tesseract_ocr"]
                if "azure_document_intelligence" in by_id:
                    return by_id["azure_document_intelligence"]
            elif "pdf_native_text" in by_id:
                return by_id["pdf_native_text"]

        preferred = PREFERRED_PRIMARY_BY_FILE_TYPE.get(file_type)
        if preferred and preferred in by_id:
            return by_id[preferred]

        return scored[0]

    def _choose_fallback(
        self,
        db: Session,
        primary: ParserDefinition,
        scored: list[ScoredParser],
        file_profile: FileProfile,
        governance_constraints: dict[str, object],
    ) -> ParserDefinition | None:
        scored_by_id = {
            item.parser.parser_id: item.parser
            for item in scored
            if self._fallback_allowed(item.parser, governance_constraints)
        }
        preferred_id = FALLBACK_BY_PRIMARY.get(primary.parser_id)
        if preferred_id and preferred_id in scored_by_id:
            return scored_by_id[preferred_id]

        if preferred_id:
            preferred = db.get(ParserDefinition, preferred_id)
            if (
                preferred is not None
                and preferred.enabled
                and self._fallback_allowed(preferred, governance_constraints)
            ):
                return preferred

        if (
            FileType(file_profile.file_type) == FileType.PDF
            and primary.parser_id == "pdf_native_text"
        ):
            fallback = db.get(ParserDefinition, "azure_document_intelligence")
            if (
                fallback is not None
                and fallback.enabled
                and self._fallback_allowed(fallback, governance_constraints)
            ):
                return fallback

        for item in scored:
            if item.parser.parser_id != primary.parser_id and self._fallback_allowed(
                item.parser, governance_constraints
            ):
                return item.parser
        return None

    def _fallback_allowed(
        self,
        parser: ParserDefinition,
        governance_constraints: dict[str, object],
    ) -> bool:
        if governance_constraints.get("external_services_allowed") is False:
            return parser.deployment_mode != "external"
        return True

    def _choose_secondary(
        self,
        primary: ParserDefinition,
        fallback: ParserDefinition | None,
        scored: list[ScoredParser],
    ) -> ParserDefinition | None:
        excluded = {primary.parser_id}
        if fallback is not None:
            excluded.add(fallback.parser_id)

        for item in scored:
            if item.parser.parser_id not in excluded:
                return item.parser
        return None

    def _infer_skill(
        self,
        db: Session,
        file_profile: FileProfile,
        requested_output_contract: dict[str, object],
    ) -> str | None:
        requested_skill = requested_output_contract.get("skill_id")
        if isinstance(requested_skill, str) and db.get(SkillDefinition, requested_skill):
            return requested_skill

        if requested_output_contract.get("tables") is True:
            return self._first_enabled_skill(db, "table_normalization")
        if requested_output_contract.get("knowledge_graph") is True:
            return self._first_enabled_skill(db, "knowledge_graph_preparation")
        if requested_output_contract.get("invoice") is True:
            return self._first_enabled_skill(db, "invoice_extraction")

        file_type = FileType(file_profile.file_type)
        if file_type in {FileType.AUDIO, FileType.VIDEO}:
            return self._first_enabled_skill(db, "audio_meeting_parsing")
        return None

    def _first_enabled_skill(self, db: Session, skill_id: str) -> str | None:
        skill = db.get(SkillDefinition, skill_id)
        if skill is None or not skill.enabled:
            return None
        return skill.skill_id

    def _explain_decision(
        self,
        *,
        file_profile: FileProfile,
        primary: ParserDefinition,
        fallback: ParserDefinition | None,
        secondary: ParserDefinition | None,
        skill_id: str | None,
    ) -> str:
        parts = [
            f"Selected {primary.name} for {file_profile.file_type} profile",
            f"using expected quality {primary.expected_quality:.2f}",
        ]
        if file_profile.is_scanned is True:
            parts.append("with scanned-document handling prioritized")
        elif file_profile.has_text_layer is True:
            parts.append("with text-layer extraction prioritized")
        if fallback is not None:
            parts.append(f"fallback is {fallback.name}")
        if secondary is not None:
            parts.append(f"secondary parser is {secondary.name}")
        if skill_id is not None:
            parts.append(f"inferred skill {skill_id}")
        return "; ".join(parts) + "."


parser_selector = ParserSelector()
