import crypto from "crypto";
import axios, { AxiosInstance } from "axios";

interface WechatV3Config {
  appId: string;
  mchId: string;
  apiV3Key: string;
  privateKey: string;
  serialNo: string;
  notifyUrl: string;
  platformPublicKey?: string;
}

interface CreateNativeOrderParams {
  out_trade_no: string;
  amount: number;
  description: string;
  clientIp?: string;
}

interface PaymentStatus {
  tradeState: string;
  transactionId?: string;
  amount?: number;
  successTime?: string;
}

export class WechatProviderV3 {
  private config: WechatV3Config;
  private readonly apiBaseUrl = "https://api.mch.weixin.qq.com";
  private axiosInstance: AxiosInstance;

  constructor(config: WechatV3Config) {
    this.config = this.validateConfig(config);
    this.axiosInstance = this.initAxios();
  }

  private validateConfig(config: WechatV3Config): WechatV3Config {
    const required = ["appId", "mchId", "apiV3Key", "privateKey", "serialNo", "notifyUrl"];
    for (const key of required) {
      if (!config[key as keyof WechatV3Config]) {
        throw new Error(`Missing required config: ${key}`);
      }
    }

    if (config.apiV3Key.length !== 32) {
      throw new Error("API v3 key must be 32 bytes");
    }

    const normalizedPrivateKey = config.privateKey.replace(/\\n/g, "\n");

    if (normalizedPrivateKey.length < 100) {
      console.error("[WeChat] Invalid merchant private key length.");
      throw new Error("Invalid WeChat private key");
    }

    if (
      !normalizedPrivateKey.includes("BEGIN PRIVATE KEY") &&
      !normalizedPrivateKey.includes("BEGIN RSA PRIVATE KEY")
    ) {
      console.error("[WeChat] Merchant private key is not in PEM format.");
      throw new Error("Invalid WeChat private key format");
    }

    return {
      ...config,
      privateKey: normalizedPrivateKey,
      platformPublicKey:
        config.platformPublicKey?.replace(/\\n/g, "\n") ||
        process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY?.replace(/\\n/g, "\n") ||
        process.env.WECHAT_PAY_PUBLIC_KEY?.replace(/\\n/g, "\n") ||
        "",
    };
  }

  private initAxios(): AxiosInstance {
    return axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  async createNativePayment(params: CreateNativeOrderParams): Promise<{ codeUrl: string }> {
    try {
      const requestBody = {
        appid: this.config.appId,
        mchid: this.config.mchId,
        description: params.description,
        out_trade_no: params.out_trade_no,
        notify_url: this.config.notifyUrl,
        amount: {
          total: params.amount,
          currency: "CNY",
        },
      };

      const response = await this.requestWithSignature(
        "POST",
        "/v3/pay/transactions/native",
        requestBody,
      );

      if (!response.code_url) {
        throw new Error("No code_url in WeChat response");
      }

      return {
        codeUrl: response.code_url,
      };
    } catch (error) {
      console.error("WeChat createNativePayment error:", error);
      throw error;
    }
  }

  async queryOrderByOutTradeNo(outTradeNo: string): Promise<PaymentStatus> {
    try {
      const path = `/v3/pay/transactions/out-trade-no/${outTradeNo}`;
      const queryParams = { mchid: this.config.mchId };

      const response = await this.requestWithSignature(
        "GET",
        path,
        null,
        queryParams,
      );

      return {
        tradeState: response.trade_state || "UNKNOWN",
        transactionId: response.transaction_id,
        amount: response.amount?.total,
        successTime: response.success_time,
      };
    } catch (error) {
      console.error("WeChat queryOrderByOutTradeNo error:", error);
      throw error;
    }
  }

  async queryOrderByTransactionId(transactionId: string): Promise<PaymentStatus> {
    try {
      const path = `/v3/pay/transactions/id/${transactionId}`;
      const queryParams = { mchid: this.config.mchId };

      const response = await this.requestWithSignature(
        "GET",
        path,
        null,
        queryParams,
      );

      return {
        tradeState: response.trade_state || "UNKNOWN",
        transactionId: response.transaction_id,
        amount: response.amount?.total,
        successTime: response.success_time,
      };
    } catch (error) {
      console.error("WeChat queryOrderByTransactionId error:", error);
      throw error;
    }
  }

  async refund(params: {
    transactionId?: string;
    outTradeNo?: string;
    outRefundNo: string;
    amount: number;
    reason?: string;
  }): Promise<{ refundId: string; status: string }> {
    try {
      const requestBody: Record<string, unknown> = {
        out_refund_no: params.outRefundNo,
        amount: {
          refund: params.amount,
          total: params.amount,
          currency: "CNY",
        },
      };

      if (params.transactionId) {
        requestBody.transaction_id = params.transactionId;
      } else if (params.outTradeNo) {
        requestBody.out_trade_no = params.outTradeNo;
      } else {
        throw new Error("Either transactionId or outTradeNo is required");
      }

      if (params.reason) {
        requestBody.reason = params.reason;
      }

      const response = await this.requestWithSignature(
        "POST",
        "/v3/refund/domestic/refunds",
        requestBody,
      );

      return {
        refundId: response.refund_id,
        status: response.status,
      };
    } catch (error) {
      console.error("WeChat refund error:", error);
      throw error;
    }
  }

  verifyWebhookSignature(
    body: string,
    signature: string,
    timestamp: string,
    nonce: string,
  ): boolean {
    try {
      if (!signature || !timestamp || !nonce) {
        return false;
      }

      const message = `${timestamp}\n${nonce}\n${body}\n`;
      const platformPublicKey = this.config.platformPublicKey || "";

      if (platformPublicKey) {
        const verifier = crypto.createVerify("RSA-SHA256");
        verifier.update(message);
        verifier.end();
        return verifier.verify(platformPublicKey, signature, "base64");
      }

      // Dev compatibility fallback only. Do not rely on this in production.
      if (process.env.NODE_ENV === "production") {
        console.error("[WeChat] Missing platform public key for webhook signature verification.");
        return false;
      }

      const expectedSignature = crypto
        .createHmac("sha256", this.config.apiV3Key)
        .update(message)
        .digest("base64");

      return this.safeCompare(expectedSignature, signature);
    } catch (error) {
      console.error("WeChat signature verification error:", error);
      return false;
    }
  }

  decryptWebhookData(
    ciphertext: string,
    nonce: string,
    associatedData: string,
  ): any {
    try {
      const encryptedBytes = Buffer.from(ciphertext, "base64");
      if (encryptedBytes.length <= 16) {
        throw new Error("Invalid ciphertext payload");
      }

      const authTag = encryptedBytes.subarray(encryptedBytes.length - 16);
      const encryptedData = encryptedBytes.subarray(0, encryptedBytes.length - 16);

      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        Buffer.from(this.config.apiV3Key, "utf-8"),
        Buffer.from(nonce, "utf-8"),
      );

      if (associatedData) {
        decipher.setAAD(Buffer.from(associatedData, "utf-8"));
      }
      decipher.setAuthTag(authTag);

      const decryptedBuffer = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
      return JSON.parse(decryptedBuffer.toString("utf8"));
    } catch (error) {
      console.error("WeChat webhook decryption error:", error);
      throw new Error("Failed to decrypt webhook data");
    }
  }

