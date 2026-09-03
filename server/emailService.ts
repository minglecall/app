import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function hashOtp(code: string) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}

interface StoredOtp {
  code: string;
  email: string;
  name?: string;
  role?: string;
  expiresAt: number;
  attempts: number;
}

export interface SmtpRuntimeConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  secure?: boolean;
  resendApiKey?: string;
  showOtpInForm?: boolean;
}

const CONFIG_FILE_PATH = path.join(process.cwd(), 'server', 'smtp_config.json');

function loadPersistedSmtpConfig(): SmtpRuntimeConfig {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      console.log('[Email Service] Loaded persisted SMTP configuration from disk.');
      return {
        showOtpInForm: false,
        ...parsed,
      };
    }
  } catch (err) {
    console.warn('[Email Service] Failed to load persisted SMTP config:', err);
  }
  return {
    showOtpInForm: false,
  };
}

function savePersistedSmtpConfig(config: SmtpRuntimeConfig): void {
  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[Email Service] Successfully persisted SMTP configuration to disk.');
  } catch (err) {
    console.warn('[Email Service] Failed to persist SMTP config to disk:', err);
  }
}

const otpStore = new Map<string, StoredOtp>();
let runtimeSmtpConfig: SmtpRuntimeConfig = loadPersistedSmtpConfig();

export function updateSmtpRuntimeConfig(config: Partial<SmtpRuntimeConfig>): void {
  runtimeSmtpConfig = { ...runtimeSmtpConfig, ...config };
  savePersistedSmtpConfig(runtimeSmtpConfig);
}

export function getShowOtpInForm(): boolean {
  return runtimeSmtpConfig.showOtpInForm ?? true;
}

export function getRawSmtpConfigForAdmin(): SmtpRuntimeConfig & { configured: boolean } {
  return {
    host: runtimeSmtpConfig.host || process.env.SMTP_HOST || '',
    port: runtimeSmtpConfig.port || (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587),
    user: runtimeSmtpConfig.user || process.env.SMTP_USER || '',
    pass: runtimeSmtpConfig.pass || process.env.SMTP_PASS || '',
    from: runtimeSmtpConfig.from || process.env.SMTP_FROM || '',
    secure: runtimeSmtpConfig.secure || false,
    resendApiKey: runtimeSmtpConfig.resendApiKey || process.env.RESEND_API_KEY || '',
    showOtpInForm: runtimeSmtpConfig.showOtpInForm ?? true,
    configured: isSmtpConfigured(),
  };
}

export function getSmtpConfig(): {
  host?: string;
  port?: number;
  user?: string;
  from?: string;
  configured: boolean;
  showOtpInForm: boolean;
} {
  const host = runtimeSmtpConfig.host || process.env.SMTP_HOST;
  const user = runtimeSmtpConfig.user || process.env.SMTP_USER;
  const configured = isSmtpConfigured();
  return {
    host: host || '',
    port: runtimeSmtpConfig.port || parseInt(process.env.SMTP_PORT || '587', 10),
    user: user ? user.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '',
    from: runtimeSmtpConfig.from || process.env.SMTP_FROM || '',
    configured,
    showOtpInForm: runtimeSmtpConfig.showOtpInForm ?? false,
  };
}

// Helper to generate 6-digit numeric OTP
export function generateSixDigitOtp(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return digits.toString();
}

// Store OTP with 10-minute expiry
export function saveOtp(email: string, code: string, metadata?: { name?: string; role?: string }): void {
  const cleanEmail = email.trim().toLowerCase();
  otpStore.set(cleanEmail, {
    code: hashOtp(code),
    email: cleanEmail,
    name: metadata?.name,
    role: metadata?.role,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
  });
}

// Verify OTP - Strictly matching the 6-digit OTP code sent to user email
export function verifyStoredOtp(email: string, inputCode: string): { success: boolean; error?: string; metadata?: any } {
  const cleanEmail = email.trim().toLowerCase();
  const stored = otpStore.get(cleanEmail);

  if (!stored) {
    return { success: false, error: 'No active verification code found for this email. Please request a new code.' };
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(cleanEmail);
    return { success: false, error: 'The verification code has expired. Please request a new one.' };
  }

  if (stored.attempts >= 5) {
    otpStore.delete(cleanEmail);
    return { success: false, error: 'Too many incorrect attempts. Please request a fresh verification code.' };
  }

  stored.attempts += 1;

  if (stored.code === hashOtp(inputCode)) {
    otpStore.delete(cleanEmail);
    return {
      success: true,
      metadata: {
        email: stored.email,
        name: stored.name,
        role: stored.role,
      },
    };
  }

  return { success: false, error: `Invalid verification code. ${5 - stored.attempts} attempt(s) remaining.` };
}

