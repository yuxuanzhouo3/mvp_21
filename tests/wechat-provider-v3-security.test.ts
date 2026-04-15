import crypto from "crypto";

import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider-v3";

function createBaseConfig() {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  return {
    appId: "wx_test_app",
    mchId: "mch_test_001",
    apiV3Key: "12345678901234567890123456789012",
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    serialNo: "serial_test_001",
    notifyUrl: "https://example.com/api/payment/webhook/wechat",
  };
}

describe("WechatProviderV3 security behavior", () => {
  test("verifies webhook signature with platform public key", () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    const provider = new WechatProviderV3({
      ...createBaseConfig(),
      platformPublicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
    });

    const body = JSON.stringify({ event_type: "TRANSACTION.SUCCESS" });
    const timestamp = "1710000000";
    const nonce = "nonce-abc-123";
    const message = `${timestamp}\n${nonce}\n${body}\n`;
    const signature = crypto
      .createSign("RSA-SHA256")
      .update(message)
      .sign(privateKey.export({ type: "pkcs8", format: "pem" }).toString(), "base64");

    expect(provider.verifyWebhookSignature(body, signature, timestamp, nonce)).toBe(true);
    expect(
      provider.verifyWebhookSignature(
        JSON.stringify({ event_type: "TRANSACTION.FAILED" }),
        signature,
        timestamp,
        nonce,
      ),
    ).toBe(false);
  });

  test("decrypts webhook payload using aes-256-gcm with auth tag", () => {
    const provider = new WechatProviderV3(createBaseConfig());
    const payload = {
      trade_state: "SUCCESS",
      out_trade_no: "order_123",
      transaction_id: "txn_123",
    };
    const nonce = "123456789012";
    const associatedData = "txn";

    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      Buffer.from("12345678901234567890123456789012", "utf8"),
      Buffer.from(nonce, "utf8"),
    );
    cipher.setAAD(Buffer.from(associatedData, "utf8"));

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(payload), "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    const ciphertext = Buffer.concat([encrypted, authTag]).toString("base64");

    expect(provider.decryptWebhookData(ciphertext, nonce, associatedData)).toEqual(payload);
  });

  test("rejects fallback hmac verification in production when platform key is missing", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.NODE_ENV = "production";

    try {
      const provider = new WechatProviderV3(createBaseConfig());
      const body = JSON.stringify({ event_type: "TRANSACTION.SUCCESS" });
      const timestamp = "1710000000";
      const nonce = "nonce-abc-123";
      const hmacSignature = crypto
        .createHmac("sha256", "12345678901234567890123456789012")
        .update(`${timestamp}\n${nonce}\n${body}\n`)
        .digest("base64");

      expect(provider.verifyWebhookSignature(body, hmacSignature, timestamp, nonce)).toBe(
        false,
      );
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      consoleErrorSpy.mockRestore();
    }
  });
});
