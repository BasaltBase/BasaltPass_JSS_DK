/**
 * BasaltPass JavaScript SDK
 * OAuth2/OIDC 客户端库，支持 One-Tap Auth 和 Silent Auth
 * 
 * TODO ⬇️ 实现完整的SDK功能
 */

export interface BasaltPassConfig {
  /** 客户端ID */
  clientId: string;
  /** 重定向URI */
  redirectUri?: string;
  /** 授权服务器URL */
  authorizationEndpoint?: string;
  /** 令牌端点URL */
  tokenEndpoint?: string;
  /** 用户信息端点URL */
  userInfoEndpoint?: string;
  /** 权限范围 */
  scopes?: string[];
  /** 是否启用PKCE */
  usePKCE?: boolean;
  /** 是否启用静默刷新 */
  enableSilentRenew?: boolean;
  /** 静默刷新间隔（秒） */
  silentRenewInterval?: number;
}

export interface UserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  preferred_username?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface AuthResult {
  success: boolean;
  user?: UserInfo;
  accessToken?: string;
  error?: string;
}

export type AuthCallback = (result: AuthResult) => void;

export class BasaltPass {
  private config: BasaltPassConfig;
  private accessToken?: string;
  private userInfo?: UserInfo;
  private silentRenewTimer?: number;
  private onAuthCallback?: AuthCallback;

  constructor(config: BasaltPassConfig) {
    this.config = {
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
      enableSilentRenew: true,
      silentRenewInterval: 300, // 5分钟
      ...config
    };
  }

  /**
   * 初始化SDK
   */
  public async init(onAuth?: AuthCallback): Promise<void> {
    this.onAuthCallback = onAuth;
    
    // 检查URL参数中的授权码
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      this.notifyAuth({ success: false, error });
      return;
    }

    if (code) {
      await this.handleAuthorizationCode(code);
      return;
    }

    // 检查本地存储的令牌
    const storedToken = localStorage.getItem('basaltpass_access_token');
    if (storedToken) {
      this.accessToken = storedToken;
      await this.loadUserInfo();
    }

