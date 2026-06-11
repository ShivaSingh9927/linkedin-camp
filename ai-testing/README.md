# AI Testing

Test data for AI server `/ai/generate-strategy` endpoint.

## Structure

```
ai-testing/
├── users/                          # One folder per test user
│   └── user01-sai-sangineni/       # User 01: Sai Sangineni (Tech Vedika)
│       ├── profile.json            # User profile (maps to StrategyRequest.user_input)
│       └── campaigns/              # Campaign objectives for this user
│           ├── 01-*.json
│           └── ...
├── leads/                          # Shared lead pool (target data)
│   ├── lead-kapil-rathee.json
│   └── ...
├── templates/                      # Reference campaign templates from backend
│   └── ...
└── README.md
```

## Adding a New User

```bash
mkdir users/user02-name/
# Create profile.json (use user01 as reference)
# Create campaigns/01-*.json
```

## Usage

Each `userXX/` folder is self-contained:
- `profile.json` → POST body for `/ai/generate-strategy`
- `campaigns/*.json` → different campaign objectives to test
- `leads/` → target leads shared across all users (imported from Stealth Enrichment campaigns)
