# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import engine, Base
from .routers import events, auth, registrations, comments, dashboard


# 1. アプリ起動時と終了時のイベントを定義する
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 🚀 アプリが起動する瞬間にテーブルを作成する（テスト時はここが走らないように制御できる）
    Base.metadata.create_all(bind=engine)
    yield
    # 🛑 アプリが終了する時の処理があればここに書く（今回はなし）


app = FastAPI(title="Event Management API", lifespan=lifespan)

# CORS設定（Next.jsなどのフロントエンドからの通信を許可）
origins = [
    "http://localhost:3000",  # ローカル開発時のNext.js
    # "https://your-event-app.com",  # 将来本番にデプロイしたときのURL（仮）
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================================
# ルーターの登録（合体）
# =========================================================================
app.include_router(auth.router)
app.include_router(events.router)
app.include_router(registrations.router)
app.include_router(comments.router)
app.include_router(dashboard.router)


# 疎通確認用のルートだけ残しておく（無くてもOK）
@app.get("/")
def read_root():
    return {"status": "ok", "message": "Welcome to Event Management API"}
