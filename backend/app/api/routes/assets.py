from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.domain import ParsedAsset
from backend.app.schemas.domain import ParsedAssetRead

router = APIRouter(prefix="/assets")


@router.get("/{asset_id}", response_model=ParsedAssetRead)
def get_asset(asset_id: str, db: Session = Depends(get_db)) -> ParsedAssetRead:
    asset = db.get(ParsedAsset, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset

