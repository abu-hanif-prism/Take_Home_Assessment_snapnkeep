# Associate Store

A React + TypeScript + Vite e-commerce app: a public product catalog with cart
and checkout, plus an admin panel for product CRUD and order viewing. Built
against a live third-party API (`VITE_API_URL`), not a mock.

**In a hurry?** Read this section, skim "Additional features," stop there.
Everything after "Assumptions" is detail for anyone going deeper.

## Setup

```bash
npm install
cp .env.example .env   # or create .env with VITE_API_URL=<api base url>
npm run dev             # http://localhost:5173
```

Other scripts: `npm run build` (typecheck + production build to `dist/`),
`npm run preview` (serve that build locally), `npm run lint`.

Test credentials for the live API: `admin@example.com` / `Welcome@123`
(admin role — unlocks `/admin/products` and `/admin/orders` in the navbar
once logged in).

## Architecture

```
src/
├─ lib/          api.ts (fetch wrapper + 401/refresh interceptor), auth.ts,
│                 tokenStore.ts, retry.ts (backoff), format.ts, types.ts
├─ context/       AuthContext, CartContext, CustomerContext, ToastContext
├─ hooks/         useProducts, useAdminOrders, useAdminOrder, useCheckout
├─ components/    Layout (nav), ErrorBoundary, ProductImage, Pagination, Toast
└─ pages/         Products, Cart, Login, admin/AdminProducts,
                   admin/AdminOrders, admin/AdminOrderDetail
```

**Container/presenter split.** Pages that talk to the network do it through a
hook (`useProducts`, `useAdminOrders`, `useAdminOrder`) or, for the one with
real form logic, a dedicated hook (`useCheckout` for `Cart.tsx`). The
component itself stays focused on rendering. Every fetch hook shares one
request-lifecycle shape: `AbortController` created on mount, aborted on
cleanup/unmount, and every `.then`/`.catch` checks `signal.aborted` before
touching state — so a stale response (page changed, component unmounted)
never overwrites newer state. `retryWithBackoff` (`lib/retry.ts`) is generic
and reused wherever a request should retry with exponential backoff + jitter.

