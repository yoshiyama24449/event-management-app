# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import events, auth

# アプリ起動時にテーブルを自動作成（※カラムを変更した場合はDBボリュームの再作成が必要です）
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Event Management API")

# CORS設定（Next.jsなどのフロントエンドからの通信を許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================================
# ルーターの登録（合体）
# =========================================================================
app.include_router(events.router)
app.include_router(auth.router)


# 疎通確認用のルートだけ残しておく（無くてもOK）
@app.get("/")
def read_root():
    return {"status": "ok", "message": "Welcome to Event Management API"}