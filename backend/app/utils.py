# app/utils.py
from pwdlib import PasswordHash
import jwt  # 📍 追加
from datetime import datetime, timedelta, timezone

pwd_context = PasswordHash.recommended()

# 📍 JWT用の設定（本番環境では環境変数から読み込むようにします）
SECRET_KEY = "super-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # トークンの有効期限（1時間）


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# 📍 追加：アクセストークンを作成する関数
def create_access_token(data: dict) -> str:
    """ユーザー情報を元に有効期限付きのJWTトークンを発行する"""
    to_encode = data.copy()

    # 有効期限を設定（現在時刻 + 60分）
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    # 暗号化してトークン（文字列）を作成
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status
import jwt

# フロントがトークンを「Authorization: Bearer <トークン>」というヘッダーで送ってくることを定義
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user_name(token: str = Depends(oauth2_scheme)) -> str:
    """JWTトークンを検証し、ログイン中のユーザー名を返す関数"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="ログイン認証に失敗しました。再度ログインしてください。",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # トークンをデコード（解読）
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except jwt.PyJWTError:
        raise credentials_exception
