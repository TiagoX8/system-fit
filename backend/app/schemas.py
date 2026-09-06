from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserBase(BaseModel):
    email: EmailStr
    name: str | None = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class WorkoutBase(BaseModel):
    title: str
    description: str | None = None
    scheduled_time: time
    days_of_week: list[int] = []

    @field_validator("days_of_week", mode="before")
    @classmethod
    def validate_days(cls, days: object) -> list[int]:
        if isinstance(days, str):
            days = [int(part) for part in days.split(",") if part.strip()]

        if not isinstance(days, list):
            raise ValueError("days_of_week precisa ser uma lista de inteiros")

        days = [int(day) for day in days]

        for day in days:
            if day < 0 or day > 6:
                raise ValueError("days_of_week aceita apenas valores de 0 (seg) a 6 (dom)")

        return sorted(set(days))


class WorkoutCreate(WorkoutBase):
    pass


class WorkoutUpdate(WorkoutBase):
    pass


class WorkoutResponse(WorkoutBase):
    id: int
    user_id: int
    created_at: datetime
    completed_today: bool = False

    model_config = ConfigDict(from_attributes=True)


class WorkoutLogResponse(BaseModel):
    id: int
    user_id: int
    workout_id: int
    date: date
    completed: bool
    completed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class RewardBase(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    threshold_weeks: int = Field(ge=1, le=104)


class RewardCreate(RewardBase):
    pass


class RewardUpdate(RewardBase):
    pass


class RewardResponse(BaseModel):
    id: int
    title: str
    description: str | None
    threshold_weeks: int
    unlocked: bool
    unlocked_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class PunishmentBase(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    threshold_streak: int = Field(ge=1, le=60)


class PunishmentCreate(PunishmentBase):
    pass


class PunishmentUpdate(PunishmentBase):
    pass


class PunishmentResponse(BaseModel):
    id: int
    title: str
    description: str | None
    threshold_streak: int
    unlocked: bool
    unlocked_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class ProgressResponse(BaseModel):
    current_streak: int
    longest_streak: int
    xp: int
    rank: str
    next_rank: str | None
    xp_to_next_rank: int | None
    weeks_completed: int
    last_completed_date: date | None
    rewards: list[RewardResponse]
    punishments: list[PunishmentResponse]


class CompleteWorkoutResponse(BaseModel):
    log: WorkoutLogResponse
    progress: ProgressResponse
    message: str
    unlocked_rewards: list[RewardResponse]


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


class PushSubscriptionResponse(BaseModel):
    id: int
    endpoint: str

    model_config = ConfigDict(from_attributes=True)


class VapidPublicKeyResponse(BaseModel):
    public_key: str | None


class CoachMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1000)


class CoachRequest(BaseModel):
    messages: list[CoachMessage] = Field(min_length=1, max_length=20)

    @field_validator("messages")
    @classmethod
    def last_must_be_user(cls, messages: list["CoachMessage"]) -> list["CoachMessage"]:
        if messages[-1].role != "user":
            raise ValueError("a última mensagem precisa ser do usuário")

        return messages


class CoachResponse(BaseModel):
    reply: str
    remaining_today: int


class CoachStatusResponse(BaseModel):
    enabled: bool
    messages_per_day: int