// Check if SMTP is configured in environment or runtime
export function isSmtpConfigured(): boolean {
  const hasEnvSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const hasRuntimeSmtp = Boolean(runtimeSmtpConfig.host && runtimeSmtpConfig.user && runtimeSmtpConfig.pass);
  const hasResend = Boolean(process.env.RESEND_API_KEY || runtimeSmtpConfig.resendApiKey);
  return hasEnvSmtp || hasRuntimeSmtp || hasResend;
}

// Send Email containing BOTH 6-digit OTP code and Confirmation Link
export async function sendOtpEmail(params: {
  to: string;
  name?: string;
  otpCode: string;
  confirmationUrl?: string;
}): Promise<{ success: boolean; delivered: boolean; message: string; otpCode?: string }> {
  const { to, name = 'User', otpCode, confirmationUrl } = params;
  const cleanTo = to.trim().toLowerCase();

  // Save in server store
  saveOtp(cleanTo, otpCode, { name });

  const appUrl = (process.env.APP_URL || '').trim() || `http://localhost:${process.env.PORT || 3000}`;
  const directLink = confirmationUrl || `${appUrl}/?auth_verify=1&email=${encodeURIComponent(cleanTo)}&code=${otpCode}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">LiveCall Connect</h1>
              <p style="margin: 8px 0 0 0; color: #ffe4e6; font-size: 14px; font-weight: 500;">Account Verification & Security</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #e2e8f0; line-height: 24px;">
                Hello <strong style="color: #ffffff;">${name}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #94a3b8; line-height: 22px;">
                Thank you for joining LiveCall! Use your 6-digit OTP verification code below to verify your email address:
              </p>

              <!-- 6-DIGIT OTP CODE BOX -->
              <div style="background-color: #0f172a; border: 2px dashed #f43f5e; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #fb7185; font-weight: 700; margin-bottom: 8px;">
                  Your 6-Digit OTP Code
                </div>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ffffff; font-family: 'Courier New', monospace; text-shadow: 0 0 12px rgba(244,63,94,0.4);">
                  ${otpCode}
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
                  Valid for 10 minutes &bull; Do not share with anyone
                </div>
              </div>

              <!-- OPTIONAL INSTANT CONFIRMATION LINK -->
              <div style="text-align: center; margin: 32px 0 16px 0;">
                <p style="margin: 0 0 12px 0; font-size: 13px; color: #94a3b8;">
                  Prefer not to type the code? Verify with one click:
                </p>
                <a href="${directLink}" style="display: inline-block; background-color: #f43f5e; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(244,63,94,0.3);">
                  Confirm Email Directly
                </a>
              </div>

              <div style="border-top: 1px solid #334155; margin-top: 32px; padding-top: 20px; font-size: 12px; color: #64748b; line-height: 18px; text-align: center;">
                If you did not request this verification, please safely ignore this email.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const resendKey = runtimeSmtpConfig.resendApiKey || process.env.RESEND_API_KEY;
  const smtpHost = runtimeSmtpConfig.host || process.env.SMTP_HOST;
  const smtpUser = runtimeSmtpConfig.user || process.env.SMTP_USER;
  const smtpPass = runtimeSmtpConfig.pass || process.env.SMTP_PASS;
  
  // 1. Try Resend API first if explicit API key is configured
  if (resendKey) {
    let resendSender = runtimeSmtpConfig.from || process.env.SMTP_FROM || 'LiveCall <onboarding@resend.dev>';
    if (resendSender.includes('livecallvip.com') || resendSender.includes('livecall-app.com')) {
      resendSender = 'LiveCall <onboarding@resend.dev>';
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendSender,
          to: [cleanTo],
          subject: `Your 6-Digit Verification Code: ${otpCode} - LiveCall`,
          html: htmlContent,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`[Email Service] Dispatched OTP via Resend API to ${cleanTo}`);
        return {
          success: true,
          delivered: true,
          message: `Verification code sent to ${cleanTo}`,
        };
      }

      // Check if Resend Sandbox recipient restriction
      const errMsg = (resData?.message || '').toLowerCase();
      if (errMsg.includes('only send testing emails to your own email') || errMsg.includes('verify a domain')) {
        console.warn(`[Email Service] Resend Sandbox Notice: Delivery to ${cleanTo} restricted. Resend requires custom domain verification to send to external recipients.`);
        return {
          success: true,
          delivered: false,
          message: `Resend Sandbox Mode: Direct email delivery is restricted to your Resend account owner email. Verify a domain at resend.com/domains to send to any recipient. The 6-digit OTP code is ready on-screen.`,
          otpCode,
        };
      }

      // If unverified domain for sender, retry with onboarding@resend.dev
      if (errMsg.includes('not verified') || errMsg.includes('domain')) {
        console.log(`[Email Service] Retrying Resend with official onboarding@resend.dev sender...`);
        const retryRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'LiveCall <onboarding@resend.dev>',
            to: [cleanTo],
            subject: `Your 6-Digit Verification Code: ${otpCode} - LiveCall`,
            html: htmlContent,
          }),
        });

        const retryData = await retryRes.json().catch(() => ({}));
        if (retryRes.ok) {
          console.log(`[Email Service] Resend fallback dispatch succeeded to ${cleanTo}`);
          return {
            success: true,
            delivered: true,
            message: `Verification code sent to ${cleanTo} (via onboarding@resend.dev)`,
          };
        } else if ((retryData?.message || '').toLowerCase().includes('only send testing emails')) {
          console.warn(`[Email Service] Resend Sandbox Notice: Delivery to ${cleanTo} restricted.`);
          return {
            success: true,
            delivered: false,
            message: `Resend Sandbox Mode: Delivery restricted to Resend account owner. Verify a domain at resend.com/domains to send to all recipients.`,
            otpCode,
          };
        }
      }
    } catch (e) {
      console.warn('[Email Service] Resend dispatch notice:', e);
    }
  }

  // 2. Try SMTP via Nodemailer with Intelligent Port/TLS Auto-Correction & Fallback
  if (smtpHost && smtpUser && smtpPass) {
    const rawPort = runtimeSmtpConfig.port || parseInt(process.env.SMTP_PORT || '587', 10);
    
    // Auto-detect optimal secure setting based on port
    const initialSecure = rawPort === 465;
    const initialPort = rawPort;

    // Sender resolution
    let senderAddress = runtimeSmtpConfig.from || process.env.SMTP_FROM || `"LiveCall" <${smtpUser}>`;
    if (smtpHost.includes('resend.com') && (senderAddress.includes('livecallvip.com') || senderAddress.includes('livecall-app.com'))) {
      senderAddress = `"LiveCall" <onboarding@resend.dev>`;
    }

    // Array of transport strategies to attempt
    const strategies = [
      { port: initialPort, secure: initialSecure, desc: `Port ${initialPort} (${initialSecure ? 'SSL/TLS' : 'STARTTLS'})` },
      { 
        port: initialPort === 465 ? 587 : 465, 
        secure: initialPort !== 465, 
        desc: `Port ${initialPort === 465 ? 587 : 465} (${initialPort !== 465 ? 'SSL/TLS' : 'STARTTLS'})` 
      },
    ];

    let lastSmtpError: any = null;

    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      try {
        console.log(`[Email Service] Attempting SMTP dispatch via ${smtpHost}:${strategy.port} (${strategy.secure ? 'secure' : 'starttls'})...`);
        
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: strategy.port,
          secure: strategy.secure,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 12000,
          tls: {
            rejectUnauthorized: false,
          },
        });

        await transporter.sendMail({
          from: senderAddress,
          to: cleanTo,
          subject: `Your 6-Digit Verification Code: ${otpCode} - LiveCall`,
          html: htmlContent,
        });

        console.log(`[Email Service] Dispatched OTP via SMTP (${smtpHost}:${strategy.port}) to ${cleanTo}`);
        return {
          success: true,
          delivered: true,
          message: `Verification email sent with 6-digit OTP code to ${cleanTo}`,
        };
      } catch (smtpErr: any) {
        lastSmtpError = smtpErr;
        const errLower = (smtpErr.message || '').toLowerCase();

        // Check if Resend Sandbox restriction (550: You can only send testing emails to your own email address)
        if (errLower.includes('only send testing emails') || (errLower.includes('550') && errLower.includes('resend.com/domains'))) {
          console.warn(`[Email Service] Resend Sandbox Notice (550): Delivery to ${cleanTo} requires a verified domain at resend.com/domains.`);
          return {
            success: true,
            delivered: false,
            message: `Resend Sandbox Mode: Free accounts can only deliver to the account owner email address. Verify your domain at resend.com/domains to send to all users. Verification code is ready on-screen.`,
            otpCode,
          };
        }

        console.warn(`[Email Service] SMTP attempt ${i + 1} (${strategy.desc}) failed:`, smtpErr.message);

        // If generic unverified sender error, try one sender fallback
        if (smtpErr.message?.includes('550') || errLower.includes('not verified')) {
          try {
            const fallbackSender = smtpHost.includes('resend.com')
              ? `"LiveCall" <onboarding@resend.dev>`
              : `"LiveCall" <${smtpUser}>`;
            
            console.log(`[Email Service] Retrying with fallback sender: ${fallbackSender}`);
            const retryTransporter = nodemailer.createTransport({
              host: smtpHost,
              port: strategy.port,
              secure: strategy.secure,
              auth: { user: smtpUser, pass: smtpPass },
              connectionTimeout: 8000,
              greetingTimeout: 8000,
              socketTimeout: 12000,
              tls: { rejectUnauthorized: false },
            });

            await retryTransporter.sendMail({
              from: fallbackSender,
              to: cleanTo,
              subject: `Your 6-Digit Verification Code: ${otpCode} - LiveCall`,
              html: htmlContent,
            });

            console.log(`[Email Service] SMTP recovery dispatch succeeded to ${cleanTo}`);
            return {
              success: true,
              delivered: true,
              message: `Verification email sent to ${cleanTo}`,
            };
          } catch (retryErr: any) {
            lastSmtpError = retryErr;
            if ((retryErr.message || '').toLowerCase().includes('only send testing emails')) {
              console.warn(`[Email Service] Resend Sandbox Notice: Recipient ${cleanTo} is not the account owner.`);
              return {
                success: true,
                delivered: false,
                message: `Resend Sandbox Mode: Verify a domain at resend.com/domains to deliver to all emails. Verification code is available on-screen.`,
                otpCode,
              };
            }
          }
        }

        // If authentication error (535), don't keep cycling ports
        if (smtpErr.code === 'EAUTH' || smtpErr.responseCode === 535 || smtpErr.message?.includes('535')) {
          console.warn('[Email Service] SMTP authentication failed (535).');
          break;
        }
      }
    }

    // Format descriptive error message for admin/user
    let errorHelp = lastSmtpError?.message || 'SMTP Connection failed';
    if (lastSmtpError?.message?.includes('Greeting never received') || lastSmtpError?.code === 'ETIMEDOUT') {
      errorHelp = `SMTP Timeout (${smtpHost}). Ensure port 465 (SSL) or 587 (STARTTLS) is reachable and your email provider allows outbound SMTP connections.`;
    } else if (lastSmtpError?.code === 'EAUTH' || lastSmtpError?.responseCode === 535) {
      errorHelp = `SMTP Authentication failed (535). For Yahoo or Gmail, please use a generated App Password instead of your regular account password.`;
    } else if (lastSmtpError?.message?.toLowerCase().includes('only send testing emails')) {
      errorHelp = `Resend Sandbox Mode: Free accounts can only deliver emails to the account owner. Verify a custom domain at resend.com/domains to send to any recipient.`;
    }

    return {
      success: true,
      delivered: false,
      message: `Notice: ${errorHelp}`,
      otpCode,
    };
  }

  // 3. Fallback log for server monitoring
  console.log(`[OTP DISPATCH] Dispatched 6-digit OTP code to ${cleanTo}`);

  return {
    success: true,
    delivered: false,
    message: `Verification code registered for ${cleanTo}`,
  };
}
