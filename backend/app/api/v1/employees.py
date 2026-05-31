from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import require_admin, get_client_ip
from app.db.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeListResponse, EmployeeResponse, EmployeeUpdate
from app.services import audit_service, employee_service
from fastapi import Request

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=EmployeeListResponse)
async def list_employees(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    items, total = await employee_service.list_employees(db, page, per_page, status)
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.post("", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    body: EmployeeCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    emp = await employee_service.create_employee(
        db, body.full_name, body.email, body.password, current_user,
        body.bandwidth_profile_id, body.notes
    )
    await audit_service.log_action(
        db, "employee.created", current_user, "employee", emp.id,
        {"email": emp.email}, get_client_ip(request)
    )
    return emp


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from sqlalchemy import select
    from app.db.models.employee import Employee
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        from app.core.exceptions import NotFoundException
        raise NotFoundException()
    return emp


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    body: EmployeeUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    emp = await employee_service.update_employee(
        db, employee_id,
        full_name=body.full_name,
        bandwidth_profile_id=body.bandwidth_profile_id,
        notes=body.notes,
    )
    await audit_service.log_action(db, "employee.updated", current_user, "employee", employee_id,
                                   None, get_client_ip(request))
    return emp


@router.delete("/{employee_id}", response_model=EmployeeResponse)
async def delete_employee(
    employee_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    emp = await employee_service.delete_employee(db, employee_id)
    await audit_service.log_action(db, "employee.deleted", current_user, "employee", employee_id,
                                   None, get_client_ip(request))
    return emp


@router.post("/{employee_id}/suspend", response_model=EmployeeResponse)
async def suspend_employee(
    employee_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    emp = await employee_service.suspend_employee(db, employee_id)
    await audit_service.log_action(db, "employee.suspended", current_user, "employee", employee_id,
                                   None, get_client_ip(request))
    return emp


@router.post("/{employee_id}/activate", response_model=EmployeeResponse)
async def activate_employee(
    employee_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    emp = await employee_service.activate_employee(db, employee_id)
    await audit_service.log_action(db, "employee.activated", current_user, "employee", employee_id,
                                   None, get_client_ip(request))
    return emp


@router.post("/{employee_id}/reset-password")
async def reset_password(
    employee_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    emp, new_pass = await employee_service.reset_password(db, employee_id)
    await audit_service.log_action(db, "employee.password_reset", current_user, "employee", employee_id,
                                   None, get_client_ip(request))
    return {"message": "Password reset", "new_hotspot_password": new_pass}
