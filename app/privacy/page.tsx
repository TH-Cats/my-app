export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl p-8 prose">
      <h1>Privacy Policy</h1>
      <p>
        We collect workout summary data only after users connect their accounts via
        OAuth. Data is used to power personal training dashboards, analytics, and
        optional coach feedback. We never sell data or use it for advertising.
      </p>
      <h2>Data We Collect</h2>
      <ul>
        <li>Workout summaries (type, time, duration, distance, pace/speed, elevation)</li>
        <li>HR/cadence stats and GPS route when available</li>
        <li>Basic athlete identifier</li>
      </ul>
      <h2>How We Use Data</h2>
      <ul>
        <li>Show progress and training insights</li>
        <li>Provide feedback if the user opts to share with a coach</li>
      </ul>
      <h2>Security</h2>
      <ul>
        <li>Transport over TLS; webhook signature verification</li>
        <li>Tokens encrypted at rest</li>
      </ul>
      <h2>Your Choices</h2>
      <ul>
        <li>Disconnect at any time</li>
        <li>Request deletion; we purge personal data within 30 days</li>
      </ul>
      <p className="text-sm text-gray-500">Last updated: {new Date().toISOString().slice(0, 10)}</p>
    </main>
  );
}


