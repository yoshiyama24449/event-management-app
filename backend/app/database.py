from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from datetime import datetime, timezone, timedelta
import os

# =========================================================================
# 1. 接続先URLの取得（環境変数の読み込み）
# =========================================================================
# 💡 修正：テスト実行時は、conftest.pyで指定される（またはテスト用の）SQLiteを向くようにする
# 環境変数「TEST_DATABASE_URL」があればそれを最優先し、なければ本番用のURLを使う
DATABASE_URL = os.getenv("TEST_DATABASE_URL")

# os.getenv を使い、compose.yml で指定した「DATABASE_URL」を安全に読み込みます。
# 万が一環境変数が空だった場合のセーフティネットとして、右側にデフォルト値（バックアップ）も用意しています。
if not DATABASE_URL:
    # 本番（Docker環境）のデフォルトURL
    DATABASE_URL = os.getenv(
        "DATABASE_URL", "postgresql://postgres:postgres_password@db:5432/event_db"
    )

# =========================================================================
# 2. SQLALchemy の基本コア設定
# =========================================================================
# 【エンジン】データベースへの「物理的な接続ルート」を確立します。
# 実際の通信やSQLの発行は、このエンジンが裏側ですべて管理してくれます。
# 【エンジン作成】SQLiteの場合だけ、マルチスレッド用の特殊な引数を足す
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

# 【セッション】データベースを操作するための「1回分の作業窓口」を作る工場です。
#  - autocommit=False : データの保存を自動で行わず、明示的に「commit（確定）」を要求する安全設定。
#  - autoflush=False  : 勝手に未保存のデータを反映させないようにする設定。
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 【ベースクラス】後述する「テーブル定義クラス（モデル）」を作るための土台（親玉）です。
# これを継承してクラスを作ることで、SQLAlchemyが「これはDBのテーブルだな」と認識できるようになります。
Base = declarative_base()

# =========================================================================
# 3. 🕒 タイムゾーン（日本時間：JST）の定義
# =========================================================================
# 世界標準時（UTC）から数えて「プラス9時間」の場所が日本（JST）であることを定義します。
JST = timezone(timedelta(hours=9))


def get_jst_now():
    """現在時刻を日本時間(JST)で取得するヘルパー関数"""
    # 💡 datetime.now() に JST の情報を渡すことで、サーバーが世界のどこ（AWSのアメリカ等）で
    #    動いていても、確実に「その瞬間の正確な日本時間」を取得できるようにします。
    return datetime.now(JST)


# =========================================================================
# 4. イベントテーブルの構造定義（ORMモデル）
# =========================================================================
# このPythonのクラスが、そのままPostgreSQL内の「events」テーブルに自動翻訳されます。
class EventModel(Base):
    __tablename__ = "events"  # データベース側に作られる実際のテーブル名

    # 各カラム（列）の定義
    id = Column(
        Integer, primary_key=True, index=True
    )  # 自動連番（1, 2, 3...）になる主キー。検索が早くなるindex付き。
    title = Column(
        String(100), nullable=False
    )  # 最大100文字の文字列。空っぽ（NULL）での登録は禁止。
    description = Column(
        Text, nullable=True
    )  # 文字数制限なしの長文テキスト。未入力（NULL）でもOK。
    location = Column(
        String(200), nullable=True
    )  # 📍 追加：開催場所（オンラインURLや住所など）
    capacity = Column(Integer, nullable=False)  # 👈 追記（定員必須）
    creator_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # 🕒 タイムゾーン付きのDateTime型
    #  - timezone=True    : PostgreSQL側に「+09:00」というタイムゾーン情報も含めて保存させる設定。
    #  - default=get_jst_now : ⚠️【超重要：カッコをつけない理由】
    #    get_jst_now() と書いてしまうと「このファイルを読み込んだ瞬間の一時」で固定されてしまいます。
    #    カッコを外して関数名だけを渡すことで、「データが新しく登録されるその瞬間」に毎回関数が実行され、
    #    その時の現在時刻が正しく初期値としてセットされます。
    created_at = Column(DateTime(timezone=True), default=get_jst_now, nullable=False)

    # 🕒 追加：イベントの開始・終了日時（タイムゾーン付き）
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)


# =========================================================================
# 5. 【超重要】データベースセッションの安全なライフサイクル管理
# =========================================================================
# FastAPIの「Depends（依存性の注入）」という機能と組み合わせて使う、非常に重要な関数です。
def get_db():
    # 1. ユーザーからリクエスト（画面を開く、ボタンを押す等）が来たら、窓口を1つ開く
    db = SessionLocal()
    try:
        # 2. 処理を行うエンドポイント（main.pyの関数）に、この窓口（db）を「一時レンタル」する
        # 💡 return ではなく yield を使うことで、関数の処理をここで一時停止（キープ）できます
        yield db
    finally:
        # 3. データの登録や取得がすべて終わったら、エラーが起きても起きなくても、
        #    「最後に必ず」窓口を閉じて、データベースへの接続を解放します。
        # 💡 これを怠ると、接続が開きっぱなしになり、やがてDBがパンク（接続上限エラー）を起こします。
        db.close()


class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    sso_provider_id = Column(String(255), unique=True, nullable=True)  # SSO識別子
    username = Column(
        String(50), unique=True, index=True, nullable=False
    )  # 重複不可のユーザー名
    email = Column(
        String(100), unique=True, index=True, nullable=False
    )  # 重複不可のメールアドレス
    hashed_password = Column(String(255), nullable=False)  # 暗号化されたパスワード
    is_active = Column(
        Integer, default=1, nullable=False
    )  # アカウント有効フラグ (1=有効, 0=無効)
    created_at = Column(DateTime(timezone=True), default=get_jst_now, nullable=False)


# =========================================================================
# 6. イベント参加・ブックマーク管理テーブルの構造定義（ORMモデル）
# =========================================================================
class EventRegistrationModel(Base):
    __tablename__ = "event_registrations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    event_id = Column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )

    # statusには 'attending' (参加) または 'bookmark' (ブックマーク) が入ります
    status = Column(String(50), nullable=False)

    created_at = Column(DateTime(timezone=True), default=get_jst_now, nullable=False)


# =========================================================================
# 7. コメントテーブルの構造定義（ORMモデル）
# =========================================================================
class CommentModel(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)

    # 各種外部キーの設定（CASCADE連動）
    event_id = Column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # 💡 自己参照（返信機能）：親コメントのID。単体投稿の場合は NULL（None）になります
    parent_id = Column(
        Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True
    )

    created_at = Column(DateTime(timezone=True), default=get_jst_now, nullable=False)
