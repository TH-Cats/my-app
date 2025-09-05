// app/page.tsx
'use client';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Hello, DRC Members! 🏃‍♂️</h1>
      <p className="mt-2 text-gray-600">
        このテキストは <code>app/page.tsx</code> から表示しています。
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/api/strava/start"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Stravaと接続する
        </a>
        <a
          href="#"
          onClick={async (e) => {
            e.preventDefault();
            const athleteId = prompt('Strava athleteId を入力 (例: 47171719)');
            if (!athleteId) return;
            await fetch('/api/strava/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ athleteId, limit: 30 }),
            }).then(async (r) => alert(JSON.stringify(await r.json())));
          }}
          className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          最近のアクティビティを取り込む
        </a>
        <a
          href="/activities"
          className="inline-block bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          Activitiesを見る
        </a>
      </div>
    </main>
  );
}