**Context, not prop-drilling.** `AuthContext` (current user + login/logout),
`CartContext` (reducer-based, persisted to `localStorage`), `CustomerContext`
(the new/returning-customer flag — a Context specifically because two
independent places, the navbar badge and checkout, both need to read it and
one needs to write it; two separate `useState` copies would drift), and
`ToastContext` (a queue, so a second toast doesn't cut off the first).

**API layer.** `apiFetch` (`lib/api.ts`) centralizes the base URL, JSON
headers, bearer token attachment, and a 401 interceptor: on 401, it triggers
a token refresh and retries the original request once, sharing one in-flight
refresh promise across concurrent 401s (see "token-rotation race guard"
below). `/api/auth/login` and `/api/auth/refresh` are explicitly excluded
from that interceptor — a 401 from either of those means "wrong credentials"
or "refresh itself failed," not "an authenticated request needs refreshing."

## Additional features (beyond the brief)

- **Retry with exponential backoff + full jitter** on order placement
  (`lib/retry.ts`, used by `useCheckout`) — up to 4 retries (500ms → 4s
  ceiling, jittered), with a live per-attempt progress bar and "Retrying…
  attempt N of 4" status text, not just a spinner.
- **Token-rotation race guard.** Refresh tokens are single-use/rotated
  server-side. If several requests 401 at once, `apiFetch` shares one
  in-flight refresh `Promise` (`refreshPromise` in `lib/api.ts`) so they all
  await the same rotation instead of each POSTing the same (soon-invalidated)
  refresh token and knocking a perfectly valid session back to `/login`.
- **Optimistic delete UI** in the admin products table
  (`AdminProducts.tsx`): a row disappears the instant delete is confirmed,
  not after the `DELETE` resolves. If the request fails for any reason other
  than "already gone" (404), the row reappears and a toast explains why —
  classic optimistic-UI rollback, verified live by forcing a mocked 500.
- **Global `ErrorBoundary`** (`components/ErrorBoundary.tsx`) wraps the whole
  app with a friendly "something went wrong" fallback + reload button,
  instead of a blank white screen on an uncaught render error. See
  "What error boundaries don't catch" below — it's a real gap, not an
  oversight.
- **Responsive, keyboard/screen-reader-friendly nav** — see "Mobile" and
  "Accessibility" below.
- **Revalidate-on-load cart**: every time `/cart` opens, each item's product
  is re-fetched against the live catalog; deleted products are removed with
  a toast explaining why, price/stock changes are silently corrected, and a
  clamp keeps quantity within current stock. See the cart-staleness note
  below for the full policy.

### What error boundaries don't catch

React error boundaries only catch errors thrown **during rendering**, in
class lifecycle methods, and in constructors — for the tree **below** the
boundary. They do **not** catch:

- Errors in event handlers (a `throw` inside an `onClick` won't trip it —
  it's just an uncaught exception in a normal JS callback, invisible to
  React's render/commit cycle).
- Async errors: a rejected `fetch`/`Promise`, a `setTimeout` callback, an
  `async` function's throw — none of these happen inside a React render
  pass, so the boundary never sees them. This is why every fetch in this app
  handles its own errors explicitly (`error` state + Retry button, or a
  toast) instead of relying on the boundary to catch a failed request.
- Server-side rendering errors (not applicable here — this is a CSR SPA).
- Errors thrown by the boundary's own `render()`/lifecycle methods (it can't
  catch itself; a parent boundary would be needed for that).

In short: the boundary is a safety net for "a bug in render logic crashed
the tree," not a substitute for handling network/async failures where they
happen — which every hook in this app already does.

## Assumptions

- The brief calls for displaying a product description, but the live API (`GET /api/products`, `GET /api/products/:id` on `VITE_API_URL`) does not return a `description` field — only `_id`, `name`, `price`, `quantity`, `imageUrl`, `createdAt`, `updatedAt`. `Product.description` in [`src/lib/types.ts`](src/lib/types.ts) is modeled as optional (`description?: string`) to keep the UI ready for it without assuming data that the API doesn't currently provide.
- [`src/lib/tokenStore.ts`](src/lib/tokenStore.ts) stores the access and refresh tokens in `localStorage`, not an httpOnly cookie. This was a deliberate tradeoff, not an oversight:
  - **XSS exposure.** `localStorage` is readable by any JS running on the page, including injected/third-party scripts. An XSS bug anywhere in the app can exfiltrate both tokens. An httpOnly cookie is invisible to JS entirely — XSS can still make authenticated requests via the cookie, but can't read/steal the token value itself.
  - **CSRF exposure.** `localStorage` isn't auto-attached to requests, so the client must explicitly read the token and set the `Authorization` header — this makes CSRF (where a third-party site tricks the browser into firing a request) a non-issue, since the attacker's page can't read `localStorage` cross-origin and the browser won't attach the header on their behalf. Cookies, by contrast, are sent automatically by the browser on any request to the cookie's domain, so a cookie-based token needs `SameSite`/CSRF protections to close that gap.
  - **Why `localStorage` was chosen here:** the API (`tech-associate-task.snapnkeep.com`) is cross-origin from the dev/deployed frontend, and setting an httpOnly cookie usable cross-site requires the API to opt in (`SameSite=None; Secure`, CORS `credentials: true`) and a CSRF strategy on top. That's the more correct setup for production, but out of scope for a take-home with no control over the API's cookie configuration — `localStorage` + manual `Authorization` headers is the pragmatic choice given a fixed third-party backend. In a real deployment where the frontend and API share control, httpOnly cookies would be the safer default given how directly XSS-readable tokens can be stolen.
- **Cart persistence and no server-side cart.** The live API has no `/api/cart` endpoint (confirmed: `GET /api/cart` → 404), so [`src/context/CartContext.tsx`](src/context/CartContext.tsx) persists the cart to `localStorage` (survives refresh, per the brief) rather than a real server cart. Because the cart stores a full snapshot of each `Product` (price, stock, name, image) at add-to-cart time rather than just its ID, that snapshot can go stale — see the next point for how this is handled.
- **Stale cart items (deleted/changed products): revalidate-on-load policy.** Chosen over two alternatives: (a) trust the cached snapshot forever (simplest, but a deleted product would sit in the cart indefinitely, indistinguishable from a real one, and a stale price could reach checkout), or (b) revalidate everywhere the cart is touched (most correct, but N `/api/products/:id` calls on every page load anywhere in the app is wasteful for a case that only matters right before checkout). The implemented policy: every time `/cart` is opened, [`Cart.tsx`](src/pages/Cart.tsx) calls `CartContext`'s `syncWithCatalog()`, which re-fetches each cart item's live product data (`GET /api/products/:id`, confirmed to 404 with `{"message":"Product not found"}` for a deleted product):
  - **200 (still exists):** the cached snapshot is replaced with the fresh product (price/name/image/stock), and the cart quantity is clamped down if it now exceeds the new stock. If the new stock is 0, the item is left in the cart (not silently removed) so the user can see it's out of stock.
  - **404 (deleted):** the item is removed from the cart, and a toast tells the user what was removed and why.
  - **Any other error (network blip, 500, ...):** the cached item is left untouched — we couldn't confirm it's actually gone, so the fallback is "trust the cache" rather than destroying the user's cart data over a transient failure.

  Verified live: seeded a cart with a real product carrying a deliberately stale snapshot (wrong name/price/stock) plus a nonexistent product ID, opened `/cart`, and confirmed the stale item was corrected to the live catalog values while the nonexistent one was removed with a toast.
- **Returning-customer detection with no identifying info collected.** [`src/context/CustomerContext.tsx`](src/context/CustomerContext.tsx) persists `{ hasOrdered, firstOrderDate }` to `localStorage` only after a confirmed `201` from `POST /api/orders`, and feeds it into the existing `OrderInput.recurring_customer` field on the next order — no email, account, or login required, so it also works for anonymous/guest checkout (which this API allows). Verified live: a first order sends `recurring_customer: false` and sets the flag; a second order after a reload sends `recurring_customer: true`; `firstOrderDate` stays identical across both. Limitations, stated honestly rather than left implicit:
  - **Per-browser, not per-person.** The same human ordering from their phone and later their laptop looks like two different first-time customers — `localStorage` has no concept of identity beyond "this origin, in this browser profile."
  - **Clearable, and not recoverable once cleared.** Clearing site data, private/incognito browsing, or a fresh device reset the flag to "new customer" permanently, even for a repeat customer — there's no fallback because nothing identifying was ever collected to reconcile against.
  - **Not a security- or fraud-relevant signal.** It's pure client state with no server-side verification. Fine for a soft signal like `recurring_customer` (business analytics, not access control); must never be trusted for anything that needs to be *correct*.
  - **The tradeoff is deliberate:** a durable, accurate, cross-device signal would require collecting something identifying — exactly what this requirement rules out. This trades that accuracy for zero data collection and zero checkout friction.
- **Admin order total uses CURRENT product prices, not the price paid at checkout.** [`AdminOrderDetail.tsx`](src/pages/admin/AdminOrderDetail.tsx) computes the total as `Σ (item.product.price × item.quantity)`, where `item.product` comes from `GET /api/orders/:id`'s populated response. The order schema has no per-line price field — `POST /api/orders` only ever accepts `{product: <id>, quantity}` — so there is no historical price to display even if the code wanted to. Verified live by editing a product's price and reloading an *existing* order placed before that edit — the displayed total silently updated to the new price. A production system would need the order to snapshot each line's price at checkout time; this API doesn't support that, so admin order totals here should be read as "value at current catalog prices," not "amount actually paid."
- **The `/login` form was previously unwired** during development (the page rendered, but its `<form>` had no `onSubmit` — every credential check up to that point had been done directly against the API via curl, not through the UI). Found and fixed during this pass: `Login.tsx` now calls `AuthContext`'s `login()`, shows the API's real error message on failure (e.g. "Invalid email or password"), and redirects to `/products` on success. Flagging this explicitly rather than letting it look like it was always working.

## Mobile pass

Breakpoint decisions (Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px):

- **Navbar collapses at `md` (768px).** Below that, the full inline nav
  (Products / Cart / Admin links / customer badge / user-or-login) is
  replaced by: logo, an always-visible cart icon with item-count badge
  (the one action a shopper needs most, kept to one tap), and a hamburger
  toggle that expands a stacked menu with everything else. `md`, not `sm`,
  because the full nav (logo + 2-4 links + badge + user/logout) genuinely
  doesn't fit in a comfortable single row until then — tested at 375px,
  768px, and 1024px.
- **Product grid: `grid-cols-1` → `sm:grid-cols-2` → `md:grid-cols-3` →
  `lg:grid-cols-4`.** Was hard-coded to 2 columns with no smaller step;
  2 columns at 320-375px cramped the image/name/price/button stack. 1 column
  below `sm` (640px) gives each card room; the rest of the ramp was already
  reasonable.
- **Admin tables scroll horizontally, not squish.** Both admin tables
  (`AdminProducts`, `AdminOrders`) already had an `overflow-x-auto` wrapper;
  added an explicit `min-w-[640px]` / `min-w-[720px]` on the `<table>` itself
  so columns hit a real horizontal scrollbar on narrow screens instead of
  silently shrinking into unreadable wrapped text — the wrapper alone only
  helps once there's something wider than the viewport *to* scroll.
- **Cart already stacked correctly** (`grid` with no base `grid-cols-*`,
  `lg:grid-cols-[1.3fr_1fr]` only from `lg`) — items list and checkout form
  render as a single column below 1024px, which is a normal, usable mobile
  checkout flow. No change needed here beyond confirming it live at 375px.

## Accessibility pass

The three highest-impact fixes, in order of how badly a real assistive-tech
user would have been blocked:

1. **The orders search input had no accessible name** — only a `placeholder`,
   which disappears the moment you type and isn't reliably exposed as an
   accessible name by every screen reader (a WCAG 1.3.1/2.4.6 failure). Fixed
   with a real (visually hidden) `<label htmlFor>` in `AdminOrders.tsx`.
2. **The admin orders table's clickable row had no accessible control at
   all** — a `<tr onClick>` with a mouse handler and nothing else is
   invisible to keyboard and screen-reader users (WCAG 2.1.1). Rather than
   slap `role="button"` on the `<tr>` (which would strip its real ARIA "row"
   role and break the column associations a screen reader relies on), the
   order name is now a real `<button>` inside its cell — one clear,
   correctly-announced tab stop per row. The row's `onClick` stays as a
   mouse-only convenience layered on top.
3. **Custom buttons/links had no deliberate focus-visible treatment** — the
   pill-shaped buttons and nav links relied on whatever the browser's default
   happened to render, which is easy to lose against a rounded, colored
   background (WCAG 2.4.7). Added one global `:focus-visible` rule in
   `index.css` (a visible primary-color outline) rather than a Tailwind class
   repeated on every button — so it can't be forgotten on the next one.

Also covered: every `<img>` goes through `ProductImage`, whose `alt` prop is
**required** (not optional) in its TypeScript interface, so a missing alt
text is a compile error, not a runtime gap — every real usage passes the
product's actual name. Decorative glyphs (the order-detail customer-status
icon) are marked `aria-hidden` since the adjacent text already says the same
thing. Loading skeletons carry `aria-busy`/`aria-label` so a screen reader
knows content is still loading rather than seeing an empty table.

