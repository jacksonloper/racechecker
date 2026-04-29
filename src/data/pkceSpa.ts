import type { ActorStateItem, CaseStudy } from '../types'

const actors = [
  {
    id: 'spa',
    label: 'SPA Browser Tab',
    role: 'Public client running entirely in the browser',
    accent: '#8b5cf6',
  },
  {
    id: 'keycloak',
    label: 'Keycloak',
    role: 'Authorization server and identity provider',
    accent: '#0ea5e9',
  },
  {
    id: 'api',
    label: 'Protected API',
    role: 'Resource server that accepts bearer access tokens',
    accent: '#10b981',
  },
  {
    id: 'backend',
    label: 'App Backend',
    role: 'Intentionally absent from the login flow',
    accent: '#f59e0b',
  },
] as const

const constantState: Record<string, ActorStateItem[]> = {
  backend: [
    {
      label: 'Session store',
      value: 'No application session exists; the SPA stays stateless on the server side.',
      tone: 'warning',
    },
  ],
  api: [
    {
      label: 'Expectation',
      value: 'Waits for a signed access token on each request; does not keep browser session state.',
      tone: 'neutral',
    },
  ],
}

const stepState = (
  overrides: Partial<Record<string, ActorStateItem[]>>,
): Record<string, ActorStateItem[]> => ({
  spa: [],
  keycloak: [],
  api: constantState.api,
  backend: constantState.backend,
  ...overrides,
})

