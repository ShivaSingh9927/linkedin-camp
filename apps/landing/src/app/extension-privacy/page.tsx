import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extension Privacy Policy — Qampi",
  description:
    "Privacy policy for the Qampi Lead Importer browser extension: what it collects, why, and what it does not.",
};

const UPDATED = "June 30, 2026";

export default function ExtensionPrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
          Qampi Lead Importer
        </p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Extension Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-slate-500">Last updated: {UPDATED}</p>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed">
          <p>
            This Privacy Policy describes how the{" "}
            <strong>Qampi&nbsp;&mdash;&nbsp;Lead&nbsp;Importer</strong> browser
            extension (&ldquo;the Extension&rdquo;), published by Qampi
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;), handles information. Questions:{" "}
            <a
              href="mailto:privacy@qampi.com"
              className="font-medium text-indigo-600 hover:underline"
            >
              privacy@qampi.com
            </a>
            .
          </p>

          <section>
            <h2 className="text-xl font-bold text-slate-900">Single purpose</h2>
            <p className="mt-3">
              The Extension lets a signed-in Qampi user import LinkedIn leads
              into their Qampi account and keep the reply status of those leads
              in sync with their Qampi dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900">
              What we collect and why
            </h2>
            <p className="mt-3">
              The Extension only processes data when you are signed in to Qampi
              and actively use a feature.
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4 font-semibold">Data</th>
                    <th className="py-2 pr-4 font-semibold">Why</th>
                    <th className="py-2 font-semibold">Where it goes</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-b border-slate-100">
                    <td className="py-3 pr-4">
                      <strong>Qampi authentication token</strong>
                    </td>
                    <td className="py-3 pr-4">
                      To authenticate your requests to the Qampi API on your
                      behalf.
                    </td>
                    <td className="py-3">
                      Stored locally in the browser; sent only to the Qampi API
                      (api.qampi.com).
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 pr-4">
                      <strong>LinkedIn lead data you choose to import</strong>{" "}
                      (name, headline/title, profile URL, company, education,
                      location)
                    </td>
                    <td className="py-3 pr-4">
                      To create or update lead records in your Qampi account.
                    </td>
                    <td className="py-3">Sent to the Qampi API (api.qampi.com).</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 pr-4">
                      <strong>CSV text you paste into the batch processor</strong>
                    </td>
                    <td className="py-3 pr-4">
                      Parsed on your device to structure lead fields.
                    </td>
                    <td className="py-3">
                      Stays in the browser; only the leads you import are sent to
                      Qampi.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4">
                      <strong>Reply-status signals</strong> (a LinkedIn
                      conversation URL and whether a reply was detected)
                    </td>
                    <td className="py-3 pr-4">
                      To update the lead&rsquo;s status in your dashboard.
                    </td>
                    <td className="py-3">Sent to the Qampi API (api.qampi.com).</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900">
              What we do not collect
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                We do <strong>not</strong> read, store, or transmit your LinkedIn
                cookies, passwords, or login credentials.
              </li>
              <li>
                We do <strong>not</strong> collect browsing history beyond the
                pages required for the features above (linkedin.com and your
                Qampi dashboard).
              </li>
              <li>
                We do <strong>not</strong> sell, rent, or share your data with
                third parties.
              </li>
              <li>
                We do <strong>not</strong> use your data for advertising.
              </li>
              <li>
                The CSV batch processor runs entirely on-device &mdash; your CSV
                is never uploaded.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900">
              Data storage and retention
            </h2>
            <p className="mt-3">
              The authentication token is stored locally and removed when you
              sign out or remove the Extension. Imported leads live in your Qampi
              account and can be deleted at any time from your dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900">Permissions</h2>
            <p className="mt-3">
              Each browser permission the Extension requests is used solely to
              deliver the single purpose above: storing your auth token, locating
              your open Qampi and LinkedIn tabs, reading lead data from LinkedIn
              pages you are viewing, and showing the import side panel.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900">
              Changes to this policy
            </h2>
            <p className="mt-3">
              Material changes will be reflected by the &ldquo;Last
              updated&rdquo; date above.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900">Contact</h2>
            <p className="mt-3">
              Questions or data-deletion requests:{" "}
              <a
                href="mailto:privacy@qampi.com"
                className="font-medium text-indigo-600 hover:underline"
              >
                privacy@qampi.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