    // 启动静默刷新
    if (this.config.enableSilentRenew && this.accessToken) {
      this.startSilentRenew();
    }
  }

  /**
   * 登录
   */
  public async login(): Promise<void> {
    const state = this.generateRandomString(32);
    localStorage.setItem('oauth_state', state);

    let codeChallenge: string | undefined;
    let codeVerifier: string | undefined;

    if (this.config.usePKCE) {
      codeVerifier = this.generateRandomString(128);
      codeChallenge = await this.generateCodeChallenge(codeVerifier);
      localStorage.setItem('oauth_code_verifier', codeVerifier);
    }

    const authUrl = new URL(this.config.authorizationEndpoint || '/oauth/authorize', window.location.origin);
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri || window.location.href,
      response_type: 'code',
      scope: this.config.scopes!.join(' '),
      state
    });

    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    authUrl.search = params.toString();
    window.location.href = authUrl.toString();
  }

  /**
   * One-Tap 登录
   */
  public async oneTapLogin(): Promise<AuthResult> {
    try {
      const response = await fetch('/oauth/one-tap/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.accessToken ? `Bearer ${this.accessToken}` : ''
        },
        body: JSON.stringify({
          client_id: this.config.clientId,
          nonce: this.generateRandomString(32),
          response_type: 'id_token'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.id_token) {
          // 解析ID Token获取用户信息
          const payload = this.parseJWT(result.id_token);
          this.userInfo = {
            sub: payload.sub,
            email: payload.email,
            email_verified: payload.email_verified,
            name: payload.name,
            nickname: payload.nickname,
            picture: payload.picture,
            preferred_username: payload.preferred_username
          };

          return {
            success: true,
            user: this.userInfo,
            accessToken: this.accessToken
          };
        } else {
          return {
            success: false,
            error: result.error || 'One-Tap login failed'
          };
        }
      } else {
        const error = await response.json();
        return {
          success: false,
          error: error.error_description || error.error || 'One-Tap login failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * 静默认证
   */
  public async silentAuth(): Promise<AuthResult> {
    try {
      // 创建隐藏的iframe进行静默认证
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.width = '0';
      iframe.style.height = '0';
      
      const state = this.generateRandomString(32);
      const nonce = this.generateRandomString(32);

      const authUrl = new URL('/oauth/silent-auth', window.location.origin);
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        redirect_uri: window.location.origin,
        response_type: 'id_token',
        scope: this.config.scopes!.join(' '),
        prompt: 'none',
        state,
        nonce
      });

      authUrl.search = params.toString();
      iframe.src = authUrl.toString();

      document.body.appendChild(iframe);

      // 监听iframe的消息
      return new Promise<AuthResult>((resolve) => {
        const timeout = setTimeout(() => {
          cleanup();
          resolve({
            success: false,
            error: 'Silent auth timeout'
          });
        }, 10000); // 10秒超时

        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) {
            return;
          }

          if (event.data && typeof event.data === 'object') {
            cleanup();
            
            if (event.data.success && event.data.id_token) {
              // 解析ID Token
              const payload = this.parseJWT(event.data.id_token);
              this.userInfo = {
                sub: payload.sub,
                email: payload.email,
                email_verified: payload.email_verified,
                name: payload.name,
                nickname: payload.nickname,
                picture: payload.picture,
                preferred_username: payload.preferred_username
              };

              resolve({
                success: true,
                user: this.userInfo,
                accessToken: this.accessToken
              });
            } else {
              resolve({
                success: false,
                error: event.data.error || 'Silent auth failed'
              });
            }
          }
        };

        const cleanup = () => {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        };

        window.addEventListener('message', messageHandler);
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Silent auth error'
      };
    }
  }

  /**
   * 退出登录
   */
  public logout(): void {
    this.accessToken = undefined;
    this.userInfo = undefined;
    
    localStorage.removeItem('basaltpass_access_token');
    localStorage.removeItem('basaltpass_user_info');
    
    // 调用后端注销接口以清除Cookie（可选）
    // fetch('/auth/logout', { method: 'POST' });

    this.stopSilentRenew();
    this.notifyAuth({ success: false });
  }

  /**
   * 获取当前用户信息
   */
  public getUser(): UserInfo | undefined {
    return this.userInfo;
  }

  /**
   * 获取访问令牌
   */
  public getAccessToken(): string | undefined {
    return this.accessToken;
  }

  /**
   * 检查是否已认证
   */
  public isAuthenticated(): boolean {
    return !!this.accessToken && !!this.userInfo;
  }

  /**
   * 刷新令牌
   * 使用 HttpOnly Cookie 进行刷新，不依赖 localStorage 中的 refresh_token
   */
  public async refreshAccessToken(): Promise<boolean> {
    try {
      // 优先使用专门的 Refresh Endpoint，通常是 /auth/refresh，支持通过 Cookie 验证
      // 如果配置了 tokenEndpoint (如 /oauth/token)，则尝试使用它，但依然依赖 Cookie 而非 Body 参数
      const endpoint = '/auth/refresh'; 

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'include' // 关键：发送 Cookie
      });

      if (response.ok) {
        // Refresh 接口通常只返回新的 access_token (和潜在的新 refresh cookie)
        // 或者是标准的 TokenResponse
        const data = await response.json();
        
        // 兼容处理：data可能是 { access_token: "..." } 或 TokenResponse
        const newAccessToken = data.access_token;
        
        if (newAccessToken) {
          // 更新 access_token
          this.accessToken = newAccessToken;
          localStorage.setItem('basaltpass_access_token', this.accessToken!);
          
          // 加载最新的用户信息
          await this.loadUserInfo();
          
          return true;
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  /**
   * 处理授权码
   */
  private async handleAuthorizationCode(code: string): Promise<void> {
    const state = new URLSearchParams(window.location.search).get('state');
    const storedState = localStorage.getItem('oauth_state');
    
    if (state !== storedState) {
      this.notifyAuth({ success: false, error: 'Invalid state parameter' });
      return;
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri || window.location.href,
        client_id: this.config.clientId
      });

      const codeVerifier = localStorage.getItem('oauth_code_verifier');
      if (codeVerifier) {
        body.append('code_verifier', codeVerifier);
      }

      const response = await fetch(this.config.tokenEndpoint || '/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body
      });

      if (response.ok) {
        const tokenData: TokenResponse = await response.json();
        await this.handleTokenResponse(tokenData);
        
        // 清理URL和存储
        window.history.replaceState({}, document.title, window.location.pathname);
        localStorage.removeItem('oauth_state');
        localStorage.removeItem('oauth_code_verifier');
        
        this.notifyAuth({ 
          success: true, 
          user: this.userInfo, 
          accessToken: this.accessToken 
        });
      } else {
        const error = await response.json();
        this.notifyAuth({ 
          success: false, 
          error: error.error_description || error.error 
        });
      }
    } catch (error) {
      this.notifyAuth({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * 处理令牌响应
   */
  private async handleTokenResponse(tokenData: TokenResponse): Promise<void> {
    this.accessToken = tokenData.access_token;
    // 安全修复：不要在 localStorage 中存储 refresh_token
    // this.refreshToken = tokenData.refresh_token; 
    // 后端应通过 Set-Cookie 头设置 refresh_token HttpOnly Cookie
    
    localStorage.setItem('basaltpass_access_token', this.accessToken);
    // localStorage.removeItem('basaltpass_refresh_token'); // 确保清除旧的

    await this.loadUserInfo();
    
    if (this.config.enableSilentRenew) {
      this.startSilentRenew();
    }
  }

  /**
   * 加载用户信息
   * 增强：当 Access Token 过期 (401) 时自动尝试刷新
   */
  private async loadUserInfo(): Promise<void> {
    if (!this.accessToken) return;

    try {
      const response = await fetch(this.config.userInfoEndpoint || '/oauth/userinfo', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (response.ok) {
        this.userInfo = await response.json();
        localStorage.setItem('basaltpass_user_info', JSON.stringify(this.userInfo));
      } else if (response.status === 401) {
        // 令牌可能已过期，尝试使用 Cookie 刷新
        console.log('Access token expired, attempting silent refresh...');
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          this.logout();
        }
        // 如果刷新成功，refreshAccessToken 会递归调用 loadUserInfo 并成功，这里不需要额外操作
      } else {
        // 其他错误，注销
        this.logout();
      }
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  }

  /**
   * 启动静默刷新
   */
  private startSilentRenew(): void {
    this.stopSilentRenew();
    
    this.silentRenewTimer = window.setInterval(async () => {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        this.logout();
      }
    }, this.config.silentRenewInterval! * 1000);
  }

  /**
   * 停止静默刷新
   */
  private stopSilentRenew(): void {
    if (this.silentRenewTimer) {
      clearInterval(this.silentRenewTimer);
      this.silentRenewTimer = undefined;
    }
  }

  /**
   * 通知认证状态变化
   */
  private notifyAuth(result: AuthResult): void {
    if (this.onAuthCallback) {
      this.onAuthCallback(result);
    }
  }

  /**
   * 生成随机字符串
   */
  private generateRandomString(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  /**
   * 生成PKCE代码挑战
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const base64String = btoa(String.fromCharCode(...new Uint8Array(digest)));
    return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * 解析JWT令牌（仅解析payload，不验证签名）
   */
  private parseJWT(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      const payload = parts[1];
      // 添加base64填充
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
      const decoded = atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error('Failed to parse JWT: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

/**
 * 全局初始化函数
 */
export function initBasaltPass(config: BasaltPassConfig, onAuth?: AuthCallback): BasaltPass {
  const instance = new BasaltPass(config);
  instance.init(onAuth);
  return instance;
}

// 默认导出
export default BasaltPass;
