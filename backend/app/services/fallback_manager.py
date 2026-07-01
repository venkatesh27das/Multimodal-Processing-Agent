from backend.app.models.domain import ParserExecutionResult


class FallbackManager:
    def should_fallback(
        self,
        *,
        quality_threshold: float,
        result: ParserExecutionResult,
        fallback_parser_id: str | None,
        fallback_policy: str | None = None,
        max_fallback_attempts: int | None = None,
    ) -> bool:
        if fallback_parser_id is None:
            return False
        if max_fallback_attempts is not None and max_fallback_attempts <= 0:
            return False
        if fallback_policy == "none":
            return False
        if fallback_policy == "aggressive":
            return True
        return (result.confidence_score or 0.0) < quality_threshold

    def choose_best_result(
        self,
        results: list[ParserExecutionResult],
    ) -> ParserExecutionResult:
        return max(results, key=lambda result: result.confidence_score or 0.0)


fallback_manager = FallbackManager()
