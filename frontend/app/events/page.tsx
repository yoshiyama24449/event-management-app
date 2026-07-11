'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface EventItem {
  id: number;
  title: string;
  capacity: number;
  start_time: string;
  end_time: string;
  creator_id: number;
  created_at: string;
}

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // イベント作成フォームの状態管理
  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startHour, setStartHour] = useState('08');
  const [startMinute, setStartMinute] = useState('00');
  const [endDate, setEndDate] = useState('');
  const [endHour, setEndHour] = useState('17');
  const [endMinute, setEndMinute] = useState('00');
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // 💡 ログアウト処理を追加
  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  // トークンの取得と一覧の読み込み
  const fetchEvents = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    try {
      // 💡 万能中継API経由に書き換え
      const res = await fetch('/api/auth?path=/events', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        throw new Error('イベント一覧の取得に失敗しました。');
      }

      const data = await res.json();
      setEvents(data);
    } catch (err: any) {
      setError(err.message || '通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // 新規イベント作成の送信処理
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);

    const token = localStorage.getItem('token');
    if (!token) return;

    // ISO形式に変換（バックエンドが期待するフォーマット）
    if (!startDate || !endDate) {
      setCreateError('日付を選択してください。');
      setCreateLoading(false);
      return;
    }
    // 💡 修正：00時00分でもエラーにならない安全な日時の組み立て方
    const startTarget = new Date(startDate);
    startTarget.setHours(Number(startHour), Number(startMinute), 0, 0);
    const startIso = startTarget.toISOString();

    const endTarget = new Date(endDate);
    endTarget.setHours(Number(endHour), Number(endMinute), 0, 0);
    const endIso = endTarget.toISOString();

    try {
      // 💡 万能中継API経由に書き換え
      const res = await fetch('/api/auth?path=/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          capacity: Number(capacity),
          start_time: startIso,
          end_time: endIso,
          description, // 💡 追記（入力された説明）
          location,    // 💡 追記（入力された開催場所）
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 💡 追記：FastAPIのバリデーションエラー（配列型）かどうかのチェック
        if (Array.isArray(data.detail)) {
          // 例: [{"loc":..., "msg": "終了日時は開始日時より後の時間をして..."}] からメッセージだけを結合
          const errorMessages = data.detail.map((err: any) => err.msg).join(' / ');
          throw new Error(errorMessages);
        }

        // 通常のエラー文字列の場合
        throw new Error(data.detail || 'イベントの作成に失敗しました。');
      }

      // フォームをリセットし、一覧を再取得
      setTitle('');
      setCapacity(10);
      setDescription(''); // 💡 追記
      setLocation('');    // 💡 追記
      setStartDate('');
      setEndDate('');
      setStartHour('08');
      setStartMinute('00');
      setEndHour('17');
      setEndMinute('00');
      alert('イベントを新しく作成しました！');
      fetchEvents();
    } catch (err: any) {
      setCreateError(err.message || '通信エラーが発生しました。');
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-medium animate-pulse">イベント一覧を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ナビゲーションバー */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900 tracking-tight cursor-pointer" onClick={() => router.push('/dashboard')}>
            📅 EventHub
          </span>
          <div className="flex items-center space-x-6">
            <button onClick={() => router.push('/dashboard')} className="cursor-pointer text-sm text-gray-600 hover:text-indigo-600 font-medium">
              ダッシュボード
            </button>
            <button onClick={() => router.push('/events')} className="cursor-pointer text-sm text-indigo-600 font-bold">
              イベント一覧
            </button>
            <button
              onClick={handleLogout}
              className="cursor-pointer text-sm text-gray-500 hover:text-red-600 font-medium transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </nav>

      {/* メイングリッド */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 左側：イベント一覧表示（2カラム） */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-gray-900">開催予定のイベント一覧</h2>
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {events.length === 0 ? (
            <div className="bg-white text-center py-12 rounded-xl border border-gray-200">
              <p className="text-gray-500">現在募集中のイベントはありません。右のフォームから作成してみましょう！</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((event) => (
                <div key={event.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800 mb-2">{event.title}</h3>
                    <div className="text-xs text-gray-500 space-y-1 mb-4">
                      <p>🕒 開始: {new Date(event.start_time).toLocaleString('ja-JP')}</p>
                      <p>⌛ 終了: {new Date(event.end_time).toLocaleString('ja-JP')}</p>
                      <p>👥 定員上限: <span className="font-semibold text-gray-700">{event.capacity}人</span></p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => router.push(`/events/${event.id}`)}
                    className="cursor-pointer w-full text-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2 rounded-lg text-sm transition-colors"
                  >
                    詳細・コメントを見る →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右側：イベント新規作成フォーム（1カラム） */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm sticky top-24">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">🚀 新しいイベントを企画</h2>
            
            {createError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 rounded-r-md">
                <p className="text-xs text-red-700 font-medium">{createError}</p>
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">イベント名</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="社内ハッカソン 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">定員 (人数)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              {/* 💡 追記：開催場所の入力欄 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">開催場所</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="会議室A / Teamsリンクなど"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              {/* 💡 追記：イベント説明の入力欄（複数行テキストエリア） */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">イベントの概要・説明</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="イベントの詳細内容やアジェンダを記入してください"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">開始日時</label>
                <div className="flex space-x-2">
                  {/* 日付選択（カレンダーアイコンから選ぶだけ） */}
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                  
                  {/* 時の選択 */}
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const h = String(i).padStart(2, '0');
                      return <option key={h} value={h}>{h}時</option>;
                    })}
                  </select>

                  {/* 分の選択 */}
                  <select
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                    className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  >
                    {Array.from({ length: 60 }, (_, i) => {
                      const m = String(i).padStart(2, '0');
                      return <option key={m} value={m}>{m}分</option>;
                    })}
                  </select>
                </div>
              </div>

              {/* 終了日時 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">終了日時</label>
                <div className="flex space-x-2">
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const h = String(i).padStart(2, '0');
                      return <option key={h} value={h}>{h}時</option>;
                    })}
                  </select>
                  <select
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                    className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    {Array.from({ length: 60 }, (_, i) => {
                      const m = String(i).padStart(2, '0');
                      return <option key={m} value={m}>{m}分</option>;
                    })}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={createLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {createLoading ? '作成中...' : 'この内容でイベントを公開'}
              </button>
            </form>
          </div>
        </div>

      </main>
    </div>
  );
}