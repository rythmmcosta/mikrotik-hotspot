import re
import secrets

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.security import decrypt_value, encrypt_value, hash_password
from app.db.models.employee import Employee
from app.db.models.user import User
from app.mikrotik import hotspot_manager
from app.mikrotik.exceptions import RouterOSConnectionError


def _make_hotspot_username(email: str) -> str:
    local = email.split("@")[0]
    clean = re.sub(r"[^a-zA-Z0-9._-]", "", local).lower()[:32]
    return clean or "user"


async def create_employee(
    db: AsyncSession,
    full_name: str,
    email: str,
    password: str,
    created_by: User,
    bandwidth_profile_id: int | None = None,
    notes: str | None = None,
) -> Employee:
    existing = await db.execute(select(Employee).where(Employee.email == email))
    if existing.scalar_one_or_none():
        raise ConflictException(f"Employee with email {email} already exists")

    base_username = _make_hotspot_username(email)
    username = base_username
    suffix = 1
    while True:
        dupe = await db.execute(select(Employee).where(Employee.hotspot_username == username))
        if not dupe.scalar_one_or_none():
            break
        username = f"{base_username}{suffix}"
        suffix += 1

    hotspot_pass = secrets.token_urlsafe(12)

    employee = Employee(
        full_name=full_name,
        email=email,
        password_hash=hash_password(password),
        hotspot_username=username,
        hotspot_password=encrypt_value(hotspot_pass),
        bandwidth_profile_id=bandwidth_profile_id,
        created_by=created_by.id,
        notes=notes,
    )
    db.add(employee)
    await db.flush()

    try:
        await hotspot_manager.add_user(
            username=username,
            password=hotspot_pass,
            profile="default",
            comment=f"db_id:{employee.id}",
        )
        employee.mikrotik_synced = True
    except RouterOSConnectionError:
        employee.mikrotik_synced = False

    return employee


async def update_employee(db: AsyncSession, employee_id: int, **fields) -> Employee:
    emp = await _get_or_404(db, employee_id)
    for k, v in fields.items():
        if v is not None:
            setattr(emp, k, v)
    return emp


async def suspend_employee(db: AsyncSession, employee_id: int) -> Employee:
    emp = await _get_or_404(db, employee_id)
    try:
        await hotspot_manager.disable_user(emp.hotspot_username)
    except RouterOSConnectionError:
        pass
    emp.status = "suspended"
    return emp


async def activate_employee(db: AsyncSession, employee_id: int) -> Employee:
    emp = await _get_or_404(db, employee_id)
    try:
        await hotspot_manager.enable_user(emp.hotspot_username)
    except RouterOSConnectionError:
        pass
    emp.status = "active"
    return emp


async def delete_employee(db: AsyncSession, employee_id: int) -> Employee:
    emp = await _get_or_404(db, employee_id)
    try:
        await hotspot_manager.remove_user(emp.hotspot_username)
    except RouterOSConnectionError:
        pass
    emp.status = "deleted"
    emp.mikrotik_synced = False
    return emp


async def reset_password(db: AsyncSession, employee_id: int) -> tuple[Employee, str]:
    emp = await _get_or_404(db, employee_id)
    new_pass = secrets.token_urlsafe(12)
    emp.hotspot_password = encrypt_value(new_pass)
    try:
        await hotspot_manager.set_interface  # no-op import guard
        pool = hotspot_manager.get_pool() if hasattr(hotspot_manager, "get_pool") else None
        # Use hotspot_manager directly
        from app.mikrotik.client import get_pool
        await get_pool().call("/ip/hotspot/user/set", **{
            "name": emp.hotspot_username, "password": new_pass
        })
    except Exception:
        pass
    return emp, new_pass


async def authenticate_employee(db: AsyncSession, email: str, password: str) -> dict | None:
    from app.core.security import verify_password as vp
    result = await db.execute(
        select(Employee).where(Employee.email == email, Employee.status == "active")
    )
    emp = result.scalar_one_or_none()
    if not emp or not vp(password, emp.password_hash):
        return None
    return {
        "hotspot_username": emp.hotspot_username,
        "hotspot_password": decrypt_value(emp.hotspot_password),
    }


async def list_employees(
    db: AsyncSession, page: int = 1, per_page: int = 20, status: str | None = None
) -> tuple[list[Employee], int]:
    q = select(Employee)
    cq = select(func.count(Employee.id))
    if status:
        q = q.where(Employee.status == status)
        cq = cq.where(Employee.status == status)
    q = q.offset((page - 1) * per_page).limit(per_page).order_by(Employee.created_at.desc())
    result = await db.execute(q)
    count = await db.execute(cq)
    return list(result.scalars()), count.scalar()


async def _get_or_404(db: AsyncSession, employee_id: int) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise NotFoundException(f"Employee {employee_id} not found")
    return emp
