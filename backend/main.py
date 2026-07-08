from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import List

# database.py から必要な部品をインポート
from database import engine, Base, get_db, EventModel

# =========================================================================
# 1. データベースの初期化（自動テーブル作成）
# =========================================================================
# アプリが起動した瞬間に、PostgreSQLの中に「events」テーブルがあるかどうかを確認します。
# 💡 まだテーブルが無い場合のみ、自動的に最新の構造（created_at付き）でテーブルを作成してくれます。
#    すでにテーブルが存在する場合は、構造がズレていてもスルーする特性があります（※これがエラーの原因でしたね！）。
Base.metadata.create_all(bind=engine)

# FastAPIの本体インスタンスを作成
app = FastAPI(title="Event Management API")

# =========================================================================
# 2. CORS（Cross-Origin Resource Sharing）の設定
# =========================================================================
# ブラウザのセキュリティ制限（異なるドメイン間での通信ブロック）を解除するための設定です。
# 今回は、ポート3000（Next.js）からポート8000（FastAPI）への通信を通すために追加しています。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # 開発用のため一時的にすべてのURLからの通信を許可（本番環境ではフロントのURLだけに絞ります）
    allow_credentials=True,   # クッキーなどの認証情報のやり取りを許可
    allow_methods=["*"],      # GET, POST, PUT, DELETE などのすべてのHTTPメソッドを許可
    allow_headers=["*"],      # すべてのヘッダー情報を許可
)

# =========================================================================
# 3. Pydanticモデル（バリデーション ＆ データ構造の定義）
# =========================================================================
# 💡 SQLAlchemyのモデルが「データベースの形」を決めるのに対し、
#    Pydanticのモデルは「Webでやり取りするデータの形（検問・フィルター）」を決めます。

# 【入力用チェック】イベントを作るときに、クライアントから送られてくるべきデータの形
class EventCreate(BaseModel):
    title: str                      # タイトルは必須（文字列型）
    description: str | None = None  # 説明文は省略してもOK（文字列またはNone）

# 【出力用フィルター】データを画面に返却するときの形
class EventResponse(BaseModel):
    id: int                         # 自動生成されたIDを含めて返す
    title: str
    description: str | None = None
    created_at: datetime            # 保存された日本時間の日時情報も含めて返す

    class Config:
        # 💡 これが非常に重要な1行です。
        #    SQLAlchemyが返してくるデータはPythonの「オブジェクト（クラス）」という特殊な形をしています。
        #    この設定をしておくことで、FastAPIがそれを自動的にWebで送受信できる「JSON形式」に変換（マッピング）してくれます。
        from_attributes = True


# =========================================================================
# 4. API エンドポイント（通信の窓口）の実装
# =========================================================================

# --- ① 疎通確認用（GET /） ---
@app.get("/")
def read_root():
    """ブラウザでアクセスしたときに、サーバーが生きているか確認するための窓口"""
    return {"status": "ok", "message": "Welcome to Event Management API"}


# --- ② イベント登録（POST /events） ---
# response_model を指定することで、返却するデータが自動的に「EventResponse」の形にトリミングされます。
@app.post("/events", response_model=EventResponse)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    """新しいイベントをデータベースに保存する窓口"""
    # 1. 画面から送られてきたデータ（event）を、データベース用の型（EventModel）に変換する
    db_event = EventModel(title=event.title, description=event.description)
    
    # 2. データベース操作窓口（db）に、データを追加するよう頼む（まだこの時点では仮保存）
    db.add(db_event)
    
    # 3. 変更を確定（コミット）し、本番のPostgreSQLに完全に書き込む
    db.commit()
    
    # 4. データを最新状態に同期する（これにより、DB側で自動生成された「id」や「created_at」が db_event に逆輸入されます）
    db.refresh(db_event)
    
    # 5. 綺麗に整えられたイベントデータをフロントエンドに送り返す
    return db_event


# --- ③ イベント一覧取得（GET /events） ---
# 複数のイベントをリストにして返すため、List[EventResponse] を指定します。
@app.get("/events", response_model=List[EventResponse])
def get_events(db: Session = Depends(get_db)):
    """保存されているイベントを最新順にすべて取得する窓口"""
    # db.query(EventModel) ➔ events テーブルからデータを取ってきてね
    # .order_by(EventModel.created_at.desc()) ➔ 作成日時の新しい順（降順）に並び替えてね
    # .all() ➔ 条件に合うものをすべてリストにして一括取得してね
    # 💡 この1行を裏側でSQL（SELECT * FROM events ORDER BY created_at DESC;）に自動翻訳して実行しています。
    events = db.query(EventModel).order_by(EventModel.created_at.desc()).all()
    
    # 取得したリストをそのままフロントエンドへ返却
    return events