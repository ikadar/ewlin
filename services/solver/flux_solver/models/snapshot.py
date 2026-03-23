"""Pydantic models matching the ScheduleSnapshot JSON format from the PHP API."""

from __future__ import annotations

from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Discriminator, Tag
from pydantic.alias_generators import to_camel


class FluxBase(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )


# --- Station-related models ---


class TimeSlot(FluxBase):
    start: str  # "HH:MM" (24-hour)
    end: str  # "HH:MM" (24-hour), allows "24:00"


class DaySchedule(FluxBase):
    is_operating: bool
    slots: list[TimeSlot]


class OperatingSchedule(FluxBase):
    monday: DaySchedule
    tuesday: DaySchedule
    wednesday: DaySchedule
    thursday: DaySchedule
    friday: DaySchedule
    saturday: DaySchedule
    sunday: DaySchedule


class ScheduleException(FluxBase):
    id: str
    date: str  # "YYYY-MM-DD"
    schedule: DaySchedule
    reason: Optional[str] = None


class SimilarityCriterion(FluxBase):
    code: str
    name: str
    field_path: str


class StationCategory(FluxBase):
    id: str
    name: str
    description: Optional[str] = None
    column_width: Optional[int] = None
    similarity_criteria: list[SimilarityCriterion] = []


class StationGroup(FluxBase):
    id: str
    name: str
    max_concurrent: Optional[int] = None
    is_outsourced_provider_group: bool


class Station(FluxBase):
    id: str
    name: str
    status: str = "Available"
    category_id: str = ""
    group_id: str = ""
    capacity: int = 1
    display_order: int = 0
    operating_schedule: Optional[OperatingSchedule] = None
    exceptions: list[ScheduleException] = []


class OutsourcedProvider(FluxBase):
    id: str
    name: str
    status: str  # 'Active' | 'Inactive'
    supported_action_types: list[str]
    latest_departure_time: str  # "HH:MM"
    reception_time: str  # "HH:MM"
    transit_days: int
    group_id: str


# --- Job / Element / Task models ---


class ElementSpec(FluxBase):
    format: Optional[str] = None
    papier: Optional[str] = None
    pagination: Optional[int] = None
    imposition: Optional[str] = None
    impression: Optional[str] = None
    surfacage: Optional[str] = None
    quantite: Optional[int] = None
    qte_feuilles: Optional[int] = None
    autres: Optional[str] = None
    commentaires: Optional[str] = None


class Element(FluxBase):
    id: str
    job_id: str
    name: str = ""
    label: Optional[str] = None
    prerequisite_element_ids: list[str] = []
    task_ids: list[str] = []
    spec: Optional[ElementSpec] = None
    paper_status: str = "none"
    bat_status: str = "none"
    plate_status: str = "none"
    forme_status: str = "none"
    paper_ordered_at: Optional[str] = None
    paper_delivered_at: Optional[str] = None
    files_received_at: Optional[str] = None
    bat_sent_at: Optional[str] = None
    bat_approved_at: Optional[str] = None
    forme_ordered_at: Optional[str] = None
    forme_delivered_at: Optional[str] = None
    is_blocked: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class Job(FluxBase):
    id: str
    reference: str = ""
    client: str = ""
    description: Optional[str] = None
    status: str = "Planned"
    workshop_exit_date: str = ""
    quantity: int = 0
    fully_scheduled: bool = False
    color: str = "#000000"
    paper_type: Optional[str] = None
    paper_format: Optional[str] = None
    paper_weight: Optional[int] = None
    inking: Optional[str] = None
    shipped: bool = False
    shipped_at: Optional[str] = None
    shipper_id: Optional[str] = None
    shipper_name: Optional[str] = None
    notes: Optional[str] = None
    required_job_ids: list[str] = []
    comments: list = []
    element_ids: list[str] = []
    task_ids: list[str] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class InternalDuration(FluxBase):
    setup_minutes: int = 0
    run_minutes: int = 0


class OutsourcedDuration(FluxBase):
    open_days: int = 1
    latest_departure_time: str = "14:00"
    reception_time: str = "09:00"


class _TaskBase(FluxBase):
    id: str
    element_id: str = ""
    job_id: str = ""
    sequence_order: int = 0
    status: str = "Defined"
    comment: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class InternalTask(_TaskBase):
    type: Literal["Internal"]
    station_id: str
    duration: InternalDuration
    split_group_id: Optional[str] = None
    split_index: Optional[int] = None
    split_total: Optional[int] = None
    original_run_minutes: Optional[int] = None


class OutsourcedTask(_TaskBase):
    type: Literal["Outsourced"]
    provider_id: str
    action_type: str
    duration: OutsourcedDuration


def _task_discriminator(v: dict | _TaskBase) -> str:
    if isinstance(v, dict):
        return v.get("type", "Internal")
    return getattr(v, "type", "Internal")


Task = Annotated[
    Union[
        Annotated[InternalTask, Tag("Internal")],
        Annotated[OutsourcedTask, Tag("Outsourced")],
    ],
    Discriminator(_task_discriminator),
]


# --- Assignment / Conflict models ---


class TaskAssignment(FluxBase):
    id: str
    task_id: str
    target_id: str = ""
    is_outsourced: bool = False
    scheduled_start: str = ""
    scheduled_end: str = ""
    is_completed: bool = False
    completed_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ScheduleConflict(FluxBase):
    type: str
    message: str
    task_id: str
    related_task_id: Optional[str] = None
    target_id: Optional[str] = None
    details: Optional[dict] = None


class LateJob(FluxBase):
    job_id: str
    deadline: str = ""
    expected_completion: str = ""
    delay_days: int = 0


# --- Root snapshot ---


class ScheduleSnapshot(FluxBase):
    version: int
    generated_at: str  # ISO datetime
    stations: list[Station]
    categories: list[StationCategory]
    groups: list[StationGroup]
    providers: list[OutsourcedProvider]
    jobs: list[Job]
    elements: list[Element]
    tasks: list[Task]
    assignments: list[TaskAssignment]
    conflicts: list[ScheduleConflict]
    late_jobs: list[LateJob]
    lookback_days: Optional[int] = None
