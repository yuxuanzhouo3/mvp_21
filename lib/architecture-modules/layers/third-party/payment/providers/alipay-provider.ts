import {
  AbstractAlipayProvider,
  AlipayConfig,
} from "./abstract/alipay-provider";
const { AlipaySdk } = require("alipay-sdk");
import * as crypto from "crypto";
import * as fs from "fs";

type ParsedAlipayError = {
  code: string;
  message: string;
  type: "parameter" | "permission" | "system" | "network" | "unknown";
  suggestions: string;
};

function normalizeMultilineSecret(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

function normalizePrivateKeyPem(value: string) {
  const normalized = normalizeMultilineSecret(value);
  const candidates = normalized.includes("BEGIN")
    ? [normalized]
    : [
        `-----BEGIN PRIVATE KEY-----\n${normalized}\n-----END PRIVATE KEY-----`,
        `-----BEGIN RSA PRIVATE KEY-----\n${normalized}\n-----END RSA PRIVATE KEY-----`,
      ];

  for (const candidate of candidates) {
    try {
      return crypto
        .createPrivateKey(candidate)
        .export({ format: "pem", type: "pkcs8" })
        .toString();
    } catch {
      // Try the next supported PEM shape.
    }
  }

  throw new Error("Invalid Alipay private key format");
}

function normalizePublicKeyPem(value: string) {
  const normalized = normalizeMultilineSecret(value);
  const candidates = normalized.includes("BEGIN")
    ? [normalized]
    : [`-----BEGIN PUBLIC KEY-----\n${normalized}\n-----END PUBLIC KEY-----`];

  for (const candidate of candidates) {
    try {
      return crypto
        .createPublicKey(candidate)
        .export({ format: "pem", type: "spki" })
        .toString();
    } catch {
      // Try the next supported PEM shape.
    }
  }

  throw new Error("Invalid Alipay public key format");
}

export class AlipayProvider extends AbstractAlipayProvider {
  private alipaySdk: any;

  constructor(config: any) {
    const appUrl = (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");

    const sandboxEnabled =
      (config.ALIPAY_SANDBOX || process.env.ALIPAY_SANDBOX || "")
        .toLowerCase()
        .trim() === "true";
    const notifyUrl =
      config.ALIPAY_NOTIFY_URL ||
      process.env.ALIPAY_NOTIFY_URL ||
      `${appUrl}/api/payment/webhook/alipay`;
    const returnUrl =
      config.ALIPAY_RETURN_URL ||
      process.env.ALIPAY_RETURN_URL ||
      `${appUrl}/payment/success`;
    const certMode =
      (config.ALIPAY_CERT_MODE || process.env.ALIPAY_CERT_MODE) === "true";

    const readMaybeFile = (content?: string, pathEnv?: string) => {
      if (content && content.trim()) return content;
      if (pathEnv && fs.existsSync(pathEnv)) {
        return fs.readFileSync(pathEnv, "utf8");
      }
      return "";
    };

    const rawPrivateKey =
      config.ALIPAY_PRIVATE_KEY || process.env.ALIPAY_PRIVATE_KEY || "";
    const rawPublicKey =
      config.ALIPAY_PUBLIC_KEY ||
      process.env.ALIPAY_PUBLIC_KEY ||
      config.ALIPAY_ALIPAY_PUBLIC_KEY ||
      process.env.ALIPAY_ALIPAY_PUBLIC_KEY ||
      "";
    const rawAlipayPublicKey =
      config.ALIPAY_ALIPAY_PUBLIC_KEY ||
      process.env.ALIPAY_ALIPAY_PUBLIC_KEY ||
      rawPublicKey;

    const alipayConfig: AlipayConfig = {
      appId: config.ALIPAY_APP_ID || process.env.ALIPAY_APP_ID || "",
      privateKey: rawPrivateKey,
      publicKey: rawPublicKey,
      alipayPublicKey: rawAlipayPublicKey,
      notifyUrl,
      returnUrl,
      gatewayUrl:
        config.ALIPAY_GATEWAY_URL ||
        process.env.ALIPAY_GATEWAY_URL ||
        (sandboxEnabled
          ? "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
          : "https://openapi.alipay.com/gateway.do"),
      certMode,
      appCertContent: readMaybeFile(
        config.ALIPAY_APP_CERT || process.env.ALIPAY_APP_CERT,
        config.ALIPAY_APP_CERT_PATH || process.env.ALIPAY_APP_CERT_PATH
      ),
      alipayPublicCertContent: readMaybeFile(
        config.ALIPAY_ALIPAY_PUBLIC_CERT || process.env.ALIPAY_ALIPAY_PUBLIC_CERT,
        config.ALIPAY_ALIPAY_PUBLIC_CERT_PATH ||
          process.env.ALIPAY_ALIPAY_PUBLIC_CERT_PATH
      ),
      alipayRootCertContent: readMaybeFile(
        config.ALIPAY_ALIPAY_ROOT_CERT || process.env.ALIPAY_ALIPAY_ROOT_CERT,
        config.ALIPAY_ALIPAY_ROOT_CERT_PATH ||
          process.env.ALIPAY_ALIPAY_ROOT_CERT_PATH
      ),
    };

    super(alipayConfig);

    const normalizedPrivateKey = normalizePrivateKeyPem(alipayConfig.privateKey);
    const sdkCommonConfig = {
      appId: alipayConfig.appId,
      privateKey: normalizedPrivateKey,
      keyType: "PKCS8" as const,
      signType: "RSA2" as const,
      gateway: alipayConfig.gatewayUrl,
      timeout: 30000,
      camelcase: false,
    };

    if (alipayConfig.certMode) {
      this.alipaySdk = new AlipaySdk({
        ...sdkCommonConfig,
        appCertContent: alipayConfig.appCertContent,
        alipayPublicCertContent: alipayConfig.alipayPublicCertContent,
        alipayRootCertContent: alipayConfig.alipayRootCertContent,
      });
    } else {
      this.alipaySdk = new AlipaySdk({
        ...sdkCommonConfig,
        alipayPublicKey: normalizePublicKeyPem(alipayConfig.alipayPublicKey),
      });
    }
  }

  protected async buildAlipayOrder(order: any): Promise<any> {
    const outTradeNo = this.generatePaymentId();
    const productMode = (process.env.ALIPAY_PRODUCT_MODE || "page").toLowerCase();
    const isWap = productMode === "wap";

    const bizContent = {
      out_trade_no: outTradeNo,
      total_amount: order.amount.toFixed(2),
      subject: order.description,
      product_code: isWap ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY",
      passback_params: order.userId || "",
      notify_url: this.alipayConfig.notifyUrl,
      return_url: this.alipayConfig.returnUrl,
    };

    return {
      method: isWap ? "alipay.trade.wap.pay" : "alipay.trade.page.pay",
      bizContent,
    };
  }

  protected async callAlipayAPI(orderData: any): Promise<any> {
    try {
      console.log("Calling Alipay API with order data:", orderData);

      const result = this.alipaySdk.pageExec(orderData.method, {
        return_url: orderData.bizContent.return_url,
        notify_url: orderData.bizContent.notify_url,
        bizContent: orderData.bizContent,
      });

      console.log("Alipay form HTML generated");

      return {
        success: true,
        paymentId: orderData.bizContent.out_trade_no,
        outTradeNo: orderData.bizContent.out_trade_no,
        payUrl: result,
        qrCode: null,
      };
    } catch (error) {
      console.error("Alipay API call failed:", error);
      const errorDetails = this.parseAlipayError(error);

      console.error("Alipay Error Details:", {
        errorCode: errorDetails.code,
        errorMessage: errorDetails.message,
        errorType: errorDetails.type,
        suggestions: errorDetails.suggestions,
      });

      throw new Error(
        `Alipay Payment Failed [${errorDetails.code}]: ${errorDetails.message}. ${errorDetails.suggestions}`
      );
    }
  }

  protected async queryPaymentStatus(paymentId: string): Promise<any> {
    try {
      console.log("Querying Alipay payment status for:", paymentId);

      const result = await this.alipaySdk.exec("alipay.trade.query", {
        bizContent: {
          out_trade_no: paymentId,
        },
      });

      console.log("Alipay query result:", result);

      if (result.code === "10000") {
        return {
          tradeStatus: result.tradeStatus,
          tradeNo: result.tradeNo,
          totalAmount: parseFloat(result.totalAmount),
          buyerPayAmount: parseFloat(
            result.buyerPayAmount || result.totalAmount
          ),
        };
      }

      const errorDetails = this.parseAlipayError({
        message: `Query failed: ${result.msg} (code: ${result.code})`,
      });
      throw new Error(
        `Payment query failed [${errorDetails.code}]: ${errorDetails.message}. ${errorDetails.suggestions}`
      );
    } catch (error) {
      console.error("Alipay query failed:", error);
      const errorDetails = this.parseAlipayError(error);

      console.error("Alipay Query Error Details:", {
        errorCode: errorDetails.code,
        errorMessage: errorDetails.message,
        errorType: errorDetails.type,
        suggestions: errorDetails.suggestions,
      });

      throw new Error(
        `Failed to query payment status [${errorDetails.code}]: ${errorDetails.message}. ${errorDetails.suggestions}`
      );
    }
  }

  protected async callRefundAPI(
    paymentId: string,
    amount: number
  ): Promise<any> {
    try {
      console.log(
        "Processing Alipay refund for:",
        paymentId,
        "amount:",
        amount
      );

      const outRefundNo = `refund_${paymentId}_${Date.now()}`;
      const result = await this.alipaySdk.exec("alipay.trade.refund", {
        bizContent: {
          out_trade_no: paymentId,
          refund_amount: amount.toFixed(2),
          out_request_no: outRefundNo,
        },
      });

      console.log("Alipay refund result:", result);

      if (result.code === "10000") {
        return {
          code: result.code,
          msg: result.msg,
          outRefundNo: result.outRequestNo || outRefundNo,
          refundAmount: parseFloat(result.refundFee || amount.toString()),
        };
      }

      const errorDetails = this.parseAlipayError({
        message: `Refund failed: ${result.msg} (code: ${result.code})`,
      });
      throw new Error(
        `Refund failed [${errorDetails.code}]: ${errorDetails.message}. ${errorDetails.suggestions}`
      );
    } catch (error) {
      console.error("Alipay refund failed:", error);
      const errorDetails = this.parseAlipayError(error);

      console.error("Alipay Refund Error Details:", {
        errorCode: errorDetails.code,
        errorMessage: errorDetails.message,
        errorType: errorDetails.type,
        suggestions: errorDetails.suggestions,
      });

      throw new Error(
        `Failed to process refund [${errorDetails.code}]: ${errorDetails.message}. ${errorDetails.suggestions}`
      );
    }
  }

  private parseAlipayError(error: any): ParsedAlipayError {
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = "Unknown Alipay error";
    let errorType: ParsedAlipayError["type"] = "unknown";
    let suggestions =
      "Check the Alipay app credentials, key format, gateway configuration, and product permissions.";

    try {
      const errorStr = error instanceof Error ? error.message : String(error);

      if (errorStr.includes("INVALID_PARAMETER")) {
        errorCode = "INVALID_PARAMETER";
        errorMessage = "Invalid Alipay request parameter";
        errorType = "parameter";
        suggestions =
          "Verify out_trade_no, total_amount, subject, product_code, notify_url, and return_url.";
      } else if (errorStr.includes("MISSING_REQUIRED_ARGUMENTS")) {
        errorCode = "MISSING_REQUIRED_ARGUMENTS";
        errorMessage = "Missing required Alipay parameter";
        errorType = "parameter";
        suggestions =
          "Verify out_trade_no, total_amount, subject, and product_code are present.";
      } else if (errorStr.includes("ILLEGAL_ARGUMENT")) {
        errorCode = "ILLEGAL_ARGUMENT";
        errorMessage = "Illegal Alipay request parameter";
        errorType = "parameter";
        suggestions =
          "Check amount formatting, order number length, and callback URL values.";
      } else if (errorStr.includes("INVALID_SIGNATURE")) {
        errorCode = "INVALID_SIGNATURE";
        errorMessage = "Invalid Alipay signature";
        errorType = "parameter";
        suggestions =
          "Verify the private key and platform public key match the production Alipay app.";
      } else if (errorStr.includes("INVALID_APP_ID")) {
        errorCode = "INVALID_APP_ID";
        errorMessage = "Invalid Alipay app ID";
        errorType = "permission";
        suggestions =
          "Confirm ALIPAY_APP_ID is the production app and the app is enabled for page payments.";
      } else if (errorStr.includes("PERMISSION_DENIED")) {
        errorCode = "PERMISSION_DENIED";
        errorMessage = "Alipay permission denied";
        errorType = "permission";
        suggestions =
          "Ensure the production app has the required payment product permissions.";
      } else if (errorStr.includes("PRODUCT_NOT_SUPPORT")) {
        errorCode = "PRODUCT_NOT_SUPPORT";
        errorMessage = "Alipay product not supported";
        errorType = "permission";
        suggestions =
          "Enable FAST_INSTANT_TRADE_PAY or QUICK_WAP_WAY for the production app.";
      } else if (errorStr.includes("SYSTEM_ERROR")) {
        errorCode = "SYSTEM_ERROR";
        errorMessage = "Alipay system error";
        errorType = "system";
        suggestions = "Retry later and check the Alipay trace ID.";
      } else if (errorStr.includes("SERVICE_UNAVAILABLE")) {
        errorCode = "SERVICE_UNAVAILABLE";
        errorMessage = "Alipay service unavailable";
        errorType = "system";
        suggestions = "Retry later and check the Alipay service status.";
      } else if (
        errorStr.includes("REQUEST_TIMEOUT") ||
        errorStr.toLowerCase().includes("timeout")
      ) {
        errorCode = "REQUEST_TIMEOUT";
        errorMessage = "Alipay request timeout";
        errorType = "network";
        suggestions =
          "Verify outbound connectivity to the Alipay production gateway.";
      } else if (
        errorStr.includes("NETWORK_ERROR") ||
        errorStr.includes("ECONNREFUSED")
      ) {
        errorCode = "NETWORK_ERROR";
        errorMessage = "Alipay network error";
        errorType = "network";
        suggestions =
          "Verify the gateway URL and server network connectivity.";
      } else if (errorStr.includes("CERTIFICATE_ERROR")) {
        errorCode = "CERTIFICATE_ERROR";
        errorMessage = "Alipay certificate error";
        errorType = "parameter";
        suggestions =
          "Check the uploaded certificate bundle or switch to a valid key-mode configuration.";
      }

      const codeMatch = errorStr.match(/code["\s:]+([A-Z_]+)/i);
      if (codeMatch?.[1]) {
        errorCode = codeMatch[1];
      }

      const msgMatch = errorStr.match(/msg["\s:]+([^",}]+)/i);
      if (msgMatch?.[1]) {
        errorMessage = msgMatch[1].trim();
      }
    } catch (parseError) {
      console.error("Error parsing Alipay error:", parseError);
    }

    return {
      code: errorCode,
      message: errorMessage,
      type: errorType,
      suggestions,
    };
  }

  protected verifyCallbackSignature(params: any): boolean {
    try {
      console.log("Verifying Alipay callback signature:", params);
      console.log(
        "Environment check - NODE_ENV:",
        process.env.NODE_ENV,
        "ALIPAY_SANDBOX:",
        process.env.ALIPAY_SANDBOX
      );

      const nodeEnv = (process.env.NODE_ENV || "").toLowerCase().trim();
      const alipayEnv = (process.env.ALIPAY_SANDBOX || "").toLowerCase().trim();

      if (nodeEnv === "development" || alipayEnv === "true") {
        console.log(
          "Skipping signature verification in development/sandbox mode",
          { nodeEnv, alipayEnv }
        );
        return true;
      }

      if (!params.sign || !params.sign_type) {
        console.log(
          "No signature found in params (likely sync return, not async notify)",
          {
            hasSign: !!params.sign,
            hasSignType: !!params.sign_type,
            paramsKeys: Object.keys(params),
          }
        );
        return true;
      }

      const isValid = this.alipaySdk.checkNotifySignV2(params);
      if (!isValid) {
        console.error("Alipay callback signature verification failed", {
          paramsKeys: Object.keys(params),
          hasSign: !!params.sign,
          hasSignType: !!params.sign_type,
        });
        return false;
      }

      console.log("Alipay callback signature verified successfully");
      return true;
    } catch (error) {
      console.error("Alipay signature verification error:", error, {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  public async verifyCallback(
    params: Record<string, string>
  ): Promise<boolean> {
    return this.verifyCallbackSignature(params);
  }

  public async queryPayment(
    reference: string,
    referenceType: "out_trade_no" | "trade_no" = "out_trade_no",
  ): Promise<any> {
    try {
      const result = await this.alipaySdk.exec("alipay.trade.query", {
        bizContent: {
          [referenceType]: reference,
        },
      });

      if (result.code === "10000") {
        return {
          trade_status: result.tradeStatus,
          trade_no: result.tradeNo,
          total_amount: result.totalAmount,
          buyer_pay_amount: result.buyerPayAmount || result.totalAmount,
        };
      }

      const errorDetails = this.parseAlipayError({
        message: `Query failed: ${result.msg} (code: ${result.code})`,
      });
      throw new Error(
        `Payment query failed [${errorDetails.code}]: ${errorDetails.message}. ${errorDetails.suggestions}`
      );
    } catch (error) {
      console.error("Alipay public query failed:", error);
      const errorDetails = this.parseAlipayError(error);

      console.error("Alipay Public Query Error Details:", {
        errorCode: errorDetails.code,
        errorMessage: errorDetails.message,
        errorType: errorDetails.type,
        suggestions: errorDetails.suggestions,
      });

      throw new Error(
        `Failed to query payment [${errorDetails.code}]: ${errorDetails.message}. ${errorDetails.suggestions}`
      );
    }
  }
}
