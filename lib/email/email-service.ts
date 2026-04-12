import nodemailer from "nodemailer";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function parsePort(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error("AUTH_EMAIL_SMTP_PORT is invalid");
  }
  return parsed;
}

function getSmtpConfig(): SmtpConfig {
  const host = readRequiredEnv("AUTH_EMAIL_SMTP_HOST");
  const port = parsePort(readRequiredEnv("AUTH_EMAIL_SMTP_PORT"));
  const user = readRequiredEnv("AUTH_EMAIL_SMTP_USER");
  const pass = readRequiredEnv("AUTH_EMAIL_SMTP_PASS");
  const from = readRequiredEnv("AUTH_EMAIL_FROM");
  const secureFlag = process.env.AUTH_EMAIL_SMTP_SECURE?.trim().toLowerCase();
  const secure =
    secureFlag === undefined || secureFlag.length === 0
      ? port === 465
      : secureFlag === "true";

  return { host, port, secure, user, pass, from };
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private transportCacheKey = "";
  private fromAddress = "";

  private getTransporter() {
    const config = getSmtpConfig();
    const cacheKey = `${config.host}:${config.port}:${config.user}:${config.secure}`;
    if (!this.transporter || this.transportCacheKey !== cacheKey) {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
      this.transportCacheKey = cacheKey;
      this.fromAddress = config.from;
    }

    return this.transporter;
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const transporter = this.getTransporter();
    await transporter.sendMail({
      from: this.fromAddress,
      to,
      subject,
      html,
    });
  }
}

export const emailService = new EmailService();

