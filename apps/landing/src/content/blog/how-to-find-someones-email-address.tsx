import type { PostMeta } from "./types";

export const meta: PostMeta = {
  slug: "how-to-find-someones-email-address",
  title: "How to Find Someone's Email Address: 7 Methods That Work in 2026",
  description:
    "Seven reliable ways to find someone's professional email address in 2026 — from email finders and pattern-matching to verification — plus how to keep bounce rates low.",
  h1: "How to find someone's email address: 7 methods that work",
  date: "2026-06-30",
  readingTime: "6 min read",
  category: "Prospecting",
  keywords: [
    "how to find someone's email address",
    "find email address",
    "email finder",
    "find professional email",
    "email lookup",
  ],
};

export default function Content() {
  return (
    <div className="article">
      <p>
        You found the perfect prospect on LinkedIn — now you need their email. Here are seven methods
        that actually work in 2026, roughly in order of speed, plus the one step most people skip that
        quietly wrecks their deliverability.
      </p>

      <h2>1. Use an email finder tool</h2>
      <p>
        The fastest option. Email finders take a name and company (or a LinkedIn profile) and return
        the most likely address, usually pre-verified. This is the highest-leverage method when
        you&apos;re prospecting at any real volume — manual methods don&apos;t scale past a handful.
      </p>

      <h2>2. Guess the pattern, then verify</h2>
      <p>
        Most companies use a consistent format: <code>first@company.com</code>,{" "}
        <code>first.last@company.com</code>, or <code>flast@company.com</code>. Find one known email at
        the company (a public &ldquo;contact us&rdquo; or a team member), infer the pattern, and apply
        it. Always verify before sending — see method 7.
      </p>

      <h2>3. Check their personal site or link-in-bio</h2>
      <p>
        Founders, creators, and freelancers often list an email on a personal site, portfolio, or the
        &ldquo;links&rdquo; page in their social bios. A quick visit beats guessing.
      </p>

      <h2>4. Look on GitHub, talks, and papers</h2>
      <p>
        Technical prospects frequently expose an email in GitHub commit history, conference speaker
        pages, or academic papers. If you&apos;re reaching engineers or researchers, these are gold.
      </p>

      <h2>5. Search public records of their content</h2>
      <p>
        Newsletters, podcast show notes, and press mentions often include contact details or a company
        domain you can pattern-match against. A targeted search of their name plus &ldquo;email&rdquo;
        or &ldquo;contact&rdquo; sometimes surfaces it directly.
      </p>

      <h2>6. Ask a mutual connection</h2>
      <p>
        Underrated and highly effective. A one-line intro from a shared contact both gets you the
        address <em>and</em> warms the outreach. If you share connections on LinkedIn, this is often
        your best move.
      </p>

      <h2>7. Always verify before you send</h2>
      <p>
        This is the step that separates healthy senders from spam-foldered ones. Sending to unverified
        addresses drives bounces, and a high bounce rate damages your domain reputation — which hurts
        every future email. Verify each address (check that the mailbox exists) before it enters a
        sequence.
      </p>
      <div className="callout">
        <strong>Bounce discipline:</strong> keep your bounce rate low by verifying every address and
        removing risky ones. One bad send list can undo months of domain warm-up.
      </div>

      <h2>Do it automatically while you prospect</h2>
      <p>
        Doing this by hand for every lead is a grind. <a href="https://qampi.com">Qampi</a> finds and
        verifies prospect emails as part of your workflow, then writes personalized outreach across
        LinkedIn and email — so &ldquo;find the email&rdquo; and &ldquo;send something worth
        replying to&rdquo; happen in one place.
      </p>

      <h2>Then make the email count</h2>
      <p>
        Finding the address is half the job — the message has to earn a reply. When you&apos;re ready
        to write it, see{" "}
        <a href="/blog/cold-email-vs-linkedin-outreach">cold email vs LinkedIn outreach</a> for how to
        sequence it with your LinkedIn touches.
      </p>
    </div>
  );
}
