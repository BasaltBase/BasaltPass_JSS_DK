# BasaltPass JavaScript SDK

TypeScript/JavaScript SDK for BasaltPass.

This package exports two clients:

- `BasaltPassClient`: trusted server-side S2S API client.
- `BasaltPassAuth`: browser OAuth/OIDC client with One-Tap and Silent Auth.

Do not put a real `clientSecret` in browser code. Browser apps should use a
public OAuth client with `token_endpoint_auth_method=none` and PKCE.

## Browser Auth Usage

```typescript
import { initBasaltPass } from '@basaltpass/sdk';

const auth = initBasaltPass({
  apiBaseUrl: 'https://auth.example.com',
  clientId: 'public-client-id',
  redirectUri: window.location.origin + '/callback',
  scopes: ['openid', 'profile', 'email'],
});

const result = await auth.oneTapLogin();
if (result.success) {
  console.log(result.user);
}
```

One-Tap and Silent Auth use the hardened BasaltPass flow:

1. Request an OAuth authorization code from `/api/v1/oauth/one-tap/login` or
   `/api/v1/oauth/silent-auth?prompt=none`.
2. Exchange the code at `/api/v1/oauth/token`.
3. Load profile data from `/api/v1/oauth/userinfo`.

## S2S Usage

```typescript
import { BasaltPassClient } from '@basaltpass/sdk';

const client = new BasaltPassClient({
  baseUrl: 'http://localhost:8101',
  clientId: process.env.BASALTPASS_CLIENT_ID!,
  clientSecret: process.env.BASALTPASS_CLIENT_SECRET!,
});

const user = await client.getUser(123);
console.log(user.email);
```

The S2S client authenticates with `client_id` and `client_secret` headers and
targets `/api/v1/s2s`.

## Development

```bash
npm install
npm run type-check
npm run build
```

## License

ISC
