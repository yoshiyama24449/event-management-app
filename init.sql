-- =========================================================================
-- 1. テーブルの作成 (既存のPythonモデルの構造と完全に一致させます)
-- =========================================================================

-- ① ユーザーテーブル (UserModel との齟齬を回避)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,                       -- 既存コードとの互換性用
    email VARCHAR(100) UNIQUE NOT NULL,                         -- 既存コードとの互換性用
    hashed_password VARCHAR(255) NOT NULL,                      -- 既存コードとの互換性用 (SSO時はダミー値を想定)
    sso_provider_id VARCHAR(255) UNIQUE,                        -- 💡 Microsoft SSO連携用の一意のIDを追加
    is_active INTEGER DEFAULT 1 NOT NULL,                       -- Column(Integer) の仕様に準拠 (1=有効, 0=無効)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ② イベントテーブル (EventModel との齟齬を回避 ＋ アプリ仕様の追加)
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,                                -- String(100)
    description TEXT,                                           -- Text
    location VARCHAR(200),                                      -- String(200)
    capacity INTEGER NOT NULL,                                  -- 💡 アプリ仕様：定員設定は必須
    creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- 💡 アプリ仕様：イベント作成者
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,               -- DateTime(timezone=True)
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,                 -- DateTime(timezone=True)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ③ イベント参加・ブックマーク管理テーブル (アプリ仕様)
CREATE TABLE IF NOT EXISTS event_registrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(50) NOT NULL,                                -- 'attending' (参加) または 'bookmark' (ブックマーク)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_user_event_status UNIQUE (user_id, event_id, status)
);

-- ④ コメントテーブル (アプリ仕様：ダッシュボードでの返信表示を考慮)
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE, -- 返信用の紐づけ (自己参照)
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);


-- =========================================================================
-- 2. テストデータのインサート (コンテナ初期化時に1度だけ走ります)
-- =========================================================================

-- テストユーザーの作成 (パスワードはダミー値を投入してエラーを回避)
INSERT INTO users (username, email, hashed_password, sso_provider_id) VALUES
('tanaka_taro', 'tanaka@example.com', 'sso_dummy_hash_1', 'sso_id_microsoft_101'),
('sato_jiro', 'sato@example.com', 'sso_dummy_hash_2', 'sso_id_microsoft_102')
ON CONFLICT DO NOTHING;

-- テストイベントの作成 (2026年のイベントとしてJST+09の時間帯で投入)
INSERT INTO events (title, description, location, capacity, creator_id, start_time, end_time) VALUES
(
    '全社モブプログラミング大会', 
    'みんなで楽しくコードを書く社内イベントです。', 
    '会議室A ＆ Online(Teams)', 
    15, 
    1, 
    '2026-07-20 13:00:00+09', 
    '2026-07-20 17:00:00+09'
),
(
    'テスト駆動開発(TDD) 読書会', 
    '定員5名の少人数ワークショップ。課題図書を読んできてください。', 
    'オンライン開催', 
    5, 
    2, 
    '2026-07-22 18:00:00+09', 
    '2026-07-22 19:30:00+09'
)
ON CONFLICT DO NOTHING;

-- テスト参加・ブックマークデータの作成
INSERT INTO event_registrations (user_id, event_id, status) VALUES
(1, 2, 'attending'), -- 田中さんがイベント2に参加
(2, 1, 'bookmark')   -- 佐藤さんがイベント1をブックマーク
ON CONFLICT DO NOTHING;

-- テストコメントの作成 (質問と、それに対する返信のサンプル)
INSERT INTO comments (event_id, user_id, parent_id, content) VALUES
(1, 2, NULL, '当日の持ち物はありますか？'),       -- ID: 1 のコメント
(1, 1, 1, 'PCと、事前にリポジトリのクローンをお願いします！'); -- ID: 1 への返信 (parent_id=1)