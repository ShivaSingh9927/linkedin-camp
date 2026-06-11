#!/bin/bash
set -e

# Set target: local, hetzner-worker, or hetzner-db
TARGET="${TARGET:-local}"
case "$TARGET" in
    local)
        BASE_URL="http://localhost:8001"
        SSH_HOST=""
        ;;
    hetzner-worker)
        BASE_URL="http://10.0.0.4:8001"
        SSH_HOST="deploy@204.168.167.198"
        ;;
    hetzner-db)
        BASE_URL="http://localhost:8001"
        SSH_HOST="deploy@89.167.123.143"
        ;;
    *)
        echo "Unknown TARGET: $TARGET. Use: local, hetzner-worker, or hetzner-db"
        exit 1
        ;;
esac
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
USERS_DIR="$TEST_DIR/users"
LEADS_DIR="$TEST_DIR/leads"
RESULTS_DIR="$TEST_DIR/results"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

mkdir -p "$RESULTS_DIR"

usage() {
    echo "Usage:"
    echo "  $0 strategy <user>"
    echo "  $0 message <user> <campaign-num> <lead-name> [email]"
    echo "  $0 summary <user>"
    echo ""
    echo "Examples:"
    echo "  $0 strategy user01"
    echo "  $0 message user01 01 lead-kapil-rathee"
    echo "  $0 message user01 05 lead-anuj-arora email"
    echo "  $0 summary user01"
    echo ""
    echo "Available users:"
    for d in "$USERS_DIR"/*/; do
        name=$(basename "$d")
        echo "  - $name"
    done
    exit 1
}

if [ $# -lt 2 ]; then
    usage
fi

MODE="$1"
USER_ID="$2"
CAMPAIGN_NUM="${3:-}"
LEAD_NAME="${4:-}"
CHANNEL="${5:-linkedin}"

# Resolve user folder
USER_DIR=$(find "$USERS_DIR" -maxdepth 1 -type d -name "${USER_ID}*" | head -1)
if [ -z "$USER_DIR" ]; then
    echo -e "${RED}ERROR: User '$USER_ID' not found in $USERS_DIR${NC}"
    exit 1
fi
USER_NAME=$(basename "$USER_DIR")
PROFILE_FILE="$USER_DIR/profile.json"
CAMPAIGNS_DIR="$USER_DIR/campaigns"

# Load profile
if [ ! -f "$PROFILE_FILE" ]; then
    echo -e "${RED}ERROR: profile.json not found for $USER_NAME${NC}"
    exit 1
fi

profile=$(cat "$PROFILE_FILE")

send_request() {
    local endpoint="$1"
    local payload="$2"
    local result_dir="$3"
    local label="$4"

    mkdir -p "$result_dir"

    # Save request
    echo "$payload" | python3 -m json.tool > "$result_dir/request.json" 2>/dev/null || echo "$payload" > "$result_dir/request.json"

    echo -e "${YELLOW}[$label] Calling $BASE_URL$endpoint ...${NC}"

    # Encode payload to base64 to avoid shell escaping issues
    payload_b64=$(echo "$payload" | base64 -w0)

    if [ -n "$SSH_HOST" ]; then
        # SSH approach: pipe base64 payload, decode on remote, pipe to curl
        response=$(ssh "$SSH_HOST" "echo '$payload_b64' | base64 -d | curl -s -w \"\n%{http_code}\" -X POST '$BASE_URL$endpoint' -H 'Content-Type: application/json' -d @-" 2>/dev/null)
    else
        # Local approach
        response=$(echo "$payload" | curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" -H "Content-Type: application/json" -d @-)
    fi

    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')

    # Save response
    echo "$body" | python3 -m json.tool > "$result_dir/response.json" 2>/dev/null || echo "$body" > "$result_dir/response.json"

    # Summary
    {
        echo "=== $label ==="
        echo "Endpoint: $endpoint"
        echo "Target: $BASE_URL"
        echo "HTTP: $http_code"
        echo "Timestamp: $(date -Iseconds)"
        echo ""
        if echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success', d.get('passed', True)))" 2>/dev/null | grep -q "True"; then
            echo "STATUS: SUCCESS"
        else
            echo "STATUS: FAILED (or unexpected shape)"
        fi
    } > "$result_dir/summary.txt"

    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ $label - HTTP 200${NC}"
    else
        echo -e "${RED}✗ $label - HTTP $http_code${NC}"
        echo "$body" | head -5
    fi

    echo "$result_dir"
    return 0
}

case "$MODE" in
    followup)
        if [ -z "$CAMPAIGN_NUM" ] || [ -z "$LEAD_NAME" ]; then
            echo -e "${RED}ERROR: followup mode needs <prev-result-id> and <step-num>${NC}"
            echo "  $0 followup <user> <prev-result-id> <step-num> [channel]"
            echo ""
            echo "Takes a previous message result, reads the sent message,"
            echo "and generates a follow-up as if the lead never replied."
            echo ""
            echo "Example:"
            echo "  # First message"
            echo "  ./test-runner.sh message user01 01 lead-nageen-kommu"
            echo "  # Follow-up (step 2 of 3)"
            echo "  ./test-runner.sh followup user01 B1-message-...-lead-nageen-kommu 2"
            exit 1
        fi

        PREV_RESULT_ID="$CAMPAIGN_NUM"
        STEP_NUM="${LEAD_NAME:-2}"
        CHANNEL="${5:-linkedin}"
        CAMPAIGN_NUM=""

        # Find previous result
        prev_result_dir=$(find "$RESULTS_DIR" -maxdepth 1 -type d -name "*${PREV_RESULT_ID}*" | head -1)
        if [ -z "$prev_result_dir" ]; then
            echo -e "${RED}ERROR: No previous result matching '$PREV_RESULT_ID' found in $RESULTS_DIR${NC}"
            exit 1
        fi

        prev_response="$prev_result_dir/response.json"
        prev_request="$prev_result_dir/request.json"
        if [ ! -f "$prev_response" ] || [ ! -f "$prev_request" ]; then
            echo -e "${RED}ERROR: Previous result missing response.json or request.json${NC}"
            exit 1
        fi

        # Extract campaign number and recipient name from previous request
        result_basename=$(basename "$prev_result_dir")

        echo -e "${YELLOW}Generating follow-up (step $STEP_NUM) based on: $result_basename${NC}"

        echo "$profile" > /tmp/_profile.json

        # Read recipient name from previous request to find lead
        prev_req_raw=$(cat "$prev_request" 2>/dev/null || echo "{}")
        prev_recipient=$(echo "$prev_req_raw" | python3 -c "import sys,json; print(json.load(sys.stdin).get('recipient_name',''))" 2>/dev/null)
        
        # Find lead file by recipient name
        lead_file=$(python3 -c "
import json, os, glob
leads_dir = '$LEADS_DIR'
target = '$prev_recipient'.strip().lower()
first = target.split()[0] if ' ' in target else target
last = target.split()[-1] if ' ' in target else ''
for f in os.listdir(leads_dir):
    if not f.endswith('.json'):
        continue
    with open(os.path.join(leads_dir, f)) as fh:
        l = json.load(fh)
    fn = (l.get('firstName') or '').strip().lower()
    ln = (l.get('lastName') or '').strip().lower()
    if fn == first or fn in target:
        print(os.path.join(leads_dir, f))
        break
" 2>/dev/null | head -1)

        if [ -z "$lead_file" ]; then
            echo -e "${RED}ERROR: Could not find lead file for recipient: $prev_recipient${NC}"
            # Fallback: try extracting lead name from folder as before
            prev_lead=$(echo "$result_basename" | grep -oP 'lead-[a-zA-Z0-9._()-]+$' || echo "")
            lead_file=$(find "$LEADS_DIR" -name "${prev_lead}.json" 2>/dev/null | head -1)
        fi

        # Find campaign from previous request's campaign_description
        prev_camp_desc=$(echo "$prev_req_raw" | python3 -c "import sys,json; print(json.load(sys.stdin).get('campaign_description',''))" 2>/dev/null)
        campaign_file=$(python3 -c "
import json, os, glob
camp_dir = '$CAMPAIGNS_DIR'
target_desc = '''$prev_camp_desc'''
for f in sorted(os.listdir(camp_dir)):
    if not f.endswith('.json'):
        continue
    with open(os.path.join(camp_dir, f)) as fh:
        c = json.load(fh)
    if c.get('description') == target_desc or (target_desc and target_desc.startswith(c.get('description','')[:30])):
        print(os.path.join(camp_dir, f))
        break
" 2>/dev/null | head -1)

        if [ -z "$campaign_file" ]; then
            # Fallback: try the old way
            prev_camp_num=$(echo "$result_basename" | grep -oP '\b\d{2}-[a-z]' | head -1 | grep -oP '\d{2}' || echo "01")
            campaign_file=$(ls "$CAMPAIGNS_DIR/${prev_camp_num}-"*.json 2>/dev/null | head -1)
        fi

        if [ -z "$campaign_file" ]; then
            echo -e "${RED}ERROR: Could not find campaign file${NC}"
            exit 1
        fi

        payload=$(python3 << PYEOF
import json

p = json.load(open('/tmp/_profile.json'))
c = json.load(open('$campaign_file'))
l = json.load(open('$lead_file'))
prev_resp = json.load(open('$prev_response'))
prev_req = json.load(open('$prev_request'))

recipient_name = f"{l.get('firstName','')} {l.get('lastName','')}".strip()
if not recipient_name:
    recipient_name = l.get('firstName', 'Lead')

# Read the first message that was already sent
first_message = prev_resp.get("message", "")
total_steps = 3

completed_steps = []
for i in range(1, int($STEP_NUM)):
    completed_steps.append({"type": f"message_{i}", "label": f"LinkedIn message {i}"})

req = {
    "recipient_name": recipient_name,
    "recipient_headline": l.get("headline") or "",
    "company": l.get("company") or "",
    "job_title": l.get("jobTitle") or "",
    "location": l.get("location") or "",
    "about": l.get("aboutInfo") or "",
    "campaign_description": c.get("description") or c.get("useCase") or "",
    "connection_context": c.get("useCase") or c.get("aiStrategyHint", {}).get("objective", ""),
    "tone": c.get("toneOverride", "professional"),
    "cta": c.get("aiStrategyHint", {}).get("cta", "connect"),
    "channel": "$CHANNEL",
    "persona": p.get("persona", ""),
    "value_proposition": p.get("valueProp", ""),
    "user_context": {
        "sender_name": p.get("displayName", ""),
        "company": p.get("company", ""),
        "companyDescription": p.get("companyDescription", ""),
        "products": p.get("products", ""),
        "differentiators": p.get("differentiators", ""),
        "communicationStyle": p.get("communicationStyle", ""),
        "writingSamples": p.get("writingSamples", [])
    },
    "campaign_progress": {
        "stepNumber": int($STEP_NUM),
        "totalSteps": total_steps,
        "completedSteps": completed_steps,
        "pendingSteps": [f"message_{i}" for i in range(int($STEP_NUM) + 1, total_steps + 1)],
        "daysSinceFirstTouch": (int($STEP_NUM) - 1) * 4,
        "thisStepLabel": "follow-up message (lead did not reply)"
    },
    "message_history": [
        {
            "channel": "linkedin",
            "body": first_message,
            "sentAt": f"2026-06-{(int($STEP_NUM)-1)*4 + 1:02d}T10:00:00Z"
        }
    ]
}

print(json.dumps(req))
PYEOF
)
        label="FOLLOWUP-$USER_NAME-camp${prev_camp_num}-step${STEP_NUM}-${prev_lead}"
        result_dir="$RESULTS_DIR/B1-followup-$USER_NAME-$(printf "%02d" "$prev_camp_num")-step${STEP_NUM}-${prev_lead}"
        send_request "/ai/message" "$payload" "$result_dir" "$label"
        ;;

    strategy)
        label="STRATEGY-$USER_NAME"
        # Extract fields from profile for the strategy request
        echo "$profile" > /tmp/_profile.json
        user_id=$(echo "$USER_ID" | sed 's/-.*//')

        payload=$(python3 << PYEOF
import json
p = json.load(open('/tmp/_profile.json'))
req = {
    "user_id": "$user_id",
    "company": p.get("company", ""),
    "industry": p.get("industry", ""),
    "persona": p.get("persona", ""),
    "valueProp": p.get("valueProp", ""),
    "targetAudience": p.get("targetAudience", ""),
    "mainPainPoint": p.get("mainPainPoint", ""),
    "companyDescription": p.get("companyDescription", ""),
    "products": p.get("products", ""),
    "differentiators": p.get("differentiators", ""),
    "communicationStyle": p.get("communicationStyle", ""),
    "writingSamples": p.get("writingSamples", []),
    "tonePreferences": p.get("tonePreferences", []),
    "website": p.get("website", ""),
    "trigger": "manual",
    "force_regenerate": True
}
print(json.dumps(req))
PYEOF
)
        result_dir="$RESULTS_DIR/A1-strategy-$USER_NAME"
        send_request "/ai/generate-strategy" "$payload" "$result_dir" "$label"
        ;;

    message)
        if [ -z "$CAMPAIGN_NUM" ] || [ -z "$LEAD_NAME" ]; then
            echo -e "${RED}ERROR: message mode needs <campaign-num> and <lead-name>${NC}"
            echo "  $0 message <user> <campaign-num> <lead-name> [email]"
            exit 1
        fi

        # Find campaign file
        campaign_file=$(ls "$CAMPAIGNS_DIR/${CAMPAIGN_NUM}-"*.json 2>/dev/null | head -1)
        if [ -z "$campaign_file" ]; then
            echo -e "${RED}ERROR: Campaign '$CAMPAIGN_NUM' not found for $USER_NAME${NC}"
            echo "Available campaigns:"
            ls "$CAMPAIGNS_DIR/"
            exit 1
        fi

        # Find lead file
        lead_file=$(find "$LEADS_DIR" -name "${LEAD_NAME}.json" 2>/dev/null | head -1)
        if [ -z "$lead_file" ]; then
            echo -e "${RED}ERROR: Lead '$LEAD_NAME' not found in $LEADS_DIR${NC}"
            echo "Available leads (first 10):"
            ls "$LEADS_DIR/" | head -10
            exit 1
        fi

        campaign_name=$(basename "$campaign_file" .json | sed 's/^[0-9]*-//')
        lead_basename=$(basename "$lead_file" .json)
        label="MESSAGE-$USER_NAME-$(printf "%02d" "$CAMPAIGN_NUM")-${campaign_name}-${lead_basename}"

        payload=$(python3 << PYEOF
import json

p = json.load(open('/tmp/_profile.json'))
c = json.load(open('$campaign_file'))
l = json.load(open('$lead_file'))

recipient_name = f"{l.get('firstName','')} {l.get('lastName','')}".strip()
if not recipient_name:
    recipient_name = l.get('firstName', 'Lead')

req = {
    "recipient_name": recipient_name,
    "recipient_headline": l.get("headline") or "",
    "company": l.get("company") or "",
    "job_title": l.get("jobTitle") or "",
    "location": l.get("location") or "",
    "about": l.get("aboutInfo") or "",
    "campaign_description": c.get("description") or c.get("useCase") or "",
    "connection_context": c.get("useCase") or c.get("aiStrategyHint", {}).get("objective", ""),
    "tone": c.get("toneOverride", "professional"),
    "cta": c.get("aiStrategyHint", {}).get("cta", "connect"),
    "channel": "$CHANNEL",
    "persona": p.get("persona", ""),
    "value_proposition": p.get("valueProp", ""),
    "user_context": {
        "sender_name": p.get("displayName", ""),
        "company": p.get("company", ""),
        "companyDescription": p.get("companyDescription", ""),
        "products": p.get("products", ""),
        "differentiators": p.get("differentiators", ""),
        "communicationStyle": p.get("communicationStyle", ""),
        "writingSamples": p.get("writingSamples", [])
    }
}

print(json.dumps(req))
PYEOF
)
        result_dir="$RESULTS_DIR/B1-message-$USER_NAME-$(printf "%02d" "$CAMPAIGN_NUM")-${campaign_name}-${lead_basename}"
        send_request "/ai/message" "$payload" "$result_dir" "$label"
        ;;

    summary)
        label="SUMMARY-$USER_NAME"
        payload=$(python3 << PYEOF
import json
p = json.load(open('/tmp/_profile.json'))
req = {
    "name": f"{p.get('displayName', '')}",
    "headline": p.get('persona', ''),
    "about": p.get('companyDescription', ''),
    "company": p.get('company', ''),
    "job_title": p.get('communicationStyle', ''),
    "location": "",
    "posts": []
}
print(json.dumps(req))
PYEOF
)
        result_dir="$RESULTS_DIR/C1-summary-$USER_NAME"
        send_request "/ai/profile-summary" "$payload" "$result_dir" "$label"
        ;;

    *)
        usage
        ;;
esac
