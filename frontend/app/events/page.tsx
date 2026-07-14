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

  // 💡 ページネーションと表示件数（limit）の状態管理
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(12); // 初期値は3列で綺麗な 12件

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

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  // トークンの取得と一覧の読み込み（💡 page と limit が変わるたびに呼び出される）
  const fetchEvents = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    setLoading(true);
    try {
      // 💡 パラメータのエスケープを行い、バックエンドへ正確にpage/per_pageを届ける[cite: 3, 4]
      const targetPath = encodeURIComponent(`/events?page=${page}&per_page=${limit}`);
      const res = await fetch(`/api/auth?path=${targetPath}`, {
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
      
      // 💡 もし「次のページ」に進んだ結果、データが空っぽだった場合は自動的に前のページに戻す
      if (data.length === 0 && page > 1) {
        alert('これ以上のイベントはありません。');
        setPage((prev) => prev - 1);
        return;
      }

      setEvents(data);
    } catch (err: any) {
      setError(err.message || '通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  // 💡 page または limit が変更されたら、自動で再フェッチ
  useEffect(() => {
    fetchEvents();
  }, [page, limit]);

  // 表示件数（limit）が変更されたときの処理
  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setPage(1); // 💡 表示件数が変わったら、混乱を防ぐため必ず1ページ目に戻す[cite: 3]
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);

    const token = localStorage.getItem('token');
    if (!token) return;

    if (!startDate || !endDate) {
      setCreateError('日付を選択してください。');
      setCreateLoading(false);
      return;
    }
    
    const startTarget = new Date(startDate);
    startTarget.setHours(Number(startHour), Number(startMinute), 0, 0);
    const startIso = startTarget.toISOString();

    const endTarget = new Date(endDate);
    endTarget.setHours(Number(endHour), Number(endMinute), 0, 0);
    const endIso = endTarget.toISOString();

    try {
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
          description,
          location,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (Array.isArray(data.detail)) {
          const errorMessages = data.detail.map((err: any) => err.msg).join(' / ');
          throw new Error(errorMessages);
        }
        throw new Error(data.detail || 'イベントの作成に失敗しました。');
      }

      setTitle('');
      setCapacity(10);
      setDescription('');
      setLocation('');
      setStartDate('');
      setEndDate('');
      setStartHour('08');
      setStartMinute('00');
      setEndHour('17');
      setEndMinute('00');
      alert('イベントを新しく作成しました！');
      
      if (page === 1) {
        fetchEvents();
      } else {
        setPage(1);
      }
    } catch (err: any) {
      setCreateError(err.message || '通信エラーが発生しました。');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      
      {/* ナビゲーションバー (高さ固定) */}
      <nav className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0 z-10">
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
        
        {/* 左側：イベント一覧表示（2カラム） */}
        <div className="lg:col-span-2 flex flex-col h-full min-h-0">
          
          {/* 💡 ヘッダー部分に表示件数選択のプルダウンを追加 */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-xl font-bold text-gray-900">開催予定のイベント一覧</h2>
            
            <div className="flex items-center space-x-2">
              <label htmlFor="limit-select" className="text-xs text-gray-500 font-medium">
                表示件数:
              </label>
              <select
                id="limit-select"
                value={limit}
                onChange={handleLimitChange}
                className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={6}>6件ずつ</option>
                <option value={12}>12件ずつ</option>
                <option value={24}>24件ずつ</option>
                <option value={48}>48件ずつ</option>
              </select>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-md mb-3 flex-shrink-0">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* スクロール可能にするリストコンテナ */}
          <div className="flex-1 overflow-y-auto pr-1 pb-4 min-h-0 scrollbar-thin">
            {loading ? (
              <div className="bg-white text-center py-12 rounded-xl border border-gray-200">
                <p className="text-gray-500 font-medium animate-pulse">イベント一覧を読み込み中...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="bg-white text-center py-12 rounded-xl border border-gray-200">
                <p className="text-gray-500">現在募集中のイベントはありません。右のフォームから作成してみましょう！</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {events.map((event) => (
                  <div key={event.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-44">
                    <div>
                      <h3 className="font-bold text-sm lg:text-base text-gray-800 line-clamp-2 mb-1.5 leading-snug">{event.title}</h3>
                      <div className="text-[11px] lg:text-xs text-gray-500 space-y-0.5 mb-2">
                        <p>🕒 開始: {new Date(event.start_time).toLocaleString('ja-JP')}</p>
                        <p>⌛ 終了: {new Date(event.end_time).toLocaleString('ja-JP')}</p>
                        <p>👥 定員上限: <span className="font-semibold text-gray-700">{event.capacity}人</span></p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => router.push(`/events/${event.id}`)}
                      className="cursor-pointer w-full text-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-1.5 rounded-lg text-xs transition-colors mt-auto"
                    >
                      詳細・コメントを見る →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ページネーションコントロール */}
          {!loading && (
            <div className="flex items-center justify-between border-t border-gray-200 pt-3 mt-2 flex-shrink-0 bg-gray-50">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1 || loading}
                className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← 前のページ
              </button>
              <span className="text-xs font-medium text-gray-700">
                現在のページ: <span className="font-bold text-indigo-600">{page}</span>
              </span>
              <button
                onClick={() => setPage((prev) => prev + 1)}
                // 💡 データが1件もない、または現在のデータ取得件数が選んだlimitに満たない場合はボタンをロックして安全に防御
                disabled={loading || events.length < limit}
                className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                次のページ →
              </button>
            </div>
          )}
        </div>

        {/* 右側：イベント新規作成フォーム */}
        <div className="h-full flex flex-col min-h-0">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-full flex flex-col min-h-0">
            <h2 className="text-base font-bold text-gray-900 mb-3 pb-1.5 border-b flex-shrink-0">🚀 新しいイベントを企画</h2>
            
            {createError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-2.5 mb-3 rounded-r-md flex-shrink-0">
                <p className="text-xs text-red-700 font-medium">{createError}</p>
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-3 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-0.5">イベント名</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="社内ハッカソン 2026"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-0.5">定員 (人数)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-0.5">開催場所</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="会議室A / Teamsリンクなど"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-0.5">イベントの概要・説明</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="詳細内容やアジェンダ"
                  rows={2}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-0.5">開始日時</label>
                <div className="flex space-x-1.5">
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900"
                  />
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-16 px-1.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900"
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const h = String(i).padStart(2, '0');
                      return <option key={h} value={h}>{h}時</option>;
                    })}
                  </select>
                  <select
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                    className="w-16 px-1.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900"
                  >
                    {Array.from({ length: 60 }, (_, i) => {
                      const m = String(i).padStart(2, '0');
                      return <option key={m} value={m}>{m}分</option>;
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-0.5">終了日時</label>
                <div className="flex space-x-1.5">
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="w-16 px-1.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const h = String(i).padStart(2, '0');
                      return <option key={h} value={h}>{h}時</option>;
                    })}
                  </select>
                  <select
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                    className="w-16 px-1.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-indigo-500"
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
                className="cursor-pointer w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex-shrink-0"
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