# Sending Qampi mail from qampi.com

**State as of 2026-09-19:** `qampi.com` publishes **no SPF, no DKIM, no DMARC,
no MX**. Every Qampi email goes out as `qampi.team@gmail.com`.

That sends — Google's SPF record covers it — but the mail carries **no
reputation of our own**. It's a consumer address delivering business mail, which
is what lands welcome emails in Promotions or spam. No amount of application
code fixes it; the fix is DNS plus a sending domain.

Verify at any point with:

```bash
npm --workspace backend run check:email-dns          # or: scripts/check-email-dns.sh qampi.com
```

## Pick a sender

| | Good for | Cost |
|---|---|---|
| **Resend** | fastest path — domain verification is 3 DNS records, good logs | free to 3k/mo |
| **Amazon SES** | cheapest at volume, more setup, sandbox until you request production | ~$0.10 / 1k |
| **Google Workspace** | you also want `@qampi.com` mailboxes; keeps today's SMTP code unchanged | ~$6/user/mo |

Any of them works with the existing mailer — it's plain SMTP, so switching is
three env vars, no code change.

## The three records

Exact values come from whichever provider you choose; the shapes are:

```
SPF     TXT  qampi.com            v=spf1 include:<provider> ~all
DKIM    TXT  <selector>._domainkey.qampi.com   (provider gives you this verbatim)
DMARC   TXT  _dmarc.qampi.com     v=DMARC1; p=none; rua=mailto:dmarc@qampi.com
```

**Start DMARC at `p=none`.** It changes nothing about delivery and simply mails
you reports on what's passing. Once a fortnight of reports looks clean, move to
`p=quarantine`, then `p=reject`. Going straight to `reject` before you can see
the reports is how a company silently blackholes its own invoices.

One SPF record only — two `v=spf1` TXT records on the same name is a permanent
error, and receivers treat it as no SPF at all.

## Then switch the app

```bash
SMTP_HOST=<provider host>
SMTP_PORT=587
SMTP_USER=<provider user / API key id>
SMTP_PASS=<provider secret>
MAIL_FROM="Qampi <noreply@qampi.com>"
MAIL_REPLY_TO=support@qampi.com      # optional; noreply addresses annoy people who reply
BACKEND_PUBLIC_URL=https://api.qampi.com   # used to build unsubscribe links
```

Restart, then confirm the transport and the new From with one self-send:

```bash
ssh deploy@204.168.167.198 "docker exec backend-api node -e \"
  const nm=require('/app/node_modules/nodemailer');
  const t=nm.createTransport({host:process.env.SMTP_HOST,port:587,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
  t.verify().then(()=>t.sendMail({from:process.env.MAIL_FROM,to:'you@example.com',subject:'domain check',text:'ok'}))
   .then(i=>console.log('sent',i.messageId)).catch(e=>console.log('ERR',e.message));\""
```

Send one to a Gmail address and open **Show original**: you want
`SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`. Anything else is visible there before
your users ever see it.

## What the app already does

- **`List-Unsubscribe` + `List-Unsubscribe-Post`** on nudge email, so recipients
  unsubscribe from their mail client's own button rather than pressing *report
  spam*. Complaints are what actually destroy a domain, and they'd take billing
  and security mail down along with the marketing.
- **`EmailLog`** records every send, including skips and failures — so "did it
  go out?" has an answer.
- **Opt-out** is honoured for nudges and ignored for billing/security.

## Warm up

A domain with no history that suddenly sends hundreds of messages looks exactly
like a compromised one. Transactional volume (welcome, campaign notifications)
is naturally low and warms gently on its own — just don't launch a bulk
re-engagement blast on day one. `REENGAGE_AFTER_DAYS` is env-tunable if you want
to stagger the first wave.