## Network audit

Went through every page with the Network tab open and traced every `useEffect`
that fires a request. Two real findings, both the same root cause: every
other data-fetching hook in this app (`useProducts`, `useAdminOrders`,
`useAdminOrder`) already used an `AbortController` + cancel-stale-response
guard; two spots didn't, and both doubled their request under React 18
`StrictMode`'s intentional dev-only double-invoke of effects:

- `AuthContext`'s `GET /api/auth/me` (fires once per app load).
- `useCheckout`'s cart-revalidation effect (`syncWithCatalog`, fires once per
  `/cart` visit, N times for N cart items).

Both now follow the same pattern as the rest of the app. Note on what this
fix actually buys: **in dev, under StrictMode, the Network tab still shows
two requests** — that's React intentionally re-running effects to help catch
exactly this class of bug, and no client-side guard changes how many times
the browser dispatches a request that's already been fired. What the fix
does is (a) mark the first, superseded request as aborted instead of letting
its stale response silently double-apply a state update, and (b) matters for
real in **production**, where `StrictMode`'s double-invoke doesn't happen at
all. Verified both ways: dev build still shows 2 requests (expected, harmless,
one marked cancelled); a `vite build` + `vite preview` (production, no
StrictMode) shows exactly 1 request for both cases.

A third finding was a real bug, not a StrictMode artifact: a **failed login**
(wrong password) triggered a *second*, unnecessary request. `apiFetch`'s 401
interceptor didn't distinguish "an authenticated request's token expired" from
"the login attempt itself was rejected" — any 401 not from
`/api/auth/refresh` fell into the refresh flow, which called
`POST /api/auth/refresh` with whatever (often absent) refresh token was in
`localStorage`, got its own 401/400 back, and hard-navigated to `/login` via
`window.location.href` — reloading the page and wiping out the error message
before the login form's `catch` block could ever show it. Fixed by also
excluding `/api/auth/login` from the interceptor, so a bad-password 401
propagates straight back to the form as a normal error. Verified live:
before the fix, a wrong-password attempt fired `POST /api/auth/login` (401)
then `POST /api/auth/refresh` (400) and showed no error message at all;
after the fix, exactly one request fires and "Invalid email or password"
renders.

