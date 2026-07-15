from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db, EventModel, UserModel, CommentModel
from ..schemas import CommentCreate, CommentResponse
from ..utils import get_current_user_name

router = APIRouter(prefix="/events/{event_id}/comments", tags=["Comments"])


@router.post("", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    event_id: int,
    comment: CommentCreate,
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_user_name),
):
    """イベントに対するコメント投稿、またはコメントへの返信を行うAPI"""

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

    # 3. 返信（parent_idがある）の場合、親コメントが実在するかチェック
    if comment.parent_id is not None:
        parent_comment = (
            db.query(CommentModel)
            .filter(
                CommentModel.id == comment.parent_id,
                CommentModel.event_id == event_id,
            )
            .first()
        )
        if not parent_comment:
            raise HTTPException(
                status_code=400, detail="返信対象のコメントが見つかりません。"
            )

        # 💡 追記：親コメントがすでに '返信（parent_idがNullでない）' の場合は400エラーにする
        if parent_comment.parent_id is not None:
            raise HTTPException(
                status_code=400,
                detail="返信に対してさらに返信することはできません（最大2階層まで）。",
            )

    # 4. コメントをデータベースに保存
    db_comment = CommentModel(
        content=comment.content,
        event_id=event_id,
        user_id=user.id,
        parent_id=comment.parent_id,
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)

    # =========================================================================
    # 💡 修正：CommentResponse が要求する型に合わせて辞書型を作り、username を明示する
    # =========================================================================
    return {
        "id": db_comment.id,
        "content": db_comment.content,
        "event_id": db_comment.event_id,
        "user_id": db_comment.user_id,
        "parent_id": db_comment.parent_id,
        "created_at": db_comment.created_at,
        "username": current_username,  # 👈 認証中のユーザー名を確実にセット
    }


@router.get("", response_model=List[CommentResponse])
def get_comments(
    event_id: int,
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_user_name),
):
    """特定のイベントに紐づくコメント・返信一覧を取得するAPI（古い順）"""

    # イベントの存在チェック
    event = db.query(EventModel).filter(EventModel.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=404, detail="指定されたイベントが見つかりません。"
        )

    # 💡 修正：relationshipを頼らず、手動でUserModelとJOINして直接usernameを持ってくる
    results = (
        db.query(CommentModel, UserModel.username)
        .join(UserModel, CommentModel.user_id == UserModel.id)
        .filter(CommentModel.event_id == event_id)
        .order_by(CommentModel.created_at.asc())
        .all()
    )

    # 💡 修正：取得した結果を辞書型に手動マッピングし、usernameを確実に詰め込む
    response_data = []
    for comment, uname in results:
        comment_dict = {
            "id": comment.id,
            "content": comment.content,
            "event_id": comment.event_id,
            "user_id": comment.user_id,
            "parent_id": comment.parent_id,
            "created_at": comment.created_at,
            "username": uname,  # 👈 ここで確実に実際の名前（'sato_jiro'など）が入る
        }
        response_data.append(comment_dict)

    return response_data
