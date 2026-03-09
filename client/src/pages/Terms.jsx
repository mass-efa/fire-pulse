export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <div className="text-3xl mb-2">🔥</div>
          <h1 className="text-2xl font-bold text-slate-100">Terms of Service</h1>
          <p className="text-sm text-slate-500 mt-1">Effective date: March 8, 2026</p>
        </div>

        <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-slate-100 font-semibold text-base mb-2">About the service</h2>
            <p>
              fire-pulse is a twice-daily AI portfolio briefing service. After you add your holdings,
              fire-pulse sends you a personalised market briefing by SMS each morning and evening on
              trading days, covering price movements, analyst sentiment, and macro context relevant to
              your portfolio.
            </p>
          </section>

          <section>
            <h2 className="text-slate-100 font-semibold text-base mb-2">SMS messaging</h2>
            <ul className="space-y-2 text-slate-400">
              <li>
                <span className="text-slate-300 font-medium">Message frequency:</span> Up to 2
                briefing messages per day (AM and PM), plus one-time authentication codes when you
                sign in.
              </li>
              <li>
                <span className="text-slate-300 font-medium">Message and data rates may apply.</span>{' '}
                Standard carrier rates for SMS and data apply depending on your plan.
              </li>
              <li>
                <span className="text-slate-300 font-medium">Opt-out:</span> Text{' '}
                <span className="font-mono text-slate-200">STOP</span> at any time to unsubscribe
                from briefing messages. You will receive a confirmation and no further briefing
                messages will be sent.
              </li>
              <li>
                <span className="text-slate-300 font-medium">Help:</span> Text{' '}
                <span className="font-mono text-slate-200">HELP</span> for support information.
              </li>
              <li>
                <span className="text-slate-300 font-medium">Support:</span> For help with your
                account or this service, visit the{' '}
                <a href="/settings" className="text-teal-400 hover:text-teal-300 transition-colors">
                  Settings
                </a>{' '}
                page inside the app.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-slate-100 font-semibold text-base mb-2">Not financial advice</h2>
            <p>
              fire-pulse briefings are for informational purposes only. Nothing in a briefing
              constitutes financial, investment, tax, or legal advice. Always do your own research and
              consult a qualified financial adviser before making investment decisions.
            </p>
          </section>

          <section>
            <h2 className="text-slate-100 font-semibold text-base mb-2">Acceptable use</h2>
            <p>
              You agree to use fire-pulse only for lawful purposes and not to misuse the service,
              attempt to gain unauthorised access, or submit false or misleading information.
            </p>
          </section>

          <section>
            <h2 className="text-slate-100 font-semibold text-base mb-2">Changes to these terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the service after changes
              are posted constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-slate-100 font-semibold text-base mb-2">Contact</h2>
            <p>
              Questions? Reach out via the{' '}
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
