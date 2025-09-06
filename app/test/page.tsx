// Ultra simple test page - no imports, no complexity
export default function TestPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Test Page</h1>
      <p>If you can see this, Next.js is working on Vercel!</p>
      <p>Time: {new Date().toISOString()}</p>
    </div>
  );
}
