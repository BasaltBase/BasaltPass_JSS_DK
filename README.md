# BasaltPass JavaScript SDK

完整的 OAuth2/OIDC 客户端库，支持 One-Tap Auth 和静默认证。

## 功能特性

- ✅ **OAuth2/OIDC 完整支持** - 标准 OAuth2 和 OpenID Connect 流程
- ✅ **PKCE 支持** - 提高安全性的授权码流程
- ✅ **自动令牌刷新** - 智能的令牌管理和静默刷新
- 🔄 **One-Tap 登录** - 快速单点登录体验 (TODO)
- 🔄 **静默认证** - 无感知的令牌续期 (TODO)
- ✅ **TypeScript 支持** - 完整的类型定义

## 安装

```bash
npm install @basaltpass/sdk
# 或
yarn add @basaltpass/sdk
```

## 快速开始

### 1. 基础初始化

```typescript
import { initBasaltPass } from '@basaltpass/sdk';

const basaltpass = initBasaltPass({
  clientId: 'your-client-id',
  redirectUri: 'http://localhost:3000/callback',
  scopes: ['openid', 'profile', 'email']
}, (result) => {
  if (result.success) {
    console.log('用户已登录:', result.user);
  } else {
    console.log('登录失败:', result.error);
  }
});
```

### 2. 手动登录

```typescript
// 触发登录流程
await basaltpass.login();

// 检查登录状态
if (basaltpass.isAuthenticated()) {
  const user = basaltpass.getUser();
  console.log('当前用户:', user);
}

// 退出登录
basaltpass.logout();
```

### 3. 获取访问令牌

```typescript
const token = basaltpass.getAccessToken();
if (token) {
  // 使用令牌调用API
  fetch('/api/protected', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}
```

## 配置选项

```typescript
interface BasaltPassConfig {
  /** 客户端ID (必需) */
  clientId: string;
  
  /** 重定向URI */
  redirectUri?: string;
  
  /** 授权服务器端点 */
  authorizationEndpoint?: string; // 默认: '/oauth/authorize'
  tokenEndpoint?: string;         // 默认: '/oauth/token'
  userInfoEndpoint?: string;      // 默认: '/oauth/userinfo'
  
  /** 权限范围 */
  scopes?: string[];              // 默认: ['openid', 'profile', 'email']
  
  /** 安全设置 */
  usePKCE?: boolean;              // 默认: true
  
  /** 自动刷新设置 */
  enableSilentRenew?: boolean;    // 默认: true
  silentRenewInterval?: number;   // 默认: 300 (5分钟)
}
```

## API 参考

### 类方法

#### `init(onAuth?: AuthCallback): Promise<void>`
初始化SDK，检查现有认证状态。

#### `login(): Promise<void>`
启动OAuth2授权码流程。

#### `logout(): void`
清除认证状态并退出登录。

#### `getUser(): UserInfo | undefined`
获取当前用户信息。

#### `getAccessToken(): string | undefined`
获取当前访问令牌。

#### `isAuthenticated(): boolean`
检查用户是否已认证。

#### `refreshAccessToken(): Promise<boolean>`
手动刷新访问令牌。

### TODO 功能

#### `oneTapLogin(): Promise<AuthResult>` (开发中)
One-Tap快速登录。

#### `silentAuth(): Promise<AuthResult>` (开发中)
静默认证更新。

## 类型定义

```typescript
interface UserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  preferred_username?: string;
}

interface AuthResult {
  success: boolean;
  user?: UserInfo;
  accessToken?: string;
  error?: string;
}

type AuthCallback = (result: AuthResult) => void;
```

## 高级用法

### 自定义端点配置

```typescript
const basaltpass = initBasaltPass({
  clientId: 'your-client-id',
  authorizationEndpoint: 'https://auth.yourcompany.com/oauth/authorize',
  tokenEndpoint: 'https://auth.yourcompany.com/oauth/token',
  userInfoEndpoint: 'https://auth.yourcompany.com/oauth/userinfo'
});
```

### 令牌生命周期管理

```typescript
// 监听认证状态变化
const basaltpass = initBasaltPass(config, (result) => {
  if (result.success) {
    // 用户登录成功
    updateUIForLoggedInUser(result.user);
  } else {
    // 用户未登录或登录失败
    showLoginUI();
  }
});

// 手动刷新令牌
const refreshed = await basaltpass.refreshAccessToken();
if (!refreshed) {
  // 刷新失败，需要重新登录
  await basaltpass.login();
}
```

## 开发和构建

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 运行测试
npm test
```

## 许可证

MIT
