import React from "react";

// APIから取得するイベントデータの型定義
interface EventItem {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
}

// サーバー側でデータを取得する関数 (Server Componentの機能)
async function getEvents(): Promise<EventItem[]> {
  // Docker Compose環境内では、コンテナ名「backend」で直接通信できますが、
  // フロントエンドの動く場所や設定に合わせてURLを切り替えられるようにします。
  // 今回は確実に通信を通すため、Dockerの内部ネットワーク用URL（http://backend:8000）をベースにします。
  // 環境変数があればそれを使い、なければローカル（localhost）をデフォルトにする設定
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const apiUrl = `${baseUrl}/events`;

  try {
    const res = await fetch(apiUrl, {
      cache: "no-store", // 毎回最新のデータをバックエンドから取得する設定
    });

    if (!res.ok) {
      throw new Error("Failed to fetch events");
    }

    return res.json();
  } catch (error) {
    console.error("データ取得エラー:", error);
    return [];
  }
}

export default async function Home() {
  const events = await getEvents();

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* ヘッダー */}
        <div className="border-b border-gray-200 pb-5 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            📅 イベント管理アプリ
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            FastAPI + PostgreSQLからデータを取得しています
          </p>
        </div>

        {/* イベント一覧リスト */}
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-500">登録されているイベントはありません。</p>
              <p className="text-xs text-gray-400 mt-1">FastAPIの /docs からイベントを追加してみてください！</p>
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-semibold text-gray-800">
                    {event.title}
                  </h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                    ID: {event.id}
                  </span>
                </div>
                {event.description && (
                  <p className="mt-2 text-gray-600 text-sm leading-relaxed">
                    {event.description}
                  </p>
                )}
                <div className="mt-4 pt-3 border-t border-gray-50 flex justify-end">
                  <time className="text-xs text-gray-400">
                    登録日時: {new Date(event.created_at).toLocaleString("ja-JP")}
                  </time>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}