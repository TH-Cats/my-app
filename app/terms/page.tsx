export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl p-8 prose">
      <h1>Terms of Service</h1>
      <h2>Use of Service</h2>
      <p>
        This service is provided for personal training insights for runners and
        club members. You agree to use the service in compliance with
        applicable laws and platform terms (e.g., COROS/Strava).
      </p>
      <h2>Accounts and Data</h2>
      <ul>
        <li>You connect your account via OAuth and can disconnect anytime.</li>
        <li>You retain ownership of your data; we process it to provide features.</li>
      </ul>
      <h2>Disclaimers</h2>
      <p>
        No warranty of fitness is provided. Training guidance is informational
        and should be adapted to your health status and professional advice.
      </p>
      <h2>Contact</h2>
      <p>For support or questions, contact the site administrator.</p>
      <p className="text-sm text-gray-500">Last updated: {new Date().toISOString().slice(0, 10)}</p>
    </main>
  );
}


