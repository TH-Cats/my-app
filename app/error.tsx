"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>エラーが発生しました</h1>
        <p style={{ marginTop: 8, color: '#555' }}>ページの読み込み中にクライアント側のエラーが発生しました。再読み込みしてください。</p>
        <div style={{ marginTop: 16 }}>
          <button onClick={() => reset()} style={{ padding: '8px 12px', borderRadius: 6, background: '#2563eb', color: '#fff', border: 0 }}>再試行</button>
          <button onClick={() => location.reload()} style={{ padding: '8px 12px', borderRadius: 6, marginLeft: 8 }}>リロード</button>
        </div>
        {process.env.NODE_ENV !== 'production' && (
          <pre style={{ marginTop: 24, fontSize: 12, color: '#666', whiteSpace: 'pre-wrap' }}>{String(error?.message || '')}</pre>
        )}
      </body>
    </html>
  );
}


