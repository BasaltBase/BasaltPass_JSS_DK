export interface BasaltPassConfig {
  baseUrl?: string;
  clientId: string;
  clientSecret: string;
  defaultHeaders?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export interface ApiErrorBody {
  code?: string;
  message?: string;
}

export class BasaltPassApiError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly requestId?: string;

  constructor(message: string, options: { status?: number; code?: string; requestId?: string } = {}) {
    super(message);
    this.name = 'BasaltPassApiError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

interface Envelope<T> {
  data: T;
  error: ApiErrorBody | null;
  request_id?: string;
}

export interface ClientContext {
  client_id: string;
  app_id?: number;
  tenant_id?: number;
  scopes?: string[];
}

export interface S2SUser {
  id: number;
  user_uuid?: string;
  email?: string;
  nickname?: string;
  avatar_url?: string;
  email_verified?: boolean;
  phone?: string;
  phone_verified?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface S2SRole {
  id: number;
  code: string;
  name?: string;
  description?: string;
}

export interface RoleCodes {
  permission_codes?: string[];
  role_codes?: string[];
  roles?: string[];
}

export interface S2STeam {
  id: number;
  name: string;
  description?: string;
  avatar_url?: string;
  owner_user_id?: number;
  members?: Array<Record<string, unknown>>;
  created_at?: string;
  updated_at?: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  avatar_url?: string;
  owner_user_id?: number;
  member_user_ids?: number[];
}

export interface S2SUserWallet {
  currency: string;
  balance: number;
  wallet_id: number;
  transactions: Array<Record<string, unknown>>;
}

export interface S2SWalletAdjustment {
  user_id: number;
  wallet_id: number;
  currency: string;
  operation: string;
  amount: number;
  balance: number;
  balance_delta: number;
  reference?: string;
}

export interface S2SMessage {
  id: number;
  app_id: number;
  title: string;
  content: string;
  type: string;
  sender_id?: number | null;
  sender_name?: string;
  receiver_id: number;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface S2SProduct {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  effective_at?: string | null;
  deprecated_at?: string | null;
}

export interface S2SOwnership {
  has_ownership: boolean;
  via: string[];
}

export class BasaltPassClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(config: BasaltPassConfig) {
    if (!config.clientId) throw new Error('clientId is required');
    if (!config.clientSecret) throw new Error('clientSecret is required');
    this.baseUrl = (config.baseUrl || 'http://localhost:8101').replace(/\/+$/, '');
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.defaultHeaders = config.defaultHeaders || {};
    this.fetchImpl = config.fetchImpl || fetch;
  }

  public health(): Promise<string> {
    return this.request<{ status: string }>('GET', '/api/v1/s2s/health').then((data) => data.status);
  }

  public me(): Promise<ClientContext> {
    return this.request<ClientContext>('GET', '/api/v1/s2s/me');
  }

  public getUser(userId: number): Promise<S2SUser> {
    return this.request<S2SUser>('GET', `/api/v1/s2s/users/${userId}`);
  }

  public async lookupUsers(params: { email?: string; phone?: string; q?: string; page?: number; pageSize?: number }): Promise<S2SUser[]> {
    const data = await this.request<{ users?: S2SUser[] }>('GET', '/api/v1/s2s/users/lookup', this.query({
      email: params.email,
      phone: params.phone,
      q: params.q,
      page: params.page,
      page_size: params.pageSize,
    }));
    return data.users || [];
  }

  public updateUser(userId: number, body: { nickname: string }): Promise<S2SUser> {
    return this.request<S2SUser>('PATCH', `/api/v1/s2s/users/${userId}`, undefined, body);
  }

  public async getUserRoles(userId: number, tenantId?: number): Promise<S2SRole[]> {
    const data = await this.request<{ roles?: S2SRole[] }>('GET', `/api/v1/s2s/users/${userId}/roles`, this.query({ tenant_id: tenantId }));
    return data.roles || [];
  }

  public getUserRoleCodes(userId: number, tenantId?: number): Promise<RoleCodes> {
    return this.request<RoleCodes>('GET', `/api/v1/s2s/users/${userId}/role-codes`, this.query({ tenant_id: tenantId }));
  }

  public getUserPermissions(userId: number, tenantId?: number): Promise<RoleCodes> {
    return this.request<RoleCodes>('GET', `/api/v1/s2s/users/${userId}/permissions`, this.query({ tenant_id: tenantId }));
  }

  public async listTeams(params: { userId?: number; q?: string; page?: number; pageSize?: number } = {}): Promise<S2STeam[]> {
    const data = await this.request<{ teams?: S2STeam[] }>('GET', '/api/v1/s2s/teams', this.query({
      user_id: params.userId,
      q: params.q,
      page: params.page,
      page_size: params.pageSize,
    }));
    return data.teams || [];
  }

  public createTeam(body: CreateTeamRequest): Promise<S2STeam> {
    return this.request<S2STeam>('POST', '/api/v1/s2s/teams', undefined, body);
  }

  public getTeam(teamId: number): Promise<S2STeam> {
    return this.request<S2STeam>('GET', `/api/v1/s2s/teams/${teamId}`);
  }

  public async getUserTeams(userId: number): Promise<S2STeam[]> {
    const data = await this.request<{ teams?: S2STeam[] }>('GET', `/api/v1/s2s/users/${userId}/teams`);
    return data.teams || [];
  }

  public getUserWallet(userId: number, params: { currency: string; limit?: number; tenantId?: number }): Promise<S2SUserWallet> {
    return this.request<S2SUserWallet>('GET', `/api/v1/s2s/users/${userId}/wallets`, this.query({
      currency: params.currency,
      limit: params.limit,
      tenant_id: params.tenantId,
    }));
  }

  public adjustUserWallet(userId: number, body: { operation: 'increase' | 'decrease'; amount: number; currency: string; reference?: string }): Promise<S2SWalletAdjustment> {
    return this.request<S2SWalletAdjustment>('POST', `/api/v1/s2s/users/${userId}/wallets/adjust`, undefined, body);
  }

  public getUserMessages(userId: number, params: { status?: 'all' | 'unread'; page?: number; pageSize?: number; tenantId?: number } = {}): Promise<{ messages: S2SMessage[]; total: number; page: number; page_size: number }> {
    return this.request('GET', `/api/v1/s2s/users/${userId}/messages`, this.query({
      status: params.status,
      page: params.page,
      page_size: params.pageSize,
      tenant_id: params.tenantId,
    }));
  }

  public sendNotification(body: { title: string; content: string; type?: 'info' | 'success' | 'warning' | 'error'; user_ids?: number[]; sender_name?: string; broadcast?: boolean }): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/s2s/notifications', undefined, body);
  }

  public async getUserProducts(userId: number): Promise<S2SProduct[]> {
    const data = await this.request<{ products?: S2SProduct[] }>('GET', `/api/v1/s2s/users/${userId}/products`);
    return data.products || [];
  }

  public checkUserProductOwnership(userId: number, productId: number): Promise<S2SOwnership> {
    return this.request<S2SOwnership>('GET', `/api/v1/s2s/users/${userId}/products/${productId}/ownership`);
  }

  public sendEmail(body: { subject: string; text_body?: string; html_body?: string; user_ids?: number[]; reply_to?: string; broadcast?: boolean }): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/s2s/emails/send', undefined, body);
  }

  private async request<T>(method: string, path: string, query?: URLSearchParams, body?: unknown): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) url.search = query.toString();
    const response = await this.fetchImpl(url.toString(), {
      method,
      headers: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...this.defaultHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (!response.ok || envelope.error) {
      throw new BasaltPassApiError(envelope.error?.message || response.statusText, {
        status: response.status,
        code: envelope.error?.code,
        requestId: envelope.request_id,
      });
    }
    return envelope.data;
  }

  private query(values: Record<string, string | number | boolean | undefined>): URLSearchParams {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null) params.set(key, String(value));
    });
    return params;
  }
}

