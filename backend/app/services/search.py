from datetime import datetime

from sqlalchemy.orm import Session

from backend.app.models.domain import (
    AgentTask,
    FileRecord,
    ParsedAsset,
    ParseJob,
    ParserDefinition,
    ReviewItem,
    SkillDefinition,
)
from backend.app.schemas.search import SearchResponse, SearchResult


class GlobalSearchService:
    """Small DB-backed search across the parser-agent workspace."""

    def search(
        self,
        db: Session,
        *,
        query: str,
        types: list[str] | None = None,
        limit: int = 20,
    ) -> SearchResponse:
        normalized_query = query.strip().lower()
        selected_types = {item.strip().lower() for item in types or [] if item.strip()}
        results: list[SearchResult] = []

        collectors = {
            "agent_task": self._agent_tasks,
            "file": self._files,
            "job": self._jobs,
            "asset": self._assets,
            "parser": self._parsers,
            "skill": self._skills,
            "review_item": self._review_items,
        }
        for result_type, collector in collectors.items():
            if selected_types and result_type not in selected_types:
                continue
            results.extend(collector(db, normalized_query, limit))

        ranked = sorted(
            results,
            key=lambda item: (
                item.score,
                item.created_at or datetime.min,
                item.title.lower(),
            ),
            reverse=True,
        )
        return SearchResponse(query=query, total=len(ranked), results=ranked[:limit])

    def _agent_tasks(self, db: Session, query: str, limit: int) -> list[SearchResult]:
        tasks = db.query(AgentTask).order_by(AgentTask.updated_at.desc()).limit(limit * 2).all()
        return [
            SearchResult(
                id=task.id,
                type="agent_task",
                title=task.title,
                subtitle=task.summary,
                status=task.status,
                href=f"/jobs/{task.job_id}" if task.job_id else "/parse",
                score=self._score(
                    query,
                    task.id,
                    task.title,
                    task.summary,
                    task.status,
                    task.file_id,
                    task.job_id,
                    task.requested_output_contract,
                    task.input_payload,
                ),
                metadata={
                    "task_id": task.id,
                    "file_id": task.file_id,
                    "job_id": task.job_id,
                    "attempt_count": task.attempt_count,
                },
                created_at=task.created_at,
            )
            for task in tasks
            if self._matches(
                query,
                task.id,
                task.title,
                task.summary,
                task.status,
                task.file_id,
                task.job_id,
                task.requested_output_contract,
                task.input_payload,
            )
        ]

    def _files(self, db: Session, query: str, limit: int) -> list[SearchResult]:
        files = db.query(FileRecord).order_by(FileRecord.uploaded_at.desc()).limit(limit * 2).all()
        return [
            SearchResult(
                id=file_record.id,
                type="file",
                title=file_record.original_filename,
                subtitle=f"{file_record.file_type.upper()} · {file_record.mime_type}",
                status=file_record.status,
                href=f"/assets?file_id={file_record.id}",
                score=self._score(
                    query,
                    file_record.id,
                    file_record.original_filename,
                    file_record.file_type,
                    file_record.mime_type,
                    file_record.checksum_sha256,
                    file_record.source,
                    file_record.created_by,
                ),
                metadata={
                    "file_id": file_record.id,
                    "file_type": file_record.file_type,
                    "size_bytes": file_record.size_bytes,
                },
                created_at=file_record.uploaded_at,
            )
            for file_record in files
            if self._matches(
                query,
                file_record.id,
                file_record.original_filename,
                file_record.file_type,
                file_record.mime_type,
                file_record.checksum_sha256,
                file_record.source,
                file_record.created_by,
            )
        ]

    def _jobs(self, db: Session, query: str, limit: int) -> list[SearchResult]:
        jobs = db.query(ParseJob).order_by(ParseJob.updated_at.desc()).limit(limit * 2).all()
        return [
            SearchResult(
                id=job.id,
                type="job",
                title=f"Parse job {self._short_id(job.id)}",
                subtitle=(
                    f"Parser {job.parser_id or 'pending'} · "
                    f"File {self._short_id(job.file_id)}"
                ),
                status=job.status,
                href=f"/jobs/{job.id}",
                score=self._score(
                    query,
                    job.id,
                    job.file_id,
                    job.status,
                    job.parser_id,
                    job.skill_id,
                    job.quality_status,
                ),
                metadata={
                    "job_id": job.id,
                    "file_id": job.file_id,
                    "parser_id": job.parser_id,
                    "skill_id": job.skill_id,
                    "quality_status": job.quality_status,
                },
                created_at=job.created_at,
            )
            for job in jobs
            if self._matches(
                query,
                job.id,
                job.file_id,
                job.status,
                job.parser_id,
                job.skill_id,
                job.quality_status,
            )
        ]

    def _assets(self, db: Session, query: str, limit: int) -> list[SearchResult]:
        assets = (
            db.query(ParsedAsset)
            .order_by(ParsedAsset.created_at.desc())
            .limit(limit * 2)
            .all()
        )
        return [
            SearchResult(
                id=asset.id,
                type="asset",
                title=f"{asset.asset_type.title()} asset {self._short_id(asset.id)}",
                subtitle=f"Parser {asset.parser_used} · Job {self._short_id(asset.job_id)}",
                status="published",
                href=f"/assets/{asset.id}",
                score=self._score(
                    query,
                    asset.id,
                    asset.job_id,
                    asset.file_id,
                    asset.asset_type,
                    asset.parser_used,
                    asset.skill_used,
                    asset.parsed_text,
                    asset.document_metadata,
                    asset.structured_data,
                    asset.entities,
                    asset.relationships,
                ),
                metadata={
                    "asset_id": asset.id,
                    "job_id": asset.job_id,
                    "file_id": asset.file_id,
                    "parser_used": asset.parser_used,
                    "skill_used": asset.skill_used,
                },
                created_at=asset.created_at,
            )
            for asset in assets
            if self._matches(
                query,
                asset.id,
                asset.job_id,
                asset.file_id,
                asset.asset_type,
                asset.parser_used,
                asset.skill_used,
                asset.parsed_text,
                asset.document_metadata,
                asset.structured_data,
                asset.entities,
                asset.relationships,
            )
        ]

    def _parsers(self, db: Session, query: str, limit: int) -> list[SearchResult]:
        parsers = (
            db.query(ParserDefinition)
            .order_by(ParserDefinition.name.asc())
            .limit(limit * 2)
            .all()
        )
        return [
            SearchResult(
                id=parser.parser_id,
                type="parser",
                title=parser.name,
                subtitle=f"{parser.parser_type} · {parser.deployment_mode}",
                status="enabled" if parser.enabled else "disabled",
                href=f"/parsers?parser_id={parser.parser_id}",
                score=self._score(
                    query,
                    parser.parser_id,
                    parser.name,
                    parser.parser_type,
                    parser.deployment_mode,
                    parser.supported_file_types,
                    parser.supported_modalities,
                    parser.strengths,
                    parser.weaknesses,
                ),
                metadata={
                    "parser_id": parser.parser_id,
                    "parser_type": parser.parser_type,
                    "deployment_mode": parser.deployment_mode,
                    "expected_quality": parser.expected_quality,
                },
                created_at=parser.created_at,
            )
            for parser in parsers
            if self._matches(
                query,
                parser.parser_id,
                parser.name,
                parser.parser_type,
                parser.deployment_mode,
                parser.supported_file_types,
                parser.supported_modalities,
                parser.strengths,
                parser.weaknesses,
            )
        ]

    def _skills(self, db: Session, query: str, limit: int) -> list[SearchResult]:
        skills = (
            db.query(SkillDefinition)
            .order_by(SkillDefinition.name.asc())
            .limit(limit * 2)
            .all()
        )
        return [
            SearchResult(
                id=skill.skill_id,
                type="skill",
                title=skill.name,
                subtitle=skill.description,
                status="enabled" if skill.enabled else "disabled",
                href=f"/skills?skill_id={skill.skill_id}",
                score=self._score(
                    query,
                    skill.skill_id,
                    skill.name,
                    skill.description,
                    skill.supported_document_types,
                    skill.extraction_schema,
                    skill.validation_rules,
                ),
                metadata={
                    "skill_id": skill.skill_id,
                    "supported_document_types": skill.supported_document_types,
                    "version": skill.version,
                },
                created_at=skill.created_at,
            )
            for skill in skills
            if self._matches(
                query,
                skill.skill_id,
                skill.name,
                skill.description,
                skill.supported_document_types,
                skill.extraction_schema,
                skill.validation_rules,
            )
        ]

    def _review_items(self, db: Session, query: str, limit: int) -> list[SearchResult]:
        items = db.query(ReviewItem).order_by(ReviewItem.updated_at.desc()).limit(limit * 2).all()
        return [
            SearchResult(
                id=item.id,
                type="review_item",
                title=f"Review {self._short_id(item.id)}",
                subtitle=item.reason,
                status=item.status,
                href="/review-queue",
                score=self._score(
                    query,
                    item.id,
                    item.job_id,
                    item.file_id,
                    item.status,
                    item.reason,
                    item.assigned_to,
                    item.resolution_notes,
                ),
                metadata={
                    "review_item_id": item.id,
                    "job_id": item.job_id,
                    "file_id": item.file_id,
                    "assigned_to": item.assigned_to,
                },
                created_at=item.created_at,
            )
            for item in items
            if self._matches(
                query,
                item.id,
                item.job_id,
                item.file_id,
                item.status,
                item.reason,
                item.assigned_to,
                item.resolution_notes,
            )
        ]

    def _matches(self, query: str, *values: object) -> bool:
        if not query:
            return True
        return query in self._haystack(*values)

    def _score(self, query: str, *values: object) -> float:
        if not query:
            return 0.1
        tokens = [token for token in query.split() if token]
        haystack = self._haystack(*values)
        exact_matches = sum(1 for value in values if str(value or "").lower() == query)
        token_matches = sum(1 for token in tokens if token in haystack)
        substring_bonus = 1 if query in haystack else 0
        return exact_matches * 10 + token_matches * 2 + substring_bonus

    def _haystack(self, *values: object) -> str:
        return " ".join(self._stringify(value) for value in values if value is not None).lower()

    def _stringify(self, value: object) -> str:
        if isinstance(value, (dict, list, tuple, set)):
            return str(value)
        return str(value)

    def _short_id(self, value: str | None) -> str:
        if not value:
            return "pending"
        return value[:8]


global_search_service = GlobalSearchService()
