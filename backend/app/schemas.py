# app/schemas.py
from pydantic import BaseModel, field_validator, Field, ConfigDict
from datetime import datetime
from typing import Literal

# =========================================================================
# Pydanticモデル（バリデーション ＆ データ構造の定義）
# =========================================================================


class EventBase(BaseModel):
    title: str
    description: str | None = None
    location: str | None = None
    capacity: int = Field(
        ..., gt=0, description="定員（1以上）"
    )  # 👈 追記（0より大きい整数）
    start_time: datetime  # フロントからは "2026-07-20T10:00:00+09:00" のようなISO形式
    end_time: datetime

    # 終了時刻が開始時刻より前になっていないかチェックするバリデーション
    @field_validator("end_time")
    @classmethod
    def check_dates(cls, end_time: datetime, info):
        start_time = info.data.get("start_time")
        if start_time and end_time < start_time:
            raise ValueError("終了日時は開始日時より後の時間を指定してください。")
        return end_time


class EventCreate(EventBase):
    pass


class EventUpdate(EventBase):
    pass


class EventResponse(EventBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- ユーザー用のPydanticモデル ---


class UserBase(BaseModel):
    username: str
    email: str


# ユーザー登録（サインアップ）時にフロントから送られてくるデータ
class UserCreate(UserBase):
    # 📍 Field(examples=[...]) を使って、流出リストにない独自の複雑なパスワードをデフォルト値に設定
    password: str = Field(..., examples=["Dev-EventApp-2026!#"])


# 画面にユーザー情報を返すときのデータ（⚠️絶対パスワードは含めない！）
class UserResponse(UserBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- イベント参加登録用のPydanticモデル ---


class RegistrationCreate(BaseModel):
    # statusは 'attending' か 'bookmark' のどちらかのみ許可する
    status: Literal["attending", "bookmark"]


class RegistrationResponse(BaseModel):
    id: int
    user_id: int
    event_id: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- コメント用のPydanticモデル ---


class CommentCreate(BaseModel):
    content: str
    parent_id: int | None = (
        None  # 💡 通常のコメントなら None、返信なら親コメントのIDを入れる
    )


class CommentResponse(BaseModel):
    id: int
    content: str
    event_id: int
    user_id: int
    parent_id: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