export function createBasaltPassClient(config: BasaltPassConfig): BasaltPassClient {
  return new BasaltPassClient(config);
}

export interface BasaltPassAuthConfig {
  apiBaseUrl?: string;
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userInfoEndpoint?: string;
  oneTapEndpoint?: string;
  silentAuthEndpoint?: string;
  scopes?: string[];
  usePKCE?: boolean;
  enableSilentRenew?: boolean;
  silentRenewInterval?: number;
  fetchImpl?: typeof fetch;
}

export interface BasaltPassUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  preferred_username?: string;
}

export interface BasaltPassTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface BasaltPassAuthResult {
  success: boolean;
  user?: BasaltPassUserInfo;
  accessToken?: string;
  idToken?: string;
  error?: string;
}

export type BasaltPassAuthCallback = (result: BasaltPassAuthResult) => void;

export class BasaltPassAuth {
  private readonly config: Required<Pick<BasaltPassAuthConfig, 'scopes' | 'usePKCE' | 'enableSilentRenew' | 'silentRenewInterval'>> & BasaltPassAuthConfig;
  private readonly fetchImpl: typeof fetch;
  private accessToken?: string;
  private idToken?: string;
  private userInfo?: BasaltPassUserInfo;
  private silentRenewTimer?: ReturnType<typeof setInterval>;
  private onAuthCallback?: BasaltPassAuthCallback;

  constructor(config: BasaltPassAuthConfig) {
    if (!config.clientId) throw new Error('clientId is required');
    this.config = {
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
      enableSilentRenew: true,
      silentRenewInterval: 300,
      ...config,
    };
    this.fetchImpl = config.fetchImpl || fetch;
  }

