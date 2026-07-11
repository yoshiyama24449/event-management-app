import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  return handleRequest(request, 'POST');
}

export async function GET(request: Request) {
  return handleRequest(request, 'GET');
}

// 💡 追加：DELETE リクエストも中継できるようにする
export async function DELETE(request: Request) {
  return handleRequest(request, 'DELETE');
}

async function handleRequest(request: Request, method: string) {
  try {
    const { searchParams } = new URL(request.url);
    // 💡 フロントエンドから「どのURLに送りたいか（例: /dashboard や /events）」を受け取る
    const path = searchParams.get('path') || '';
    const mode = searchParams.get('mode') || '';

    // フロントエンドからのヘッダー（JWTトークンなど）を引き継ぐ
    const authHeader = request.headers.get('Authorization');
    const customHeader = request.headers.get('X-User-Name');

    const headers: Record<string, string> = {};
    if (authHeader) headers['Authorization'] = authHeader;
    if (customHeader) headers['X-User-Name'] = customHeader;

    // バックエンド（FastAPI）の正式なURLを組み立て
    let backendPath = path;
    if (mode === 'login') {
      backendPath = '/auth/login';
    } else if (mode === 'register') {
      backendPath = '/auth/signup';
    }

    let backendUrl = `http://backend:8000${backendPath}`;
    let requestBody: any = undefined;

    if (method === 'POST') {
      // 💡 どんな形式で送られてきても安全にオブジェクトにパースする
      let body: any;
      const rawBody = await request.text();
      try {
        body = JSON.parse(rawBody);
        // もしパースした結果がまだ文字列だったら、もう一度パースする（二重stringify対策）
        if (typeof body === 'string') {
          body = JSON.parse(body);
        }
      } catch (e) {
        body = rawBody;
      }
      
      // ログイン時のみフォームデータ形式に変換
      if (mode === 'login') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        const formData = new URLSearchParams();
        formData.append('username', body.username);
        formData.append('password', body.password);
        requestBody = formData.toString();
      } else {
        // 💡 綺麗に整形されたオブジェクトを、1回だけ正しく文字列化して送信
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      }
    }

    // 🚀 Next.jsの裏側（コンテナ間）でFastAPIと安全に通信
    const res = await fetch(backendUrl, {
      method: method,
      headers: headers,
      body: requestBody,
    });

    // バックエンドが中身のないレスポンス（204など）を返した場合のハンドリング
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ detail: '中継サーバーでエラーが発生しました。' }, { status: 500 });
  }
}