from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


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


class RewardResponse(BaseModel):
    id: int
    title: str
    description: str | None
    threshold_weeks: int
    unlocked: bool
    unlocked_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


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
