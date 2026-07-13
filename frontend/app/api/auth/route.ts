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

export async function PUT(request: Request) {
  return handleRequest(request, 'PUT');
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

    // 💡 POST または PUT の場合は、フロントからのデータを解析して引き継ぐ
    if (method === 'POST' || method === 'PUT') {
      let body: any;
      const rawBody = await request.text();
      try {
        body = JSON.parse(rawBody);
        if (typeof body === 'string') {
          body = JSON.parse(body);
        }
      } catch (e) {
        body = rawBody;
      }
      
      // ログインモード（POSTのみ想定）のときは Form 形式
      if (mode === 'login') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        const formData = new URLSearchParams();
        formData.append('username', body.username);
        formData.append('password', body.password);
        requestBody = formData.toString();
      } else {
        // 💡 通常の POST や、今回の PUT はすべてここを通る
        // JSON形式として正しい文字列にして requestBody に格納する
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      }
    }

    // 🚀 これで method='PUT' のときも requestBody がしっかり fetch に渡されます！
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