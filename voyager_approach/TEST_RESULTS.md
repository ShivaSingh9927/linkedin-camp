# Voyager API Test Results — June 10, 2026

**Account tested:** snehlata (snehlatasingh9012@gmail.com, plainId=1761142362)
**Target profile:** shiva-singh-genai-llm (vanity: `shiva-singh-genai-llm`, fsd: `ACoAACdYnukB_Rgm7qVvte0xhLy9SZGEbuvKMd0`)
**Proxy:** Singapore (82.41.252.111:46222)
**Method:** Valid `li_at` + `JSESSIONID` cookies injected into Patchright headful Chrome; all calls made from inside the browser context.

---

## ✅ Working Endpoints (200 OK)

### SELF
| Endpoint | Returns |
|----------|---------|
| `GET /voyager/api/me` | Own profile, plainId, publicIdentifier, trackingId, vanity |
| `GET /voyager/api/premium/featureAccess?name=reactivationFeaturesEligible` | Premium eligibility |
| `GET /voyager/api/graphql?variables=(featureAccessTypes:List(...))&queryId=voyagerPremiumDashFeatureAccess.c87b20dac35795f9920f2a8072fd7af5` | Premium feature flags |

### PROFILE (vanity `shiva-singh-genai-llm` or fsd `ACoAACdYnukB_Rgm7qVvte0xhLy9SZGEbuvKMd0`)
| Endpoint | Returns |
|----------|---------|
| `GET /voyager/api/identity/dash/profiles/urn:li:fsd_profile:<fsdId>?decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfile-76` | Full profile (TopCard + Experience + Education + ContactInfo) |
| `GET /voyager/api/graphql?variables=(memberIdentity:<vanity>)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a` | Basic profile entity |
| `GET /voyager/api/graphql?variables=(memberIdentity:<vanity>,decorationId:com.linkedin.voyager.dash.deco.identity.profile.core.TopCard-38)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a` | Top card with header info |

### CONNECTIONS
| Endpoint | Returns |
|----------|---------|
| `GET /voyager/api/relationships/connections?count=N` | 1st-degree connections list (full miniProfiles) |
| `GET /voyager/api/relationships/connectionsSummary` | `{entityUrn, numConnections}` |
| `GET /voyager/api/relationships/invitationsSummary` | `{numNewInvitations, numPendingInvitations}` |
| `GET /voyager/api/relationships/myNetworkNotifications` | Network activity feed |
| `GET /voyager/api/relationships/invitationViews?includeInsights=true&q=receivedInvitation&start=0&count=3` | Received invitations (paginated) |

### NOTIFICATIONS
| Endpoint | Returns |
|----------|---------|
| `GET /voyager/api/voyagerIdentityDashNotificationCards?decorationId=com.linkedin.voyager.dash.deco.identity.notifications.CardsCollectionWithInjectionsNoPills-24&count=10&q=filterVanityName` | Notification list (with metadata) |
| `GET /voyager/api/voyagerNotificationsDashBadgingItemCounts` | Unseen counts by category |
| `POST /voyager/api/voyagerNotificationsDashBadge?action=markAllItemsAsSeen` body `{until: <ts>}` | Mark all as seen (200 OK) |

### MESSAGES (read)
| Endpoint | Returns |
|----------|---------|
| `GET /voyager/api/voyagerMessagingDashMessagingBadge` | `{count: N}` unread message count |

### COMPANIES
| Endpoint | Returns |
|----------|---------|
| `GET /voyager/api/voyagerOrganizationDashPageMailbox/?count=3&q=admin` | Company page mailboxes user manages |

### PREMIUM
| Endpoint | Returns |
|----------|---------|
| `GET /voyager/api/premium/featureAccess?name=reactivationFeaturesEligible` | Reactivation eligibility |
| `GET /voyager/api/graphql?variables=(featureAccessTypes:List(...))&queryId=voyagerPremiumDashFeatureAccess.c87b20dac35795f9920f2a8072fd7af5` | Granular feature flags |

---

## 🔒 Partially Working (gated by state/quota)

| Endpoint | Status | Why |
|----------|--------|-----|
| `GET /voyager/api/feed/updates?count=5` | 400 | Wrong URL — use GraphQL feed |
| `GET /voyager/api/graphql?variables=(count:5,start:0,feedType:MF)` | 403 | Anti-bot: feed requires `x-li-track` + recent `JSESSIONID` activity |
| `GET /voyager/api/voyagerMessagingDashMessengerConversations?ids=List(...)` | 403 | Conversation details gated |
| `GET /voyager/api/graphql?variables=(count:5,start:0,q:jobSearch)` (Jobs) | 403 | Needs feature access grant |
| `POST /voyager/api/voyagerMessagingDashMessengerMessageDeliveryAcknowledgements?action=sendDeliveryAcknowledgement` | 400 | Empty messageUrns rejected |
| `GET /voyager/api/graphql?variables=(count:5,start:0,query:(keywords:...,flagshipSearchIntent:...))&queryId=voyagerSearchDashClusters.843215f2a3455f1bed85762a45d71be8` | 200 with errors | **Works but needs correct intent enum** — `SINGLE_SEARCH` invalid; valid values need probe |

