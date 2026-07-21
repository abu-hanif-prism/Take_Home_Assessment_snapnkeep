# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Assumptions

- The brief calls for displaying a product description, but the live API (`GET /api/products`, `GET /api/products/:id` on `VITE_API_URL`) does not return a `description` field — only `_id`, `name`, `price`, `quantity`, `imageUrl`, `createdAt`, `updatedAt`. `Product.description` in [`src/lib/types.ts`](src/lib/types.ts) is modeled as optional (`description?: string`) to keep the UI ready for it without assuming data that the API doesn't currently provide.
- [`src/lib/tokenStore.ts`](src/lib/tokenStore.ts) stores the access and refresh tokens in `localStorage`, not an httpOnly cookie. This was a deliberate tradeoff, not an oversight:
  - **XSS exposure.** `localStorage` is readable by any JS running on the page, including injected/third-party scripts. An XSS bug anywhere in the app can exfiltrate both tokens. An httpOnly cookie is invisible to JS entirely — XSS can still make authenticated requests via the cookie, but can't read/steal the token value itself.
  - **CSRF exposure.** `localStorage` isn't auto-attached to requests, so the client must explicitly read the token and set the `Authorization` header — this makes CSRF (where a third-party site tricks the browser into firing a request) a non-issue, since the attacker's page can't read `localStorage` cross-origin and the browser won't attach the header on their behalf. Cookies, by contrast, are sent automatically by the browser on any request to the cookie's domain, so a cookie-based token needs `SameSite`/CSRF protections to close that gap.
  - **Why `localStorage` was chosen here:** the API (`tech-associate-task.snapnkeep.com`) is cross-origin from the dev/deployed frontend, and setting an httpOnly cookie usable cross-site requires the API to opt in (`SameSite=None; Secure`, CORS `credentials: true`) and a CSRF strategy on top. That's the more correct setup for production, but out of scope for a take-home with no control over the API's cookie configuration — `localStorage` + manual `Authorization` headers is the pragmatic choice given a fixed third-party backend. In a real deployment where the frontend and API share control, httpOnly cookies would be the safer default given how directly XSS-readable tokens can be stolen.
