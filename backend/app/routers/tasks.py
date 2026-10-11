"""Task & long-term goal endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud
from app.constants import TASK_KINDS, TASK_STATUS_KEYS
from app.database import get_session
from app.schemas import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _check(kind: str | None, status: str | None) -> None:
    if kind and kind not in TASK_KINDS:
        raise HTTPException(status_code=422, detail=f"unknown kind: {kind}")
    if status and status not in TASK_STATUS_KEYS:
        raise HTTPException(status_code=422, detail=f"unknown status: {status}")


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    kind: str | None = None,
    status: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[TaskOut]:
    _check(kind, status)
    return await crud.list_tasks(session, kind=kind, status=status)


@router.post("", response_model=TaskOut, status_code=201)
async def create_task(
    data: TaskCreate,
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    return await crud.create_task(session, data)


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: int, session: AsyncSession = Depends(get_session)) -> TaskOut:
    task = await crud.get_task(session, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int,
    data: TaskUpdate,
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    task = await crud.get_task(session, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    return await crud.update_task(session, task, data)


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: int, session: AsyncSession = Depends(get_session)) -> None:
    task = await crud.get_task(session, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    await crud.delete_task(session, task)
