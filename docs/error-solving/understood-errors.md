# Understood Errors & Failure Modes

## Error Patterns

### LinkedIn UI completely changed — old selectors broken
- **Cause**: LinkedIn migrated from legacy HTML with embedded `<code>` JSON data to a React Server Components (RSC) architecture using `window.__como_rehydration__`. All CSS classes are now hashed random strings (e.g., `_0b0793cb` instead of `entity-result__title-text`)
- **Solution**: Rewrote DOM scraping to use stable data attributes: `[data-view-name="people-search-result"]` for card containers, `[data-view-name="search-result-lockup-title"]` for name links, `[data-testid="pagination-controls-next-button-visible"]` for Next button
- **Prevention**: Always use `data-view-name`, `data-testid`, `role`, `aria-label`, and semantic selectors instead of CSS class names. LinkedIn's class names are build-generated hashes that change frequently

### inject.js SSR extraction from `<code>` tags fails
- **Cause**: LinkedIn no longer embeds search data in `<code>` tags. The initial page data comes via RSC wire format in `window.__como_rehydration__` which is NOT standard JSON
- **Solution**: Keep `<code>` extraction as fallback but add DOM-based primary strategy in content.js. The DOM approach works regardless of data delivery mechanism
- **Prevention**: DOM scraping is more resilient than data interception for SSR-rendered pages. Always have DOM scraping as the primary strategy

### inject.js double-loading
- **Cause**: inject.js was registered both as a MAIN world content script in manifest.json AND loaded via a `<script>` tag from early-inject.js — causing XHR/fetch interceptors to be set up twice
- **Solution**: Added `window.__AUTOCONNECT_INJECT_LOADED__` guard at the top of inject.js
- **Prevention**: Only load MAIN world scripts via ONE mechanism (manifest.json content_scripts with `"world": "MAIN"` is preferred)

### LinkedIn Member random ID deduplication failure
- **Cause**: Each "LinkedIn Member" card was assigned a random ID like `linkedin-member-abc123`. On every re-scan, a new random ID was generated, creating duplicate entries
- **Solution**: Use deterministic IDs based on page number + card position (e.g. `p1-m0`, `p1-m1`). Page number is extracted from URL `?page=N` parameter
- **Prevention**: Never use `Math.random()` for deduplication keys. Use stable identifiers derived from position/context

### Pagination buttons not found
- **Cause**: Old selectors `button[aria-label="Next"]` and `.artdeco-pagination__button--next` no longer exist in new LinkedIn UI
- **Solution**: New primary selector is `[data-testid="pagination-controls-next-button-visible"]` with old selectors as fallback
- **Prevention**: Use `data-testid` attributes first — they're meant for testing and are more stable than CSS classes

## Known Failure Modes

### CSS class selectors on LinkedIn
- **What looks correct**: Using CSS class names like `.entity-result__title-text` to find elements
- **Why it's wrong**: LinkedIn now uses hashed/minified CSS classes that change on each build deployment
- **Correct approach**: Use data attributes (`data-view-name`, `data-testid`), semantic HTML attributes (`role`, `aria-label`), or structural patterns (`a[href*="/in/"]`)

### Relying solely on API interception for data
- **What looks correct**: Intercepting XHR/fetch to get structured JSON data
- **Why it's wrong**: The initial page load uses RSC (React Server Components) which delivers data in a non-JSON wire format. Only subsequent navigations may use traditional API calls
- **Correct approach**: Always have DOM scraping as the primary strategy. API interception is a bonus for pages 2+

### early-inject.js dead code
- **What looks correct**: early-inject.js exists in the extension folder
- **Why it's wrong**: It's not referenced in manifest.json, so it never runs
- **Correct approach**: Remove it or keep as unused. Don't re-add to manifest.json as it would cause double-loading

### Inline onclick handlers in extension pages (CSP violation)
- **What looks correct**: Using `onclick="myFunction()"` in dynamically generated HTML in popup/sidepanel pages
- **Why it's wrong**: Chrome Extension Manifest V3 enforces Content Security Policy that blocks ALL inline JavaScript — including `onclick`, `onload`, `onsubmit`, etc. The clicks are silently ignored with no visible error
- **Correct approach**: Always use `document.createElement()` + `element.addEventListener('click', handler)`. Never use innerHTML with inline event handlers in extension pages

### Company field populated with location data
- **What looks correct**: Using `company: company || location` as a fallback when no company is found
- **Why it's wrong**: If no "Current:" line exists, the location (e.g., "Bengaluru, India") gets assigned as the company name, which is incorrect data
- **Correct approach**: Keep company and location as separate fields. Company should ONLY come from the "Current: Role at Company" line. Location should be a separate field based on geographic pattern matching

### LinkedIn Member URLs pointing to non-existent pages
- **What looks correct**: Generating fake URLs like `https://www.linkedin.com/search/member/p1-m0` for LinkedIn Members
- **Why it's wrong**: These URLs lead to "page doesn't exist" errors on LinkedIn because they're fabricated paths
- **Correct approach**: Store empty string for linkedinUrl when there is no actual profile link. Use an internal-only dedup key (not a URL) for Map-based deduplication

### addNewLeads skipping LinkedIn Members
- **What looks correct**: Using `lead.linkedinUrl && !s.leadsMap.has(lead.linkedinUrl)` to deduplicate leads
- **Why it's wrong**: LinkedIn Members have empty `linkedinUrl`, so the `&&` short-circuits and ALL LinkedIn Members are skipped
- **Correct approach**: Use a composite dedup key: `lead.linkedinUrl || \`member-${lead.firstName}-${lead.lastName}-${lead.jobTitle}\``

