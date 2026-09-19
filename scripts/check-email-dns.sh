#!/usr/bin/env bash
#
# Grade the sending domain's email DNS.
#
# Sending as @gmail.com passes SPF only because Google's record covers it — the
# mail carries no reputation of our own, and business inboxes filter it on that
# basis. These three records are what let a domain vouch for its own mail:
#
#   SPF    which servers may send as this domain
#   DKIM   a signature proving the message wasn't altered and came from us
#   DMARC  what receivers should do when SPF/DKIM fail, and where to report it
#
# Usage: scripts/check-email-dns.sh [domain] [dkim-selector]
set -uo pipefail

DOMAIN="${1:-qampi.com}"
SELECTOR="${2:-}"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }

printf '\n\033[1mEmail DNS for %s\033[0m\n\n' "$DOMAIN"

SPF=$(dig +short TXT "$DOMAIN" | tr -d '"' | grep -i '^v=spf1' || true)
if [ -z "$SPF" ]; then
    bad "SPF: none. Receivers have no way to tell your mail from a forgery."
else
    ok "SPF: $SPF"
    case "$SPF" in
        *"+all"*) bad "  '+all' authorises the entire internet — remove it." ;;
        *"-all"*) ok  "  hard fail (-all) — strictest, good." ;;
        *"~all"*) ok  "  soft fail (~all) — fine while you settle in." ;;
        *)        warn "  no all-qualifier; add ~all or -all." ;;
    esac
fi

DMARC=$(dig +short TXT "_dmarc.$DOMAIN" | tr -d '"' | grep -i '^v=DMARC1' || true)
if [ -z "$DMARC" ]; then
    bad "DMARC: none. Nothing tells receivers what to do when checks fail, and you get no reports."
else
    ok "DMARC: $DMARC"
    case "$DMARC" in
        *"p=none"*)   warn "  p=none monitors only. Correct to START here; tighten to quarantine once reports look clean." ;;
        *"p=reject"*) ok   "  p=reject — strongest." ;;
    esac
    echo "$DMARC" | grep -qi 'rua=' || warn "  no rua= address, so you'll never see the reports."
fi

if [ -n "$SELECTOR" ]; then
    DKIM=$(dig +short TXT "${SELECTOR}._domainkey.$DOMAIN" | tr -d '"' || true)
    [ -n "$DKIM" ] && ok "DKIM ($SELECTOR): present" || bad "DKIM ($SELECTOR): not found"
else
    FOUND=""
    for s in google resend sendgrid s1 s2 k1 mail dkim selector1 selector2; do
        [ -n "$(dig +short TXT "${s}._domainkey.$DOMAIN" | tr -d '"')" ] && FOUND="$FOUND $s"
    done
    [ -n "$FOUND" ] && ok "DKIM: found selector(s):$FOUND" \
        || bad "DKIM: no common selector found. Pass your provider's selector as arg 2 if it uses a custom one."
fi

MX=$(dig +short MX "$DOMAIN" | head -3 | tr '\n' ' ')
[ -n "$MX" ] && ok "MX: $MX" || warn "MX: none — you can SEND without it, but replies to this domain will bounce."

printf '\n\033[1mSending as:\033[0m %s\n' "${MAIL_FROM:-<MAIL_FROM unset — falls back to the SMTP user>}"
echo
