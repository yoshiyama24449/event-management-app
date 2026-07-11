from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db, EventModel, UserModel, EventRegistrationModel
from ..schemas import RegistrationCreate, RegistrationResponse
from ..utils import get_current_user_name

router = APIRouter(prefix="/events/{event_id}/register", tags=["Registrations"])


@router.post(
    "", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED
)
def register_event(
    event_id: int,
    registration: RegistrationCreate,
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_user_name),
):
    """イベントへの参加登録またはブックマークを行うAPI（定員チェック付き）"""

    # 1. ログイン中のユーザー情報を取得
    user = db.query(UserModel).filter(UserModel.username == current_username).first()
    if not user:
        raise HTTPException(status_code=401, detail="ユーザー情報が見つかりません。")

    # 2. 対象のイベントが存在するかチェック
    event = db.query(EventModel).filter(EventModel.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=404, detail="指定されたイベントが見つかりません。"
        )

    # 3. すでに登録（参加 or ブックマーク）しているか確認
    existing_reg = (
        db.query(EventRegistrationModel)
        .filter(
            EventRegistrationModel.user_id == user.id,
            EventRegistrationModel.event_id == event_id,
        )
        .first()
    )

    # 💡 参加申請（attending）の場合のみ、定員チェックを行う
    if registration.status == "attending":
        # 現在の「参加者数（attending）」をカウントする（ブックマークは除外）
        current_attendees = (
            db.query(EventRegistrationModel)
            .filter(
                EventRegistrationModel.event_id == event_id,
                EventRegistrationModel.status == "attending",
            )
            .count()
        )

        # 既に自分が参加中でステータス更新がない場合はスキップするが、
        # 新規参加、またはブックマークから参加への切り替え時に定員オーバーなら弾く
        is_switching_to_attend = not existing_reg or existing_reg.status != "attending"
        if is_switching_to_attend and current_attendees >= event.capacity:
            raise HTTPException(
                status_code=400,
                detail="定員に達しているため、このイベントには参加登録できません。",
            )

    # 4. データの保存（上書き または 新規作成）
    if existing_reg:
        # すでにレコードがあれば、ステータスを更新（例：ブックマーク ➔ 参加など）
        existing_reg.status = registration.status
        db.commit()
        db.refresh(existing_reg)
        return existing_reg
    else:
        # 新規登録
        new_reg = EventRegistrationModel(
            user_id=user.id, event_id=event_id, status=registration.status
        )
        db.add(new_reg)
        db.commit()
        db.refresh(new_reg)
        return new_reg


@router.delete("", status_code=status.HTTP_200_OK)
def unregister_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_user_name),
):
    """イベントの参加登録またはブックマークをキャンセル（削除）するAPI"""

    user = db.query(UserModel).filter(UserModel.username == current_username).first()
    if not user:
        raise HTTPException(status_code=401, detail="ユーザー情報が見つかりません。")

    # 自分の登録データを検索
    reg = (
        db.query(EventRegistrationModel)
        .filter(
            EventRegistrationModel.user_id == user.id,
            EventRegistrationModel.event_id == event_id,
        )
        .first()
    )

    if not reg:
        raise HTTPException(
            status_code=404,
            detail="このイベントには参加登録またはブックマークしていません。",
        )

    db.delete(reg)
    db.commit()
    return {"status": "success", "message": "イベントの登録をキャンセルしました。"}
