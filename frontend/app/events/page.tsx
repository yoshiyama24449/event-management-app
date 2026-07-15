'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Tag {
  name: string;
}

interface EventItem {
  id: number;
  title: string;
  description: string;
  location: string;
  capacity: number;
  start_time: string;
  end_time: string;
  creator_id: number;
  creator_name: string; // 💡 追記
  created_at: string;
  tag_names: string[];
  attendee_count: number;
}

// 💡 メインロジックを別コンポーネントに切り出し
function EventsList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 💡 タグ選択ポップアップの開閉管理
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  // 💡 ページネーションと件数の状態管理
  const [page, setPage] = useState<number>(() => {
    return Number(searchParams.get('page')) || 1;
  });
  const [limit, setLimit] = useState<number>(() => {
    return Number(searchParams.get('limit')) || 12;
  });

  // 💡 高度なフィルター用の状態管理
  const [searchQuery, setSearchQuery] = useState(() => {
    return searchParams.get('q') || '';
  });
  const [selectedTag, setSelectedTag] = useState(() => {
    return searchParams.get('tag') || '';
  });
  const [filterStartDate, setFilterStartDate] = useState(() => {
    return searchParams.get('start_date') || '';
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    return searchParams.get('end_date') || '';
  });
  
  // 💡 「終了したイベントを表示しない」の初期値判定
  const [hideFinished, setHideFinished] = useState<boolean>(() => {
    const val = searchParams.get('hide_finished');
    return val !== 'false';
  });

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
  const [tagsInput, setTagsInput] = useState('');
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // 定義済みの主要タグリスト
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // 💡 安全に動的タグをマージするフェッチ関数
  const fetchTags = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('/api/auth?path=%2Fevents%2Ftags', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (res.ok) {
        const tagsData = await res.json();
        console.log("取得したタグデータ:", tagsData);

        if (Array.isArray(tagsData)) {
          setAvailableTags((prev) => {
            const combined = [...prev, ...tagsData];
            return Array.from(new Set(combined));
          });
        }
      } else {
        console.warn(`タグのフェッチに失敗しました (ステータス: ${res.status})`);
      }
    } catch (err) {
      console.error('動的タグの取得に失敗しました。デフォルトのタグのみ表示します。', err);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  // 💡 ページ、表示件数、またはフィルター条件が変わったら自動的に再フェッチ
  useEffect(() => {
    const params = new URLSearchParams();
    if (page !== 1) params.set('page', String(page));
    if (limit !== 12) params.set('limit', String(limit));
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (selectedTag) params.set('tag', selectedTag);
    if (filterStartDate) params.set('start_date', filterStartDate);
    if (filterEndDate) params.set('end_date', filterEndDate);
    params.set('hide_finished', String(hideFinished));

    router.replace(`/events?${params.toString()}`);
  }, [page, limit, searchQuery, selectedTag, filterStartDate, filterEndDate, hideFinished]);

  // 💡 APIからイベント一覧を読み込む関数
  const fetchEvents = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('per_page', String(limit));
      params.append('hide_finished', String(hideFinished));

      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (selectedTag) params.append('tag', selectedTag);
      
      if (filterStartDate) {
        const startIso = new Date(filterStartDate).toISOString();
        params.append('start_date', startIso);
      }
      if (filterEndDate) {
        const endTarget = new Date(filterEndDate);
        endTarget.setHours(23, 59, 59, 999);
        params.append('end_date', endTarget.toISOString());
      }

      const targetPath = encodeURIComponent(`/events?${params.toString()}`);
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

  useEffect(() => {
    fetchEvents();
  }, [page, limit, selectedTag, hideFinished]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedTag('');
    setFilterStartDate('');
    setFilterEndDate('');
    setHideFinished(true);
    setPage(1);
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setPage(1);
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

    const tagsArray = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '');

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
          tags: tagsArray,
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
      setTagsInput('');
      alert('イベントを新しく作成しました！');

      // 新規タグが即座にフィルターに並ぶようにタグ情報を再フェッチ
      fetchTags();
      
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

  const isEventFinished = (endTimeStr: string) => {
    return new Date(endTimeStr).getTime() < new Date().getTime();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* ナビゲーションバー */}
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
        {/* 左側：高度なフィルター ＆ イベント一覧表示 */}
        <div className="lg:col-span-2 flex flex-col h-full min-h-0">
          {/* フィルターパネル */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-4 flex-shrink-0">
            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">キーワード・場所</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="タイトル、場所など..."
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">イベント開催日（開始）</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">イベント開催日（終了）</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">フィルター:</span>
                  
                  {/* ① 「すべて」ボタン */}
                  <button
                    type="button"
                    onClick={() => setSelectedTag('')}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-full transition-colors cursor-pointer ${
                      selectedTag === '' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    すべてのタグ
                  </button>

                  {/* ② タグモーダルを開くトリガーボタン */}
                  <button
                    type="button"
                    onClick={() => setIsTagModalOpen(true)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
                      selectedTag 
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100' 
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>🏷️</span>
                    {selectedTag ? `タグ: #${selectedTag}` : 'タグを選択する...'}
                  </button>

                  {/* ③ もしタグが選ばれていたらクイック解除できる「×」を表示 */}
                  {selectedTag && (
                    <button
                      type="button"
                      onClick={() => setSelectedTag('')}
                      className="text-[10px] text-gray-400 hover:text-red-500 font-bold transition-colors cursor-pointer"
                      title="選択をクリア"
                    >
                      [解除 ✕]
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-3 ml-auto">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideFinished}
                      onChange={(e) => {
                        setHideFinished(e.target.checked);
                        setPage(1);
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>終了したイベントを表示しない</span>
                  </label>

                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                  >
                    検索を適用
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg transition-colors"
                  >
                    クリア
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* 表示件数選択 */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-900">開催予定のイベント一覧</h2>
            <div className="flex items-center space-x-2">
              <label htmlFor="limit-select" className="text-xs text-gray-500 font-medium">
                1ページの表示数:
              </label>
              <select
                id="limit-select"
                value={limit}
                onChange={handleLimitChange}
                className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value={6}>6件</option>
                <option value={12}>12件</option>
                <option value={24}>24件</option>
              </select>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-md mb-3 flex-shrink-0">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* イベントカード */}
          <div className="flex-1 overflow-y-auto pr-1 pb-4 min-h-0 scrollbar-thin">
            {loading ? (
              <div className="bg-white text-center py-12 rounded-xl border border-gray-200">
                <p className="text-gray-500 font-medium animate-pulse">イベント一覧を読み込み中...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="bg-white text-center py-12 rounded-xl border border-gray-200">
                <p className="text-gray-500 font-medium">条件に一致する募集中のイベントはありません。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {events.map((event) => {
                  const finished = isEventFinished(event.end_time);
                  const isFull = event.attendee_count >= event.capacity;

                  return (
                    <div 
                      key={event.id} 
                      className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full min-h-[14rem] ${
                        finished ? 'border-gray-200 bg-gray-50 opacity-80' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-2.5 h-6 flex-shrink-0">
                          {finished ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-md">
                              終了しました
                            </span>
                          ) : isFull ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md">
                              満員御礼
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md">
                              参加受付中
                            </span>
                          )}
                        </div>

                        <h3 className={`font-bold text-sm lg:text-base line-clamp-2 mb-2 leading-snug flex-shrink-0 ${finished ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                          {event.title}
                        </h3>
                        
                        <div className="text-[11px] lg:text-xs text-gray-500 space-y-0.5 mb-3 flex-1">
                          <p>👤 企画者: <span className="font-semibold text-gray-700">{event.creator_name}</span></p>
                          <p>📍 場所: <span className="font-medium text-gray-700">{event.location || '未設定'}</span></p>
                          <p>🕒 開始: {new Date(event.start_time).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                          <p>⌛ 終了: {new Date(event.end_time).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                          <p>
                            👥 参加状況: {' '}
                            <span className={`font-semibold ${isFull && !finished ? 'text-amber-600' : 'text-gray-700'}`}>
                              {event.attendee_count} / {event.capacity} 人
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-3 flex-shrink-0">
                        {event.tag_names && event.tag_names.map((t) => (
                          <span key={t} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md">
                            #{t}
                          </span>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => router.push(`/events/${event.id}`)}
                        className={`cursor-pointer w-full text-center font-semibold py-1.5 rounded-lg text-xs transition-colors mt-auto flex-shrink-0 ${
                          finished 
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-500' 
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {finished ? '詳細・終了済みの履歴を確認 →' : '詳細・コメント・登録 →'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ページネーション */}
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
                disabled={loading || events.length < limit}
                className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                次のページ →
              </button>
            </div>
          )}
        </div>

        {/* 右側：作成フォーム */}
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
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-0.5">タグ付け (カンマ区切り)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Python, 勉強会, 初心者歓迎"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
                <span className="text-[10px] text-gray-400 block mt-0.5">カンマ「,」で区切ると、自動的に複数のタグが登録されます。</span>
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

              {/* 📅 開始日時（インライン同期対応） */}
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-0.5">開始日時</label>
                <div className="flex space-x-1.5">
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartDate(val);
                      if (!endDate) {
                        setEndDate(val); // 💡 終了日が空なら同じ日をセット
                      }
                    }}
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

              {/* 📅 終了日時（インライン同期対応） */}
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-0.5">終了日時</label>
                <div className="flex space-x-1.5">
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEndDate(val);
                      if (!startDate) {
                        setStartDate(val); // 💡 開始日が空なら同じ日をセット
                      }
                    }}
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

        {/* 🏷️ タグ選択ポップアップ（モーダル） */}
        {isTagModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div className="absolute inset-0" onClick={() => setIsTagModalOpen(false)}></div>
            
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-lg w-full mx-4 p-6 relative z-10 animate-scaleUp max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-shrink-0">
                <h3 className="font-bold text-base text-gray-900 flex items-center gap-1.5">
                  <span>🏷️</span> タグで絞り込む
                </h3>
                <button 
                  onClick={() => setIsTagModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <div className="py-4 overflow-y-auto min-h-[10rem] max-h-[50vh] scrollbar-thin">
                <p className="text-xs text-gray-400 mb-3">
                  現在登録されているすべてのタグです。選択すると瞬時に一覧が絞り込まれます。
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {availableTags.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4 w-full">タグが登録されていません。</p>
                  ) : (
                    availableTags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setSelectedTag(t);
                          setPage(1);
                          setIsTagModalOpen(false);
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer border ${
                          selectedTag === t 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        #{t}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-between items-center flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTag('');
                    setIsTagModalOpen(false);
                  }}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  選択をクリア
                </button>
                <button
                  type="button"
                  onClick={() => setIsTagModalOpen(false)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// 💡 2. デフォルトエクスポートする EventsPage は、EventsList を Suspense で包むだけにします
export default function EventsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-medium animate-pulse">読み込み中...</p>
      </div>
    }>
      <EventsList />
    </Suspense>
  );
}