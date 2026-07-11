import pytest


def test_signup_success(client):
    """① サインアップ正常系: 新しいユーザーが正しく登録できること"""
    signup_data = {
        "username": "test_auth_user",
        "email": "auth_test@example.com",
        "password": "SecurePassword2026!",
    }

    response = client.post("/auth/signup", json=signup_data)
    assert response.status_code == 201

    data = response.json()
    assert data["username"] == "test_auth_user"
    assert data["email"] == "auth_test@example.com"
    assert "id" in data
    assert "hashed_password" not in data  # パスワードハッシュが漏洩していないこと


def test_signup_duplicate_email(client):
    """② サインアップ異常系: 既に存在するメールアドレスは登録できないこと"""
    signup_data = {
        "username": "user1",
        "email": "same@example.com",
        "password": "Password123!",
    }

    # 1回目の登録（成功）
    client.post("/auth/signup", json=signup_data)

    # 2回目の登録（別のユーザー名、同じメールアドレス ➔ 400エラー）
    signup_data["username"] = "user2"
    response = client.post("/auth/signup", json=signup_data)

    assert response.status_code == 400
    assert response.json()["detail"] == "このメールアドレスは既に登録されています。"


def test_signup_duplicate_username(client):
    """③ サインアップ異常系: 既に存在するユーザー名は登録できないこと"""
    signup_data = {
        "username": "same_user",
        "email": "user1@example.com",
        "password": "Password123!",
    }

    # 1回目の登録（成功）
    client.post("/auth/signup", json=signup_data)

    # 2回目の登録（同じユーザー名、別のメールアドレス ➔ 400エラー）
    signup_data["email"] = "user2@example.com"
    response = client.post("/auth/signup", json=signup_data)

    assert response.status_code == 400
    assert response.json()["detail"] == "このユーザー名は既に使われています。"


def test_login_success(client):
    """④ ログイン正常系: 正しい資格情報でJWTトークンが発行されること"""
    # 1. 最初に対象ユーザーを登録しておく
    signup_data = {
        "username": "login_user",
        "email": "login@example.com",
        "password": "MySecretPassword!",
    }
    client.post("/auth/signup", json=signup_data)

    # 2. ログインAPIを叩く
    # ⚠️ OAuth2PasswordRequestForm は JSON ではなく Formデータ（data=）で送る必要があります
    login_data = {"username": "login_user", "password": "MySecretPassword!"}
    response = client.post("/auth/login", data=login_data)
    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_failed_wrong_password(client):
    """⑤ ログイン異常系: パスワードが間違っている場合は401エラーになること"""
    signup_data = {
        "username": "wrong_pwd_user",
        "email": "wrong_pwd@example.com",
        "password": "CorrectPassword123",
    }
    client.post("/auth/signup", json=signup_data)

    # 間違ったパスワードでログイン
    login_data = {"username": "wrong_pwd_user", "password": "IncorrectPassword"}
    response = client.post("/auth/login", data=login_data)
    assert response.status_code == 401
    assert response.json()["detail"] == "ユーザー名またはパスワードが正しくありません。"


def test_login_failed_user_not_found(client):
    """⑥ ログイン異常系: 存在しないユーザー名の場合は401エラーになること"""
    login_data = {"username": "nobody_exists", "password": "SomePassword123"}
    response = client.post("/auth/login", data=login_data)
    assert response.status_code == 401
    assert response.json()["detail"] == "ユーザー名またはパスワードが正しくありません。"
