'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// APIの返却値に合わせた型定義
interface CreatedEvent {
  id: number;
  title: string;
  capacity: number;
  attendee_count: number;
  attendees: string[];
  comment_count: number;
}

interface CalendarEvent {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  status: 'attending' | 'bookmark';
}

interface CommentActivity {
  comment_id: number;
  event_id: number;
  event_title: string;
  my_content: string;
  replies: string[];
}

interface DashboardData {
  created_events: CreatedEvent[];
  calendar_events: CalendarEvent[];
  my_comments: CommentActivity[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. ブラウザのストレージから認証トークンとユーザー名を取得
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');

    // 💡 トークンが無ければ未ログインなのでトップページへ強制送還
    if (!token) {
      router.push('/');
      return;
    }

    setUsername(storedUsername || 'ユーザー');

    // 2. ダッシュボード用集約データの取得
    const fetchDashboardData = async () => {
      try {
        // 💡 localhost:8000 ではなく、自サーバーの中継API（相対パス）を叩く
        const res = await fetch(`/api/auth?path=/dashboard`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`, // 🔑 JWTトークンを付与
            'X-User-Name': storedUsername || '', // テスト互換用ヘッダー
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            localStorage.clear();
            router.push('/');
            return;
          }
          throw new Error('ダッシュボードデータの取得に失敗しました。');
        }

        const dashboardData = await res.json();
        setData(dashboardData);
      } catch (err: any) {
        setError(err.message || '通信エラーが発生しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  // ログアウト処理
  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-medium animate-pulse">データを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
    {/* ナビゲーションバー */}
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* 【左側】ロゴとメインナビゲーション */}
        <div className="flex items-center space-x-6">
          <span className="text-xl font-bold text-gray-900 tracking-tight">📅 EventHub</span>
          
          {/* イベント一覧画面へ移動するリンクボタン */}
          <button
            onClick={() => router.push('/events')}
            className="cursor-pointer text-sm text-indigo-600 hover:text-indigo-800 font-semibold px-3 py-2 rounded-md hover:bg-indigo-50 transition-colors"
          >
            🙋 イベント一覧・企画
          </button>
        </div>

        {/* 【右側】ユーザー情報とログアウト */}
        <div className="flex items-center space-x-4">
          <span className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-medium">
            こんにちは、{username} さん
          </span>
          
          <button
            onClick={handleLogout}
            className="cursor-pointer text-sm text-gray-500 hover:text-red-600 font-medium transition-colors px-2 py-1"
          >
            ログアウト
          </button>
        </div>

      </div>
    </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* グリッド配置：左側（カレンダー・イベント） / 右側（コメント履歴） */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 左〜中央：イベント管理・スケジュール（2カラム分） */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* 1. 自分が作成したイベントの管理 */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">🛡️ 作成したイベントの統計</h2>
              {data?.created_events.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">まだ作成したイベントはありません。</p>
              ) : (
                <div className="space-y-4">
                  {data?.created_events.map((event) => (
                    <div 
                      key={event.id} 
                      onClick={() => router.push(`/events/${event.id}`)}
                      className="cursor-pointer border border-gray-100 rounded-lg p-4 bg-gray-50/50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900 text-base">{event.title}</h3>
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">ID: {event.id}</span>
                      </div>
                      
                      {/* 統計バッジ */}
                      <div className="flex space-x-4 text-xs text-gray-600 mb-3">
                        <div>👥 参加予定: <span className="font-bold text-indigo-600">{event.attendee_count}</span> / {event.capacity} 人</div>
                        <div>💬 コメント: <span className="font-bold text-gray-900">{event.comment_count}</span> 件</div>
                      </div>

                      {/* 参加者名一覧 */}
                      {event.attendees.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200/60">
                          <span className="text-xs font-semibold text-gray-500 block mb-1">参加者一覧:</span>
                          <div className="flex flex-wrap gap-1">
                            {event.attendees.map((name, idx) => (
                              <span key={idx} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. カレンダー形式の予定一覧（簡易リスト形式） */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">🗓️ スケジュール・カレンダーデータ</h2>
              {data?.calendar_events.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">予定（参加・ブックマーク）が入っているイベントはありません。</p>
              ) : (
                <div className="space-y-3">
                  {data?.calendar_events.map((cal) => (
                    <div 
                      key={cal.id} 
                      onClick={() => router.push(`/events/${cal.id}`)}
                      className="cursor-pointer flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="space-y-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          cal.status === 'attending' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {cal.status === 'attending' ? '参加予定' : 'ブックマーク'}
                        </span>
                        <h4 className="font-medium text-gray-900 text-sm mt-1">{cal.title}</h4>
                        <p className="text-xs text-gray-400">
                          {new Date(cal.start_time).toLocaleString('ja-JP')} 〜
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* 右側：コメント活動の履歴（1カラム分） */}
          <div className="space-y-8">
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">💬 投稿したコメントと返信</h2>
              {data?.my_comments.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">まだコメントを投稿していません。</p>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {data?.my_comments.map((comment) => (
                    <div key={comment.comment_id} className="border border-gray-100 rounded-lg p-3 bg-indigo-50/20">
                      <span className="text-xs text-indigo-600 font-medium block mb-1">📌 {comment.event_title}</span>
                      <p className="text-sm text-gray-800 font-medium bg-white p-2 rounded border border-gray-100">
                        {comment.my_content}
                      </p>

                      {/* コメントに対する返信群 */}
                      {comment.replies.length > 0 ? (
                        <div className="mt-2 pl-4 space-y-1.5 border-l-2 border-indigo-200">
                          {comment.replies.map((reply, rIdx) => (
                            <p key={rIdx} className="text-xs bg-gray-100 text-gray-700 p-2 rounded">
                              ↳ <span className="font-medium">{reply}</span>
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-400 mt-1 italic">まだ返信はありません</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

        </div>
      </main>
    </div>
  );
}