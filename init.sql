-- =========================================================================
-- 0. 既存テーブルの完全削除 (DROP 処理)
--    外部キー制約でのエラーを防ぐため、依存関係の下流から順番に削除します
-- =========================================================================
DROP TABLE IF EXISTS event_tags_association CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS event_registrations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =========================================================================
-- 1. テーブルの作成 (Pythonモデルの構造と完全に一致させます)
-- =========================================================================

-- ① ユーザーテーブル
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    sso_provider_id VARCHAR(255) UNIQUE,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ② イベントテーブル
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    location VARCHAR(200),
    capacity INTEGER NOT NULL,
    creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ③ イベント参加・ブックマーク管理テーブル
CREATE TABLE event_registrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'attending' (参加) または 'bookmark' (ブックマーク)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_user_event_status UNIQUE (user_id, event_id, status)
);

-- ④ コメントテーブル
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ⑤ 💡 追加：タグマスターテーブル (TagModelに対応)
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- ⑥ 💡 追加：イベントとタグの中間テーブル (event_tags_associationに対応)
CREATE TABLE event_tags_association (
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (event_id, tag_id)
);


-- =========================================================================
-- 2. テストデータのインサート
-- =========================================================================

-- 2-1. テストユーザーの作成
-- パスワードハッシュはダミー。テスト用ダミーユーザーも多めに用意
INSERT INTO users (id, username, email, hashed_password, sso_provider_id) VALUES
(1, 'tanaka_taro', 'tanaka@example.com', 'sso_dummy_hash_1', 'sso_id_microsoft_101'),
(2, 'sato_jiro', 'sato@example.com', 'sso_dummy_hash_2', 'sso_id_microsoft_102'),
(3, 'suzuki_hanako', 'suzuki@example.com', 'sso_dummy_hash_3', 'sso_id_microsoft_103'),
(4, 'takahashi_ken', 'takahashi@example.com', 'sso_dummy_hash_4', 'sso_id_microsoft_104');

-- シーケンスを手動指定したID（1〜4）と同期させる
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 2-2. 💡 タグの作成
INSERT INTO tags (id, name) VALUES
(1, 'Python'),
(2, 'FastAPI'),
(3, 'TypeScript'),
(4, 'Next.js'),
(5, 'Rust'),
(6, '勉強会'),
(7, 'もくもく会'),
(8, 'ハンズオン'),
(9, 'アイデアハック');

SELECT setval('tags_id_seq', (SELECT MAX(id) FROM tags));

-- 2-3. テストイベントの作成 (フロントでのページネーション検証用に15個の未来・現在・過去のイベントを配置)
-- 時刻は現在（2026年7月）を基準に、未来のイベントや、すでに終了した過去のイベントを混在させています
INSERT INTO events (id, title, description, location, capacity, creator_id, start_time, end_time) VALUES
-- 1. 未来イベント (Python / FastAPI)
(1, '全社モブプログラミング大会', 'みんなで楽しくコードを書く社内イベントです。', '会議室A ＆ Online(Teams)', 15, 1, '2026-07-20 13:00:00+09', '2026-07-20 17:00:00+09'),
-- 2. 未来イベント (TypeScript / Next.js)
(2, 'Next.js App Router 勉強会', 'App Routerの最新機能と最適化について語り合います。', '会議室B ＆ Zoom', 30, 1, '2026-07-25 19:00:00+09', '2026-07-25 21:00:00+09'),
-- 3. 未来イベント (Rust)
(3, 'Rust基礎文法 もくもく会', '定員5名の少人数ワークショップ。メモリ安全性を味方にしよう。', 'オンライン開催', 5, 2, '2026-07-22 18:00:00+09', '2026-07-22 19:30:00+09'),
-- 4. 未来イベント (Python)
(4, 'FastAPI + SQLAlchemy ハンズオン', 'リレーショナルDB設計からAPI実装まで一気に学びます。', '会議室C', 10, 3, '2026-07-28 15:00:00+09', '2026-07-28 18:00:00+09'),
-- 5. 未来イベント (アイデアハック)
(5, '新規事業アイデアハック 2026', '次世代のWebサービスについてのブレインストーミング。', 'オンライン開催', 50, 4, '2026-08-01 10:00:00+09', '2026-08-01 16:00:00+09'),
-- 6. 未来イベント (Next.js)
(6, 'Tailwind CSS デザインハック', '美しいUIを爆速で作るための実践Tips。', '会議室A', 15, 1, '2026-08-05 13:00:00+09', '2026-08-05 15:00:00+09'),
-- 7. 未来イベント (TypeScript)
(7, 'TypeScript 5.x 高度な型システム', 'Mapped Types や Conditional Types を使いこなす。', 'オンライン開催', 20, 2, '2026-08-10 19:00:00+09', '2026-08-10 21:00:00+09'),
-- 8. 未来イベント (Python / 勉強会)
(8, 'Pythonデータ分析 超入門', 'pandasとmatplotlibを使った可視化のハンズオン。', '会議室B', 25, 3, '2026-08-15 14:00:00+09', '2026-08-15 17:00:00+09'),
-- 9. 未来イベント (Rust / もくもく会)
(9, 'RustでWebAssemblyを動かす会', 'ブラウザ上で高速なRustコードを実行するもくもく会。', 'オンライン開催', 8, 2, '2026-08-20 18:30:00+09', '2026-08-20 20:30:00+09'),
-- 10. 未来イベント (Next.js / 勉強会)
(10, 'Next.js v15 移行相談会', '新機能へのアップグレードで困っている開発者向けの相談窓口。', '会議室D', 12, 1, '2026-08-25 16:00:00+09', '2026-08-25 18:00:00+09'),
-- 11. 未来イベント (勉強会)
(11, 'Git / GitHub チーム開発お作法', 'コンフリクトを恐れないマージリクエストの出し方。', 'オンライン開催', 40, 4, '2026-09-01 13:00:00+09', '2026-09-01 15:00:00+09'),

