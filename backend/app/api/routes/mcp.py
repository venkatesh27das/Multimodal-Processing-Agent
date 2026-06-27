from fastapi import APIRouter

from backend.app.mcp.server import mcp_server

router = APIRouter(prefix="/mcp")


@router.get("/tools")
def list_mcp_tools() -> dict[str, object]:
    return {"tools": mcp_server.list_tools()}