  async handleWebhookNotification(webhookBody: any): Promise<any> {
    try {
      const { resource } = webhookBody;
      if (!resource) {
        throw new Error("Missing resource in webhook");
      }

      return this.decryptWebhookData(
        resource.ciphertext,
        resource.nonce,
        resource.associated_data,
      );
    } catch (error) {
      console.error("WeChat webhook handling error:", error);
      throw error;
    }
  }

  private async requestWithSignature(
    method: string,
    path: string,
    body: any = null,
    queryParams: Record<string, any> = {},
  ): Promise<any> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = this.generateNonce();

      let url = path;
      if (Object.keys(queryParams).length > 0) {
        const queryString = Object.entries(queryParams)
          .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
          .join("&");
        url = `${path}?${queryString}`;
      }

      const bodyStr = body ? JSON.stringify(body) : "";
      const signature = this.buildSignature(method, url, timestamp, nonce, bodyStr);

      const config: any = {
        method,
        url: `${this.apiBaseUrl}${url}`,
        headers: {
          Authorization: signature,
          "Wechat-Pay-Timestamp": timestamp,
          "Wechat-Pay-Nonce": nonce,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      };

      if (body && method.toUpperCase() !== "GET") {
        config.data = body;
      }

      const response = await this.axiosInstance(config);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        console.error("WeChat API error:", error.response.data);
        throw new Error(`WeChat API error: ${error.response.data.message || error.message}`);
      }
      throw error;
    }
  }

  private buildSignature(
    method: string,
    path: string,
    timestamp: string,
    nonce: string,
    body: string,
  ): string {
    try {
      const normalizedMethod = method.toUpperCase();
      const message = `${normalizedMethod}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
      const privateKey = this.formatPrivateKey(this.config.privateKey);

      const sign = crypto
        .createSign("RSA-SHA256")
        .update(message)
        .sign(privateKey, "base64");

      return `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonce}",signature="${sign}",timestamp="${timestamp}",serial_no="${this.config.serialNo}"`;
    } catch (error) {
      console.error("WeChat signature building error:", error);
      throw new Error("Failed to build signature");
    }
  }

  private formatPrivateKey(key: string): string {
    let cleanKey = key.trim().replace(/\s/g, "");
    const isPKCS1 = key.includes("BEGIN RSA PRIVATE KEY");
    const isPKCS8 = key.includes("BEGIN PRIVATE KEY");

    if (isPKCS1 || isPKCS8) {
      const match = key.match(/-----BEGIN[^-]*-----\s*([\s\S]*?)\s*-----END[^-]*-----/);
      if (match && match[1]) {
        cleanKey = match[1].replace(/\s/g, "");
      }
    }

    const header = isPKCS1 ? "BEGIN RSA PRIVATE KEY" : "BEGIN PRIVATE KEY";
    const footer = isPKCS1 ? "END RSA PRIVATE KEY" : "END PRIVATE KEY";

    let formattedKey = `-----${header}-----\n`;
    for (let i = 0; i < cleanKey.length; i += 64) {
      formattedKey += `${cleanKey.slice(i, i + 64)}\n`;
    }
    formattedKey += `-----${footer}-----`;

    return formattedKey;
  }

  private generateNonce(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  private safeCompare(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);

    if (aBuf.length !== bBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(aBuf, bBuf);
  }
}
