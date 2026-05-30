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

export default BasaltPassClient;