export const pkceSpaCaseStudy: CaseStudy = {
  slug: 'pkce-keycloak-spa',
  title: 'PKCE exchange with Keycloak for a pure SPA',
  strapline: 'Authorization code + PKCE, no app session, browser-held transient secrets',
  description:
    'This walkthrough makes each redirect, POST, returned artifact, and cryptographic guarantee explicit. The browser alone keeps the PKCE verifier; Keycloak alone authenticates the user; the app backend never creates a session.',
  actors: [...actors],
  steps: [
    {
      id: 'boot',
      title: 'The SPA starts with no server session',
      stageLabel: 'App bootstrap',
      summary:
        'The browser loads the SPA. No backend session exists, and the app has not sent credentials anywhere yet.',
      focus:
        'Starting from an empty browser state makes it obvious that later guarantees come from PKCE, state validation, and signed tokens rather than a hidden server session.',
      crypto: ['HTTPS serves the SPA assets to avoid tampering in transit.'],
      guarantees: [
        'The application begins without a server-managed session cookie.',
        'No authorization code, token, or verifier exists yet.',
      ],
      attackerPerspective:
        'There is nothing reusable to steal from the app itself at this moment besides the static public client configuration.',
      actorStates: stepState({
        spa: [
          {
            label: 'In memory',
            value: 'Client ID, redirect URI, issuer metadata, and empty auth state.',
            tone: 'neutral',
          },
        ],
        keycloak: [
          {
            label: 'Ready state',
            value: 'Authorization and token endpoints are available for the public client.',
            tone: 'neutral',
          },
        ],
      }),
    },
    {
      id: 'generate-pkce',
      title: 'The SPA generates PKCE material locally',
      stageLabel: 'Local crypto',
      summary:
        'The browser creates a random code_verifier and state value, then derives a code_challenge before any redirect happens.',
      focus:
        'Only the derived challenge may leave the browser. The high-entropy verifier itself stays local until the token exchange.',
      crypto: [
        'Web Crypto getRandomValues() creates unpredictable code_verifier and state values.',
        'SHA-256 + base64url derives code_challenge = BASE64URL(SHA256(code_verifier)).',
      ],
      guarantees: [
        'An attacker who later steals the authorization code still cannot redeem it without the hidden verifier.',
        'The state value binds the browser redirect to this specific auth attempt.',
      ],
      attackerPerspective:
        'The only secret with redemption power is the code_verifier, and it has not left the SPA.',
      actorStates: stepState({
        spa: [
          {
            label: 'code_verifier',
            value: 'Random 43-128 character secret stored only in SPA memory.',
            tone: 'secret',
          },
          {
            label: 'code_challenge',
            value: 'Base64url-encoded SHA-256 digest derived from the verifier.',
            tone: 'derived',
          },
          {
            label: 'state',
            value: 'Random anti-CSRF value stored beside the pending login transaction.',
            tone: 'secret',
          },
        ],
        keycloak: [
          {
            label: 'Knowledge',
            value: 'Keycloak still knows nothing about this login attempt.',
            tone: 'neutral',
          },
        ],
      }),
    },
    {
      id: 'authorize-redirect',
      title: 'The browser redirects to Keycloak with the challenge',
      stageLabel: 'Authorization request',
      summary:
        'The SPA initiates the authorization code flow by redirecting the browser to Keycloak.',
      focus:
        'The request contains the code_challenge, not the verifier. The app is still not using a backend session.',
      senderId: 'spa',
      receiverId: 'keycloak',
      request: {
        label: 'Authorization request',
        method: 'GET',
        endpoint: '/protocol/openid-connect/auth',
        transport: 'Browser redirect over HTTPS',
        payload: [
          'client_id=spa-client',
          'response_type=code',
          'redirect_uri=https://app.example/callback',
          'scope=openid profile api.read',
          'state=<random state>',
          'code_challenge=<base64url sha256(verifier)>',
          'code_challenge_method=S256',
        ],
      },
      response: {
        label: 'User-facing login page',
        transport: 'HTML response from Keycloak',
        payload: ['Keycloak login UI and any IdP session cookies scoped to the Keycloak domain.'],
      },
      crypto: [
        'TLS protects the redirect and query parameters from passive network observers.',
        'The challenge reveals only a one-way digest of the verifier.',
      ],
      guarantees: [
        'Keycloak can later require proof of possession of the original verifier.',
        'No client secret is needed because this is a public browser client using PKCE.',
      ],
      attackerPerspective:
        'Seeing the authorize URL is not enough to redeem anything because the verifier is still missing.',
      actorStates: stepState({
        spa: [
          {
            label: 'Pending transaction',
            value: 'Stores verifier, challenge, and state while the browser is away at Keycloak.',
            tone: 'secret',
          },
        ],
        keycloak: [
          {
            label: 'Recorded input',
            value: 'Received client_id, redirect_uri, state, code_challenge, and requested scopes.',
            tone: 'request',
          },
          {
            label: 'Browser session',
            value: 'May issue its own login cookie, but only for the Keycloak domain.',
            tone: 'response',
          },
        ],
      }),
    },
    {
      id: 'user-authenticates',
      title: 'Keycloak authenticates the user and mints a code',
      stageLabel: 'Identity proof',
      summary:
        'The user signs in at Keycloak. After successful authentication, Keycloak creates an authorization code bound to the original challenge.',
      focus:
        'The IdP may keep its own session, but the application backend still does not gain one.',
      senderId: 'keycloak',
      receiverId: 'spa',
      response: {
        label: 'Redirect back to the SPA callback',
        transport: '302 redirect over HTTPS',
        payload: [
          'Location: https://app.example/callback?code=<authorization code>&state=<original state>',
        ],
      },
      crypto: [
        'Keycloak binds the fresh authorization code to the previously supplied code_challenge and redirect URI.',
      ],
      guarantees: [
        'The authorization code is single-use and short lived.',
        'Keycloak session cookies stay scoped to the IdP, not the SPA origin.',
      ],
      attackerPerspective:
        'A stolen authorization code is still insufficient without the verifier that only the SPA kept.',
      actorStates: stepState({
        spa: [
          {
            label: 'Callback URL',
            value: 'Receives authorization code and the echoed state value in the browser address bar.',
            tone: 'response',
          },
          {
            label: 'Local secret',
            value: 'Still holds the original verifier and expected state in memory.',
            tone: 'secret',
          },
        ],
        keycloak: [
          {
            label: 'Authorization code',
            value: 'Single-use code linked to client_id, redirect_uri, and code_challenge.',
            tone: 'response',
          },
          {
            label: 'IdP session',
            value: 'Optional SSO cookie for future sign-ins at Keycloak only.',
            tone: 'response',
          },
        ],
      }),
    },
    {
      id: 'validate-state',
      title: 'The SPA validates the returned state before exchanging the code',
      stageLabel: 'Redirect validation',
      summary:
        'Before posting anything to the token endpoint, the SPA checks that the returned state exactly matches the value stored before redirect.',
      focus:
        'This prevents the browser from accepting an authorization response that belongs to a different or attacker-triggered login flow.',
      crypto: ['Constant-time comparison is not critical here, but exact equality of state values is.'],
      guarantees: [
        'The SPA rejects CSRF and login mix-up attempts where the state does not match.',
        'The SPA never redeems a code from an unexpected redirect.',
      ],
      attackerPerspective:
        'Even if an attacker can force a redirect into the SPA, the mismatch in state should stop the flow before token exchange.',
      actorStates: stepState({
        spa: [
          {
            label: 'Returned parameters',
            value: 'code + state from the callback URL are parsed but not yet trusted.',
            tone: 'request',
          },
          {
            label: 'Validation result',
            value: 'The stored state matches, so the authorization response is accepted.',
            tone: 'derived',
          },
        ],
        keycloak: [
          {
            label: 'Expectation',
            value: 'Waits for a token request containing the authorization code and original verifier.',
            tone: 'neutral',
          },
        ],
      }),
    },
    {
      id: 'token-post',
      title: 'The SPA redeems the code with a POST that includes the verifier',
      stageLabel: 'Token request',
      summary:
        'Now the SPA can make a direct POST to Keycloak’s token endpoint. This is the first time the verifier leaves the browser.',
      focus:
        'PKCE proof of possession happens here: the browser shows it knows the original verifier that matches the stored challenge.',
      senderId: 'spa',
      receiverId: 'keycloak',
      request: {
        label: 'Token request',
        method: 'POST',
        endpoint: '/protocol/openid-connect/token',
        transport: 'CORS XHR/fetch over HTTPS',
        payload: [
          'grant_type=authorization_code',
          'client_id=spa-client',
          'code=<authorization code>',
          'redirect_uri=https://app.example/callback',
          'code_verifier=<original random verifier>',
        ],
      },
      response: {
        label: 'Token endpoint response',
        transport: 'JSON over HTTPS',
        payload: ['access_token', 'id_token', 'refresh_token (optional)', 'expires_in', 'token_type=Bearer'],
      },
      crypto: [
        'Keycloak recomputes BASE64URL(SHA256(code_verifier)) and compares it to the stored code_challenge.',
        'TLS protects the verifier during its only network transmission.',
      ],
      guarantees: [
        'Intercepting the authorization code alone is useless without the verifier.',
        'A mismatched verifier causes token issuance to fail.',
      ],
      attackerPerspective:
        'This is the critical proof step: an attacker needs both the short-lived code and the hidden verifier at the same time.',
      actorStates: stepState({
        spa: [
          {
            label: 'Outbound POST body',
            value: 'Contains code_verifier, authorization code, client_id, and redirect_uri.',
            tone: 'request',
          },
        ],
        keycloak: [
          {
            label: 'Verification work',
            value: 'Hashes received verifier and compares it to the stored challenge before issuing tokens.',
            tone: 'derived',
          },
        ],
      }),
    },
    {
      id: 'token-response',
      title: 'Keycloak returns signed tokens to the SPA',
      stageLabel: 'Token response',
      summary:
        'After PKCE verification succeeds, Keycloak issues tokens directly to the browser-based client.',
      focus:
        'The SPA is now authenticated without ever establishing an application backend session.',
      crypto: [
        'ID and access tokens are cryptographically signed by Keycloak.',
        'JWT claims such as issuer, audience, expiry, and subject can be validated by recipients.',
      ],
      guarantees: [
        'Token contents are integrity-protected by Keycloak’s signing key.',
        'The SPA can hold tokens in memory and attach them to API requests without server session state.',
      ],
      attackerPerspective:
        'Stealing tokens is still harmful, which is why XSS defenses and careful storage choices matter even though PKCE solved code interception.',
      actorStates: stepState({
        spa: [
          {
            label: 'Access token',
            value: 'Bearer token held in browser memory for API calls.',
            tone: 'token',
          },
          {
            label: 'ID token',
            value: 'Signed identity assertions for the SPA UI.',
            tone: 'token',
          },
          {
            label: 'Refresh token',
            value: 'Optional, depending on client configuration and risk tolerance.',
            tone: 'token',
          },
        ],
        keycloak: [
          {
            label: 'Issued artifacts',
            value: 'Returns JSON token response and invalidates the single-use authorization code.',
            tone: 'response',
          },
        ],
      }),
    },
    {
      id: 'api-call',
      title: 'The SPA calls the API without a server-side app session',
      stageLabel: 'Authenticated API use',
      summary:
        'The browser attaches the access token to each API request. The API trusts the token signature and claims rather than a session lookup.',
      focus:
        'Authentication is now bearer-token based per request. The app backend still does not hold a browser session or the PKCE verifier.',
      senderId: 'spa',
      receiverId: 'api',
      request: {
        label: 'API request',
        method: 'GET',
        endpoint: '/reports',
        transport: 'fetch over HTTPS',
        payload: ['Authorization: Bearer <access token>'],
      },
      response: {
        label: 'Protected resource response',
        transport: 'JSON over HTTPS',
        payload: ['200 OK with protected business data'],
      },
      crypto: [
        'The API validates the access token signature and standard claims.',
        'TLS protects the bearer token in transit on every request.',
      ],
      guarantees: [
        'Each API call is independently authenticated by the bearer token.',
        'The application remains sessionless on the server side.',
      ],
      attackerPerspective:
        'A captured token can be replayed until expiry, so PKCE should be paired with short token lifetimes, audience checks, and strong XSS defenses.',
      actorStates: stepState({
        spa: [
          {
            label: 'Runtime state',
            value: 'Keeps tokens client-side and sends them when the user interacts with the API.',
            tone: 'token',
          },
        ],
        api: [
          {
            label: 'Authorization check',
            value: 'Verifies signature, issuer, audience, and expiry on every request.',
            tone: 'derived',
          },
        ],
        keycloak: [
          {
            label: 'Ongoing role',
            value: 'May later issue refresh responses, but is not in the hot path for each API request.',
            tone: 'neutral',
          },
        ],
      }),
    },
  ],
}