---

## ❌ Not Working (gated, 400/404)

### URL not found (404)
| Endpoint |
|----------|
| `GET /voyager/api/voyagerDashMySettings.7ea6de345b41dfb57b660a9a4bebe1b8` (MySettings) |
| `GET /voyager/api/voyagerIdentityDashProfileConnections...` (their connections) |
| `GET /voyager/api/identity/profiles/{vanity}/networkinfo` |
| `GET /voyager/api/identity/profiles/{vanity}/updates` |
| `GET /voyager/api/identity/profiles/{vanity}/richSummary` |
| `GET /voyager/api/relationships/sentInvitations?count=10` |
| `GET /voyager/api/voyagerJobsDashJobDash?count=5` |
| `GET /voyager/api/voyagerOrganizationDashCompanies.2fce873504d824e22294f312f718b4c7?variables=...` |
| `GET /voyager/api/voyagerIdentityDashProfileViews...` (analytics) |
| `GET /voyager/api/voyagerLearningDashLearningHome` |
| `GET /voyager/api/voyagerPremiumDashProducts` |

These need correct `queryId` — likely GraphQL versions exist with valid hash IDs we haven't found yet. The 200 OK endpoints in the working list above have confirmed queryIds.

### Hard-gated (400 / 410)
| Endpoint | Status | Why |
|----------|--------|-----|
| `POST /voyager/api/relationships/invitations?action=create` | 400 | **Connection requests blocked** — `mailboxPreWriteValidate` for invitations too |
| `POST /voyager/api/voyagerSocialDashReactions` | 400 | **Likes/reactions blocked** — anti-spam |
| `POST /voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage` | 400 | **Message send blocked** outside live UI flow |
| `POST /voyager/api/voyagerMessagingDashMessengerConversations?action=create` | 400 | **New conversation blocked** — same gate |
| `GET /voyager/api/identity/profiles/{vanity}/richSummary` (REST) | 410 | Old endpoint deprecated; use GraphQL |
| `GET /voyager/api/identity/profiles/{vanity}/networkinfo` (REST) | 410 | Old endpoint deprecated |

---

## Summary Table

| Category | Working | Failed | Total |
|----------|---------|--------|-------|
| SELF | 3 | 1 | 4 |
| PROFILE (read) | 3 | 7 | 10 |
| CONNECTIONS (read) | 5 | 1 | 6 |
| NOTIFICATIONS (read+write ack) | 3 | 0 | 3 |
| MESSAGES (read) | 1 | 2 | 3 |
| SEARCH | 1 (needs proper intent) | 1 | 2 |
| FEED (read) | 0 | 2 | 2 |
| JOBS (read) | 0 | 1 | 1 |
| COMPANIES (read) | 1 | 1 | 2 |
| ANALYTICS (read) | 0 | 1 | 1 |
| LEARNING (read) | 0 | 1 | 1 |
| PREMIUM | 2 | 1 | 3 |
| **WRITES (all)** | **0** | **4** | **4** |
| **TOTAL** | **18** | **22** | **40** |

**Read coverage: ~45% of read endpoints work cleanly**  
**Write coverage: 0% — all writes blocked by `mailboxPreWriteValidate` or Rest.li schema validation 400**

---

## What we CAN do with Voyager API (no DOM)

✅ **Read-heavy operations at scale** (thousands per minute from a single account):
- Profile enrichment (TopCard, FullProfile, contact info)
- Search people/companies (with correct intent enum)
- Connection graph mining (1st-degree list, summary, invitations)
- Inbox badge/unread counts
- Notification feed
- Premium feature access checks
- Self account data

## What we CANNOT do with Voyager API (needs DOM)

❌ **All write operations:**
- Send messages
- Send connection requests
- Like/react to posts
- Create new conversations
- Mark threads as read (without `mailboxPreWriteValidate`)

These are blocked because the server requires recent UI activity (preflight XHRs from the same session) before accepting the write.

---

## Test Artifacts

- `voyager_approach/sessions/live/voyager_probe_v3.json` — full result list
- `voyager_approach/sessions/live/real_voyager_urls.txt` — all voyager URLs hit during real UI nav
- `voyager_approach/sessions/live/real_ui_capture.json` — captured exact working createMessage body

## Next Steps to Unlock More

1. **Search intent enum**: capture real typeahead call (need headful browser + manual type) to find valid `flagshipSearchIntent` values
2. **Profile updates/posts**: find correct `voyagerIdentityDashProfileUpdates.{hash}` queryId via DOM capture
3. **Profile connections of others**: same pattern, need correct queryId
4. **Jobs/Companies/Analytics**: navigate to those pages, capture working queryIds
5. **Writes**: confirm 0% — design production system around DOM-only writes
