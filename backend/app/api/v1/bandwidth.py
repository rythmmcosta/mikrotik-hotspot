from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import require_admin
from app.db.models.bandwidth_profile import BandwidthProfile
from app.db.models.user import User
from app.schemas.bandwidth import BandwidthProfileCreate, BandwidthProfileResponse, BandwidthProfileUpdate

router = APIRouter(prefix="/bandwidth-profiles", tags=["bandwidth"])


@router.get("", response_model=list[BandwidthProfileResponse])
async def list_profiles(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(BandwidthProfile).where(BandwidthProfile.is_active == True))
    return list(result.scalars())


@router.post("", response_model=BandwidthProfileResponse, status_code=201)
async def create_profile(
    body: BandwidthProfileCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    profile = BandwidthProfile(**body.model_dump())
    db.add(profile)
    await db.flush()
    return profile


@router.put("/{profile_id}", response_model=BandwidthProfileResponse)
async def update_profile(
    profile_id: int,
    body: BandwidthProfileUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(BandwidthProfile).where(BandwidthProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        from app.core.exceptions import NotFoundException
        raise NotFoundException()
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(profile, k, v)
    return profile


@router.delete("/{profile_id}")
async def delete_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(BandwidthProfile).where(BandwidthProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        from app.core.exceptions import NotFoundException
        raise NotFoundException()
    profile.is_active = False
    return {"message": "Profile deactivated"}


@router.post("/{profile_id}/sync")
async def sync_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(BandwidthProfile).where(BandwidthProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        from app.core.exceptions import NotFoundException
        raise NotFoundException()
    from app.mikrotik import hotspot_manager
    rate = f"{profile.rate_limit_rx}/{profile.rate_limit_tx}"
    try:
        await hotspot_manager.add_profile(profile.name, rate)
        profile.mikrotik_profile_name = profile.name
    except Exception as exc:
        return {"message": f"Sync failed: {exc}"}
    return {"message": "Profile synced to MikroTik"}