## Production build

`npm run build` runs `tsc -b` (typecheck, no emit skipped on error) then
`vite build`. Output for this app:

```
dist/index.html                   0.77 kB │ gzip:  0.41 kB
dist/assets/index-DQphleAp.css   29.03 kB │ gzip:  6.45 kB
dist/assets/index-BY2-8Fif.js   231.22 kB │ gzip: 71.12 kB
```

- **`index.html`** is the real entry point Vite rewrites: the `<script
  type="module" src="/src/main.tsx">` used in dev is replaced with a
  reference to the hashed, bundled JS below.
- **One JS bundle, one CSS bundle.** Vite/Rollup tree-shook and concatenated
  every module (`react`, `react-router-dom`, every component/hook/context)
  into a single chunk — there's no route-based code-splitting here (no
  `React.lazy`), which is a reasonable call at this app's size (231 kB raw /
  71 kB gzipped is small) but would be worth revisiting if the app grew
  significantly, especially to keep the admin-only code out of the
  public-storefront bundle.
- **Filename hashes** (`index-DQphleAp.css`, `index-BY2-8Fif.js`) are content
  hashes — they change only when that file's content changes, which is what
  makes it safe to set far-future cache headers on `dist/assets/*` in a real
  deployment: a new deploy gets new hashes/URLs, so browsers never serve a
  stale cached bundle under an old one's name.
- **CSS is extracted, not inlined** — Tailwind's generated utility classes
  end up in their own hashed file rather than injected via JS at runtime, so
  the page can render styled content before the JS bundle even finishes
  parsing.
- Verified the build itself with `vite preview` (serves `dist/` without
  `StrictMode`'s dev-only double-effect behavior) — used this specifically to
  confirm the network-audit fixes above produce exactly one request each in
  a real production load, not just "one fewer than before."
