# app/schemas.py
from app.database import get_jst_now
from pydantic import BaseModel, field_validator, Field, ConfigDict, computed_field
from datetime import datetime
from typing import Literal, List

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
    # 💡 追記：タグ文字列のリストを基本構造に含める
    tags: List[str] = Field(default=[], description="イベントに紐付くタグ名リスト")


class EventCreate(EventBase):
    @field_validator("end_time")
    @classmethod
    def check_dates(cls, end_time: datetime, info):
        start_time = info.data.get("start_time")
        if start_time:
            # 1. 開始日時が現在時刻（日本時間）より未来かチェック
            if start_time < get_jst_now():
                raise ValueError("開始日時には現在より未来の日時を指定してください。")
            # 2. 終了時刻が開始時刻より後かチェック
            if end_time < start_time:
                raise ValueError("終了日時は開始日時より後の時間を指定してください。")
        return end_time


class EventUpdate(EventBase):
    # 💡 更新時も同様のルールを適用させる
    @field_validator("end_time")
    @classmethod
    def check_dates(cls, end_time: datetime, info):
        start_time = info.data.get("start_time")
        if start_time:
            if start_time < get_jst_now():
                raise ValueError("開始日時には現在より未来の日時を指定してください。")
            if end_time < start_time:
                raise ValueError("終了日時は開始日時より後の時間を指定してください。")
        return end_time


# 💡 追記：レスポンス時にタグオブジェクトのネストを文字列リストに変換するためのカスタムモデル
class TagResponse(BaseModel):
    name: str
    model_config = ConfigDict(from_attributes=True)


class EventResponse(EventBase):
    id: int
    creator_id: (
        int  # 👈 💡 これを追記して、作成者ユーザーIDをフロントに返すようにします！
    )
    created_at: datetime

    # 💡 追記: 現在の参加者数を返すフィールドを追加（デフォルト0）
    attendee_count: int = 0

    # 💡 イベントに紐付いているタグのリストを解決する設定
    tags: List[TagResponse] = []

    # 💡 クライアントが扱いやすいシンプルな ["Python", "AWS"] 形式の配列を取り出せる計算フィールド
    @computed_field
    def tag_names(self) -> List[str]:
        return [t.name for t in self.tags]

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
    username: str
    parent_id: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- ダッシュボード用のPydanticモデル ---


class DashboardCreatedEvent(BaseModel):
    id: int
    title: int | str  # タイトル
    capacity: int
    attendee_count: int  # 参加人数
    attendees: list[str]
    comment_count: int  # コメント件数


# 自分のコメントとそれに対する返信のセット
class MyCommentActivity(BaseModel):
    comment_id: int
    event_id: int
    event_title: str
    my_content: str
    replies: list[str]  # 自分への返信内容のリスト


class DashboardCalendarEvent(BaseModel):
    id: int
    title: str
    start_time: datetime
    end_time: datetime
    status: str  # 'attending' または 'bookmark'


class DashboardResponse(BaseModel):
    # 1. 自分が作成したイベント一覧（簡易統計付き）
    created_events: list[DashboardCreatedEvent]
    # 2. カレンダー表示用（自分が参加予定・またはブックマークしたイベント）
    calendar_events: list[DashboardCalendarEvent]
    # 3. 自分が投稿したコメントと、それに対する返信のセット
    my_comments: list[MyCommentActivity]

    model_config = ConfigDict(from_attributes=True)
