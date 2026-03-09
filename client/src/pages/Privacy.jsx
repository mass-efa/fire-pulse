export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <div className="text-3xl mb-2">🔥</div>
          <h1 className="text-2xl font-bold text-slate-100">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mt-1">Effective date: March 8, 2026</p>
        </div>

        <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-slate-100 font-semibold text-base mb-2">What we collect</h2>
            <p>
              fire-pulse collects your phone number and the portfolio data you enter (ticker symbols,
              share counts, and average cost basis). We do not collect your name beyond what you
              provide during sign-up, and we do not collect any financial account credentials.
            </p>
          </section>

          <section>
            <h2 className="text-slate-100 font-semibold text-base mb-2">How we use it</h2>
            <p>Your data is used exclusively for two purposes:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>
                <span className="text-slate-300">Authentication</span> — your phone number is used
                to send one-time login codes via SMS.
              </li>
              <li>
                <span className="text-slate-300">Briefings</span> — your portfolio data is used to
                generate your personalised AM and PM market briefings, delivered by SMS.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-slate-100 font-semibold text-base mb-2">What we never do</h2>
            <p>
              We do not sell, rent, or share your phone number or portfolio data with any third party
              for marketing, advertising, or any other commercial purpose. Your data is never used to
              build advertising profiles or shared with data brokers.
            </p>
          </section>

          <section>
            <h2 className="text-slate-100 font-semibold text-base mb-2">Third-party services</h2>
            <p>
              fire-pulse uses the following services to operate. Each processes only the minimum data
              required for their function:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Twilio — SMS delivery of login codes and briefings</li>
              <li>Supabase — secure database storage</li>
              <li>Anthropic — AI generation of briefing content (no personal data is included in prompts)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-slate-100 font-semibold text-base mb-2">Data retention</h2>
            <p>
              Your data is retained for as long as you have an active account. You can delete your
              holdings at any time from the Portfolio page. To request full account deletion, contact
              us via the Settings page.
            </p>
          </section>

          <section>
            <h2 className="text-slate-100 font-semibold text-base mb-2">Contact</h2>
            <p>
              Questions about this policy? Reach out via the{' '}
              <a href="/settings" className="text-teal-400 hover:text-teal-300 transition-colors">
                Settings
              </a>{' '}
              page inside the app.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800">
          <a href="/welcome" className="text-sm text-slate-500 hover:text-teal-400 transition-colors">
            ← Back to fire-pulse
          </a>
        </div>
      </div>
    </div>
  );
}
