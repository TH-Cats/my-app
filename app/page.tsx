// app/page.tsx
export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Hello, DRC Members! 🏃‍♂️</h1>
      <p className="mt-2 text-gray-600">
        このテキストは <code>app/page.tsx</code> から表示しています。
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/api/coros/start"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          COROSと接続する
        </a>
      </div>
    </main>
  );
}