-- 12. 過去イベント（すでに終了しているもの。一覧フィルターの検証に必須！）
(12, '【過去】Django基礎ハンズオン', 'こちらはすでに2026年6月に終了したイベントです。', '会議室A', 10, 1, '2026-06-10 10:00:00+09', '2026-06-10 12:00:00+09'),
-- 13. 過去イベント
(13, '【過去】React19新機能 先取り勉強会', 'React19のアクション機能についての振り返り会。', 'オンライン開催', 30, 2, '2026-06-15 19:00:00+09', '2026-06-15 20:30:00+09'),

-- 14. 定員2名ですでに満員状態になっている未来のイベント
(14, '【満員】Rustによる超高速並行処理実践', 'すでに満員御礼。並行プログラミングモデルを極めましょう。', '会議室D', 2, 2, '2026-08-30 19:00:00+09', '2026-08-30 21:00:00+09');

SELECT setval('events_id_seq', (SELECT MAX(id) FROM events));

-- 2-4. 💡 イベントとタグの紐付け (多対多中間データ)
INSERT INTO event_tags_association (event_id, tag_id) VALUES
(1, 1), (1, 2), (1, 7), -- 全社モブプロ: Python, FastAPI, もくもく会
(2, 3), (2, 4), (2, 6), -- Next.js勉強会: TypeScript, Next.js, 勉強会
(3, 5), (3, 7),         -- Rustもくもく: Rust, もくもく会
(4, 1), (4, 2), (4, 8), -- FastAPIハンズオン: Python, FastAPI, ハンズオン
(5, 9), (5, 6),         -- アイデアハック: アイデアハック, 勉強会
(6, 4), (6, 8),         -- Tailwind: Next.js, ハンズオン
(7, 3), (7, 6),         -- TS高度な型: TypeScript, 勉強会
(8, 1), (8, 8),         -- Python分析: Python, ハンズオン
(9, 5), (9, 7),         -- Rust Wasm: Rust, もくもく会
(10, 4), (10, 6),       -- Next15移行: Next.js, 勉強会
(11, 6),                -- Git開発: 勉強会
(12, 1), (12, 8),       -- Django基礎(過去): Python, ハンズオン
(13, 3), (13, 6),       -- React19(過去): TypeScript, 勉強会
(14, 5), (14, 6); -- イベント14: Rust, 勉強会

-- 2-5. テスト参加・ブックマークデータの作成
INSERT INTO event_registrations (user_id, event_id, status) VALUES
(1, 3, 'attending'), -- 田中さんがイベント3(Rust)に参加
(2, 1, 'bookmark'),   -- 佐藤さんがイベント1をブックマーク
(3, 1, 'attending'), -- 鈴木さんがイベント1に参加
(4, 1, 'attending'), -- 高橋さんがイベント1に参加

-- 💡 満員化処理：イベント14（定員2）に2名を登録
(1, 14, 'attending'), -- 田中さんが参加
(3, 14, 'attending'); -- 鈴木さんが参加

-- 2-6. テストコメントの作成
INSERT INTO comments (id, event_id, user_id, parent_id, content) VALUES
(1, 1, 2, NULL, '当日の持ち物はありますか？'),
(2, 1, 1, 1, 'PCと、事前にリポジトリのクローンをお願いします！'),
(3, 2, 3, NULL, '事前知識はどの程度必要ですか？'),
(4, 2, 1, 3, 'Reactの基礎（useStateやuseEffect）がわかっていれば十分楽しめる内容です！');

SELECT setval('comments_id_seq', (SELECT MAX(id) FROM comments));