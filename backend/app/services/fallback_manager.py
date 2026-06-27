from backend.app.models.domain import ParserExecutionResult


class FallbackManager:
    def should_fallback(
        self,
        *,
        quality_threshold: float,
        result: ParserExecutionResult,
        fallback_parser_id: str | None,
    ) -> bool:
        if fallback_parser_id is None:
            return False
        return (result.confidence_score or 0.0) < quality_threshold

    def choose_best_result(
        self,
        results: list[ParserExecutionResult],
    ) -> ParserExecutionResult:
        return max(results, key=lambda result: result.confidence_score or 0.0)


fallback_manager = FallbackManager()

