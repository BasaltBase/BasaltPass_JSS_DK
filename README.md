# BasaltPass JavaScript SDK

BasaltPass S2S API client for TypeScript and JavaScript.

Do not use this SDK directly in browser code with real credentials. `clientSecret` belongs on a trusted backend.

## Installation

```bash
npm install @basaltpass/sdk
```

## Usage

```typescript
import { BasaltPassClient } from '@basaltpass/sdk';

const client = new BasaltPassClient({
  baseUrl: 'http://localhost:8101',
  clientId: process.env.BASALTPASS_CLIENT_ID!,
  clientSecret: process.env.BASALTPASS_CLIENT_SECRET!,
});

const user = await client.getUser(123);
console.log(user.email);

const wallet = await client.getUserWallet(123, { currency: 'CNY', limit: 10 });
console.log(wallet.balance);
```

The client authenticates with `client_id` and `client_secret` headers and targets `/api/v1/s2s`.

## Supported APIs

- health and client context
- user read, lookup, and update
- roles, role codes, and permissions
- teams
- wallets
- messages and notifications
- products and ownership checks
- email sending

## Development

```bash
npm install
npm run type-check
npm run build
```

## License

ISC
