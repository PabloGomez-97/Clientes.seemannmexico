// api/services/linbisAuthService.ts
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import crypto from 'crypto';

interface LinbisCredentials {
  email: string;
  password: string;
  clientId: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  token_type: string;
  id_token?: string;
}

class LinbisAuthService {
  private static TENANT_DOMAIN = 'linbis.b2clogin.com';
  private static TENANT_NAME = 'linbis.onmicrosoft.com';
  private static POLICY = 'B2C_1A_SignIn';
  private static REDIRECT_URI = 'https://oauth.pstmn.io/v1/callback';
  private static SCOPE = 'https://linbis.onmicrosoft.com/linbis-api/access_as_user openid profile offline_access';

  private static generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto
      .randomBytes(32)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return { codeVerifier, codeChallenge };
  }

  private static buildAuthUrl(clientId: string, codeChallenge: string): string {
    const authUrl = new URL(
      `https://${this.TENANT_DOMAIN}/${this.TENANT_NAME}/${this.POLICY}/oauth2/v2.0/authorize`
    );

    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', this.REDIRECT_URI);
    authUrl.searchParams.set('scope', this.SCOPE);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('response_mode', 'query');

    return authUrl.toString();
  }

  private static async performBrowserLogin(
    authUrl: string,
    email: string,
    password: string
  ): Promise<string> {
    console.log('[LinbisAuth] 🚀 Iniciando navegador headless...');
    
    const browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    try {
      const page = await browser.newPage();

      console.log('[LinbisAuth] 🌐 Navegando a página de login...');
      await page.goto(authUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      console.log('[LinbisAuth] ⏳ Esperando formulario de login...');
      await page.waitForSelector('#signInName', { timeout: 15000 });
      await page.waitForSelector('#password', { timeout: 15000 });

      console.log('[LinbisAuth] ✍️  Ingresando credenciales...');
      await page.type('#signInName', email, { delay: 100 });
      await page.type('#password', password, { delay: 100 });

      console.log('[LinbisAuth] 📤 Enviando formulario...');
      
      const submitButton = await page.$('button[type="submit"]') || await page.$('button#next');
      
      if (!submitButton) {
        throw new Error('No se encontró el botón de submit');
      }

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        submitButton.click(),
      ]);

      console.log('[LinbisAuth] ⏳ Esperando código de autorización...');
      await page.waitForFunction(
        `window.location.href.includes('code=')`,
        { timeout: 15000 }
      );

      const finalUrl = page.url();
      const urlParams = new URLSearchParams(new URL(finalUrl).search);
      const authCode = urlParams.get('code');

      if (!authCode) {
        throw new Error('No se pudo obtener el código de autorización');
      }

      console.log('[LinbisAuth] ✅ Código de autorización obtenido');
      return authCode;

    } finally {
      await browser.close();
      console.log('[LinbisAuth] 🔒 Navegador cerrado');
    }
  }

  private static async exchangeCodeForTokens(
    clientId: string,
    authCode: string,
    codeVerifier: string
  ): Promise<TokenResponse> {
    const tokenUrl = `https://${this.TENANT_DOMAIN}/${this.TENANT_NAME}/${this.POLICY}/oauth2/v2.0/token`;

    console.log('[LinbisAuth] 🔄 Intercambiando código por tokens...');

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: authCode,
      redirect_uri: this.REDIRECT_URI,
      code_verifier: codeVerifier,
      scope: this.SCOPE,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const tokens = await response.json() as TokenResponse;
    console.log('[LinbisAuth] ✅ Tokens obtenidos exitosamente');

    return tokens;
  }

  static async getNewRefreshToken(credentials: LinbisCredentials): Promise<TokenResponse> {
    console.log('\n========================================');
    console.log('🔐 INICIANDO AUTENTICACIÓN AUTOMÁTICA');
    console.log('========================================');
    console.log('📧 Email:', credentials.email);
    console.log('========================================\n');

    try {
      const { codeVerifier, codeChallenge } = this.generatePKCE();
      console.log('[LinbisAuth] 🔑 PKCE generado');

      const authUrl = this.buildAuthUrl(credentials.clientId, codeChallenge);
      const authCode = await this.performBrowserLogin(authUrl, credentials.email, credentials.password);
      const tokens = await this.exchangeCodeForTokens(credentials.clientId, authCode, codeVerifier);

      console.log('\n========================================');
      console.log('✅ PROCESO COMPLETADO EXITOSAMENTE');
      console.log('========================================');
      console.log('🎫 Access Token:', tokens.access_token ? '✓ Obtenido' : '✗ No obtenido');
      console.log('🔄 Refresh Token:', tokens.refresh_token ? '✓ Obtenido' : '✗ No obtenido');
      console.log('⏱️  Expira en:', tokens.expires_in, 'segundos');
      console.log('========================================\n');

      return tokens;

    } catch (error) {
      console.error('\n========================================');
      console.error('❌ ERROR EN AUTENTICACIÓN');
      console.error('========================================');
      console.error(error);
      console.error('========================================\n');
      throw error;
    }
  }
}

export default LinbisAuthService;