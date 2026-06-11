# Voyager API Test Results

## Working Endpoints (GET - Read Only)

| Endpoint | Status | Key Insight |
|----------|--------|-------------|
| `/me` | 200 | Returns plainId + encrypted profile ID in miniProfile URN |
| `/identity/profiles/{encryptedId}/highlights` | 200 | Requires ENCRYPTED ID (from miniProfile URN), NOT plain member ID |
| `/identity/dash/profiles?q=memberIdentity&memberIdentity={encryptedId}` | 200 | Returns profile structure via Restli protocol |
| `/relationships/connectionsSummary` | 200 | Connection count |
| `/voyagerRelationshipsDashGenericInvitationFacets?q=sent` | 200 | Sent invites count |
| `/voyagerMessagingPeripheralRecipientSuggestions` | 200 | Returns suggested recipients with full profile data |

## Failing Endpoints (POST - Write Operations)

| Endpoint | Status | Error |
|----------|--------|-------|
| `/voyagerMessagingDashMessengerMessages?action=createMessage` | 400 | Bad request |
| `/messaging/conversations?action=create` | 403 | "This profile can't be accessed" |
| `/messaging/conversations` (GET) | 500 | Server error |
| `/search/blended` | 404 | Not found |
| `/search/hits` | 502 | Tunnel connection failed |
| `/search/cluster` | 400 | Bad request |

## Key Findings

1. **Encrypted IDs required**: LinkedIn voyager API now requires encrypted profile IDs
   (e.g., `ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRl0`), NOT plain member IDs (`1761142362`).

2. **Write endpoints are gated**: All POST/write endpoints fail even with valid cookies.
   LinkedIn requires additional browser-derived tokens for write operations.

3. **Waalaxy's approach**: 
   - OAuth for identity verification
   - Chrome extension reads browser cookies → sends to stargate
   - Stargate handles login, CAPTCHAs, 2FA server-side
   - SLAAPI library does the voyager API calls with full browser context

## Architecture Decision

- READ operations: Use pure voyager API from Node.js (fast, no browser)
- WRITE operations: Use browser-based DOM automation (handles LinkedIn's browser gating)
- SEARCH: Use SSR/HTML scraping from LinkedIn search pages (search API endpoints are broken)
- SESSION: Cookie injection from DB → browser → voyager API (warm/cold path)

## Waalaxy Source Architecture

Waalaxy is a monorepo with ~20 Greek-mythology-themed microservices:
- **Mystique** (app.waalaxy.com): React frontend
- **Stargate** (stargate.prod.aws.waalaxy.com): Main API, auth, user management
- **Otto** (otto.prod.aws.waalaxy.com): Campaign execution engine
- **Lifeline**: Session/membership management
- **Shiva**: LinkedIn action execution
- **SLAAPI**: LinkedIn Voyager API client library
- **Girbal**: LinkedIn auth user store
- **Voltaire**: Message content/template management
- **Profesor**: Prospect/lead management

Chrome Extension ID (production): `hlkiignknimkfafapmgpbnbnmkajgljh`
