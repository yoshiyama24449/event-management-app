# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm  # 📍 追加
from sqlalchemy.orm import Session

from ..database import get_db, UserModel
from ..schemas import UserCreate, UserResponse
from ..utils import hash_password, verify_password, create_access_token  # 📍 追加

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    """ユーザー新規登録（サインアップ）用API"""

    # 1. すでに同じメールアドレスが登録されていないかチェック
    existing_email = db.query(UserModel).filter(UserModel.email == user.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に登録されています。",
        )

    # 2. すでに同じユーザー名が登録されていないかチェック
    existing_username = (
        db.query(UserModel).filter(UserModel.username == user.username).first()
    )
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このユーザー名は既に使われています。",
        )

    # 3. パスワードを安全にハッシュ化する
    hashed_pwd = hash_password(user.password)

    # 4. データベース用のモデルを作成
    db_user = UserModel(
        username=user.username, email=user.email, hashed_password=hashed_pwd
    )

    # 5. 保存
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user


# 📍 追加：ログイン（アクセストークン発行）API
@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    """ユーザー名とパスワードを検証し、JWTトークンを返すAPI"""

    # 1. ユーザー名でデータベースを検索 (OAuth2PasswordRequestForm の仕様上、一意の識別子は username カラムに入ります)
    user = db.query(UserModel).filter(UserModel.username == form_data.username).first()

    # 2. ユーザーが存在しない、またはパスワードが一致しない場合は401エラー
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ユーザー名またはパスワードが正しくありません。",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. 認証成功：JWTアクセストークンを作成（トークンの中にユーザー名を含める）
    access_token = create_access_token(data={"sub": user.username, "user_id": user.id})

    # 4. フロントエンド（Next.js）が扱いやすいWeb標準の形式でトークンを返す
    return {"access_token": access_token, "token_type": "bearer"}