  public async init(onAuth?: BasaltPassAuthCallback): Promise<void> {
    this.onAuthCallback = onAuth;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const code = params.get('code');
    if (error) {
      this.notifyAuth({ success: false, error });
      return;
    }
    if (code) {
      await this.handleAuthorizationCode(code);
      return;
    }

    const storedToken = window.localStorage.getItem('basaltpass_access_token');
    const storedIDToken = window.localStorage.getItem('basaltpass_id_token');
    if (storedToken) {
      this.accessToken = storedToken;
      this.idToken = storedIDToken || undefined;
      await this.loadUserInfo();
      if (this.config.enableSilentRenew && this.accessToken) this.startSilentRenew();
    }
  }

  public async login(): Promise<void> {
    if (typeof window === 'undefined') throw new Error('login requires a browser environment');
    const state = this.randomString(32);
    const nonce = this.randomString(32);
    window.sessionStorage.setItem('basaltpass_oauth_state', state);
    window.sessionStorage.setItem('basaltpass_oauth_nonce', nonce);

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state,
      nonce,
    });
    if (this.config.usePKCE) {
      const verifier = this.randomString(96);
      const challenge = await this.codeChallenge(verifier);
      window.sessionStorage.setItem('basaltpass_oauth_code_verifier', verifier);
      params.set('code_challenge', challenge);
      params.set('code_challenge_method', 'S256');
    }

    const authUrl = new URL(this.endpoint('/api/v1/oauth/authorize', this.config.authorizationEndpoint));
    authUrl.search = params.toString();
    window.location.href = authUrl.toString();
  }

  public async oneTapLogin(): Promise<BasaltPassAuthResult> {
    const state = this.randomString(32);
    const nonce = this.randomString(32);
    const pkce = this.config.usePKCE ? await this.pkcePair() : undefined;
    const body: Record<string, string> = {
      client_id: this.config.clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state,
      nonce,
    };
    if (pkce) {
      body.code_challenge = pkce.challenge;
      body.code_challenge_method = 'S256';
    }

    const response = await this.fetchImpl(this.endpoint('/api/v1/oauth/one-tap/login', this.config.oneTapEndpoint), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const result = await response.json() as { success?: boolean; code?: string; error?: string; error_description?: string; state?: string };
    if (!response.ok || !result.success || !result.code) {
      return { success: false, error: result.error_description || result.error || response.statusText };
    }
    if (result.state !== state) return { success: false, error: 'Invalid state parameter' };
    return this.exchangeAndLoad(result.code, pkce?.verifier);
  }

  public async silentAuth(): Promise<BasaltPassAuthResult> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { success: false, error: 'silentAuth requires a browser environment' };
    }

    const state = this.randomString(32);
    const nonce = this.randomString(32);
    const pkce = this.config.usePKCE ? await this.pkcePair() : undefined;
    const authUrl = new URL(this.endpoint('/api/v1/oauth/silent-auth', this.config.silentAuthEndpoint));
    authUrl.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.redirectUri(),
      prompt: 'none',
      scope: this.config.scopes.join(' '),
      state,
      nonce,
      ...(pkce ? { code_challenge: pkce.challenge, code_challenge_method: 'S256' } : {}),
    }).toString();

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.src = authUrl.toString();
    document.body.appendChild(iframe);

    return new Promise<BasaltPassAuthResult>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve({ success: false, error: 'Silent auth timeout' });
      }, 10000);
      const expectedOrigin = authUrl.origin;
      const handler = async (event: MessageEvent) => {
        if (event.origin !== expectedOrigin) return;
        if (!event.data || typeof event.data !== 'object') return;
        cleanup();
        if (!event.data.success || !event.data.code) {
          resolve({ success: false, error: event.data.error || 'Silent auth failed' });
          return;
        }
        if (event.data.state !== state) {
          resolve({ success: false, error: 'Invalid state parameter' });
          return;
        }
        resolve(await this.exchangeAndLoad(event.data.code, pkce?.verifier));
      };
      const cleanup = () => {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        iframe.remove();
      };
      window.addEventListener('message', handler);
    });
  }

  public logout(): void {
    this.accessToken = undefined;
    this.idToken = undefined;
    this.userInfo = undefined;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('basaltpass_access_token');
      window.localStorage.removeItem('basaltpass_id_token');
      window.localStorage.removeItem('basaltpass_user_info');
    }
    this.stopSilentRenew();
    this.notifyAuth({ success: false });
  }

  public getUser(): BasaltPassUserInfo | undefined {
    return this.userInfo;
  }

  public getAccessToken(): string | undefined {
    return this.accessToken;
  }

  public getIDToken(): string | undefined {
    return this.idToken;
  }

  public isAuthenticated(): boolean {
    return !!this.accessToken && !!this.userInfo;
  }

  public async refreshAccessToken(): Promise<boolean> {
    if (!this.accessToken) return false;
    const result = await this.silentAuth();
    return result.success;
  }

  private async handleAuthorizationCode(code: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state') || '';
    const storedState = window.sessionStorage.getItem('basaltpass_oauth_state') || '';
    if (state !== storedState) {
      this.notifyAuth({ success: false, error: 'Invalid state parameter' });
      return;
    }
    const verifier = window.sessionStorage.getItem('basaltpass_oauth_code_verifier') || undefined;
    const result = await this.exchangeAndLoad(code, verifier);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    window.sessionStorage.removeItem('basaltpass_oauth_state');
    window.sessionStorage.removeItem('basaltpass_oauth_nonce');
    window.sessionStorage.removeItem('basaltpass_oauth_code_verifier');
    this.notifyAuth(result);
  }

  private async exchangeAndLoad(code: string, codeVerifier?: string): Promise<BasaltPassAuthResult> {
    try {
      const token = await this.exchangeCode(code, codeVerifier);
      await this.handleTokenResponse(token);
      const result = { success: true, user: this.userInfo, accessToken: this.accessToken, idToken: this.idToken };
      this.notifyAuth(result);
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Token exchange failed' };
    }
  }

  private async exchangeCode(code: string, codeVerifier?: string): Promise<BasaltPassTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(),
      client_id: this.config.clientId,
    });
    if (codeVerifier) body.set('code_verifier', codeVerifier);
    if (this.config.clientSecret) body.set('client_secret', this.config.clientSecret);

    const response = await this.fetchImpl(this.endpoint('/api/v1/oauth/token', this.config.tokenEndpoint), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'include',
      body,
    });
    const payload = await response.json() as BasaltPassTokenResponse & { error?: string; error_description?: string };
    if (!response.ok) throw new Error(payload.error_description || payload.error || response.statusText);
    return payload;
  }

  private async handleTokenResponse(token: BasaltPassTokenResponse): Promise<void> {
    this.accessToken = token.access_token;
    this.idToken = token.id_token;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('basaltpass_access_token', token.access_token);
      if (token.id_token) window.localStorage.setItem('basaltpass_id_token', token.id_token);
    }
    await this.loadUserInfo();
    if (this.config.enableSilentRenew) this.startSilentRenew();
  }

  private async loadUserInfo(): Promise<void> {
    if (!this.accessToken) return;
    const response = await this.fetchImpl(this.endpoint('/api/v1/oauth/userinfo', this.config.userInfoEndpoint), {
      headers: { Accept: 'application/json', Authorization: `Bearer ${this.accessToken}` },
      credentials: 'include',
    });
    if (!response.ok) throw new Error(response.statusText || 'Failed to load user info');
    this.userInfo = await response.json() as BasaltPassUserInfo;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('basaltpass_user_info', JSON.stringify(this.userInfo));
    }
  }

  private startSilentRenew(): void {
    this.stopSilentRenew();
    this.silentRenewTimer = setInterval(() => {
      void this.silentAuth().then((result) => {
        if (!result.success) this.logout();
      });
    }, this.config.silentRenewInterval * 1000);
  }

  private stopSilentRenew(): void {
    if (this.silentRenewTimer) clearInterval(this.silentRenewTimer);
    this.silentRenewTimer = undefined;
  }

  private notifyAuth(result: BasaltPassAuthResult): void {
    if (this.onAuthCallback) this.onAuthCallback(result);
  }

  private redirectUri(): string {
    if (this.config.redirectUri) return this.config.redirectUri;
    if (typeof window !== 'undefined') return window.location.href.split('#')[0].split('?')[0];
    throw new Error('redirectUri is required outside a browser environment');
  }

  private endpoint(defaultPath: string, override?: string): string {
    const raw = override || defaultPath;
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = (this.config.apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8101')).replace(/\/+$/, '');
    return `${base}${raw.startsWith('/') ? raw : `/${raw}`}`;
  }

  private async pkcePair(): Promise<{ verifier: string; challenge: string }> {
    const verifier = this.randomString(96);
    return { verifier, challenge: await this.codeChallenge(verifier) };
  }

  private randomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(values);
      return Array.from(values, (value) => chars[value % chars.length]).join('');
    }
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private async codeChallenge(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const binary = String.fromCharCode(...new Uint8Array(digest));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}

export function initBasaltPass(config: BasaltPassAuthConfig, onAuth?: BasaltPassAuthCallback): BasaltPassAuth {
  const instance = new BasaltPassAuth(config);
  void instance.init(onAuth);
  return instance;
}

export default BasaltPassClient;
