import crypto from "node:crypto";

const SMS_ENDPOINT = "https://sms.tencentcloudapi.com";
const SMS_HOST = "sms.tencentcloudapi.com";
const SMS_ACTION = "SendSms";
const SMS_VERSION = "2021-01-11";
const SMS_SERVICE = "sms";

interface TencentSmsEnv {
  appId: string;
  signName: string;
  templateId: string;
  secretId: string;
  secretKey: string;
  region: string;
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256(key: string | Buffer, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function getTencentSmsEnv(): TencentSmsEnv {
  const appId = process.env.TENCENT_SMS_APP_ID?.trim() || "";
  const signName = process.env.TENCENT_SMS_SIGN_NAME?.trim() || "";
  const templateId = process.env.TENCENT_SMS_TEMPLATE_ID?.trim() || "";
  const secretId = process.env.TENCENT_SMS_SECRET_ID?.trim() || "";
  const secretKey = process.env.TENCENT_SMS_SECRET_KEY?.trim() || "";
  const region = process.env.TENCENT_SMS_REGION?.trim() || "ap-guangzhou";

  if (!appId || !signName || !templateId || !secretId || !secretKey) {
    throw new Error(
      "Tencent SMS environment variables are incomplete. Required: TENCENT_SMS_APP_ID, TENCENT_SMS_SIGN_NAME, TENCENT_SMS_TEMPLATE_ID, TENCENT_SMS_SECRET_ID, TENCENT_SMS_SECRET_KEY.",
    );
  }

  return { appId, signName, templateId, secretId, secretKey, region };
}

function normalizeMainlandChinaPhone(phone: string): string {
  const normalized = phone.replace(/\s+/g, "");
  if (/^\+?86\d{11}$/.test(normalized)) {
    return normalized.startsWith("+86") ? normalized : `+${normalized}`;
  }
  if (/^1[3-9]\d{9}$/.test(normalized)) {
    return `+86${normalized}`;
  }
  throw new Error("Invalid mainland China phone number format.");
}

function buildAuthorization(params: {
  payload: string;
  timestamp: number;
  secretId: string;
  secretKey: string;
  contentType: string;
}) {
  const date = new Date(params.timestamp * 1000).toISOString().slice(0, 10);
  const canonicalHeaders = `content-type:${params.contentType}\nhost:${SMS_HOST}\n`;
  const signedHeaders = "content-type;host";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256Hex(params.payload),
  ].join("\n");

  const credentialScope = `${date}/${SMS_SERVICE}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(params.timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const secretDate = hmacSha256(`TC3${params.secretKey}`, date);
  const secretService = hmacSha256(secretDate, SMS_SERVICE);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = crypto
    .createHmac("sha256", secretSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `TC3-HMAC-SHA256 Credential=${params.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

export async function sendTencentSmsCode(phone: string, code: string) {
  const env = getTencentSmsEnv();
  const timestamp = Math.floor(Date.now() / 1000);
  const contentType = "application/json; charset=utf-8";
  const payloadObject = {
    PhoneNumberSet: [normalizeMainlandChinaPhone(phone)],
    SmsSdkAppId: env.appId,
    SignName: env.signName,
    TemplateId: env.templateId,
    TemplateParamSet: [code],
  };
  const payload = JSON.stringify(payloadObject);

  const authorization = buildAuthorization({
    payload,
    timestamp,
    secretId: env.secretId,
    secretKey: env.secretKey,
    contentType,
  });

  const response = await fetch(SMS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": contentType,
      Host: SMS_HOST,
      "X-TC-Action": SMS_ACTION,
      "X-TC-Version": SMS_VERSION,
      "X-TC-Region": env.region,
      "X-TC-Timestamp": String(timestamp),
    },
    body: payload,
    cache: "no-store",
  });

  const payloadJson = (await response.json()) as {
    Response?: {
      Error?: { Code?: string; Message?: string };
      RequestId?: string;
      SendStatusSet?: Array<{
        Code?: string;
        Message?: string;
        SerialNo?: string;
        PhoneNumber?: string;
      }>;
    };
  };

  if (!response.ok) {
    throw new Error(
      payloadJson?.Response?.Error?.Message ||
        `Tencent SMS HTTP error: ${response.status}`,
    );
  }

  if (payloadJson?.Response?.Error?.Code) {
    throw new Error(
      `Tencent SMS error ${payloadJson.Response.Error.Code}: ${payloadJson.Response.Error.Message || "unknown"}`,
    );
  }

  const status = payloadJson?.Response?.SendStatusSet?.[0];
  if (!status || status.Code !== "Ok") {
    throw new Error(
      `Tencent SMS send failed: ${status?.Code || "Unknown"} ${status?.Message || ""}`.trim(),
    );
  }

  return {
    requestId: payloadJson.Response?.RequestId || "",
    serialNo: status.SerialNo || "",
  };
}

