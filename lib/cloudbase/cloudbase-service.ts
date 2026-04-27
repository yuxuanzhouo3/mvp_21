import cloudbase from "@cloudbase/node-sdk";
import bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { signJwt } from "@/lib/auth/jwt";
import { createRefreshToken } from "@/lib/auth/refresh-token-manager";

let cachedApp: any = null;
const CHINA_PHONE_REGEX = /^1[3-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeLoginIdentifier(identifier: string) {
  return identifier.trim();
}

function isChinaMainlandPhone(identifier: string) {
  return CHINA_PHONE_REGEX.test(identifier);
}

function isEmailIdentifier(identifier: string) {
  return EMAIL_REGEX.test(identifier);
}

function initCloudBase() {
  if (cachedApp) {
    return cachedApp;
  }

  cachedApp = cloudbase.init({
    env: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    secretId: process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.CLOUDBASE_SECRET_KEY,
  });

  return cachedApp;
}

export function extractUserIdFromToken(token: string): string | null {
  if (!token) {
    console.error(" [CloudBase Service] 无效的 token");
    return null;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      console.error(
        " [CloudBase Service] Token 格式错误，部分数:",
        parts.length
      );
      return null;
    }

    const payload = parts[1];
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf-8");
    const claims = JSON.parse(decoded);

    const userId = claims.userId || claims.uid || claims.sub || claims.user_id;
    if (!userId) {
      console.error(
        " [CloudBase Service] Token 中找不到 userId/uid/sub/user_id"
      );
      return null;
    }

    console.log(" [CloudBase Service] Token 解码成功，userId:", userId);
    return userId;
  } catch (error) {
    console.error(" [CloudBase Service] Token 解码失败:", error);
    return null;
  }
}

export async function loginUser(
  identifier: string,
  password: string,
  options?: { deviceInfo?: string; ipAddress?: string; userAgent?: string }
): Promise<{
  success: boolean;
  userId?: string;
  email?: string;
  phone?: string;
  name?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenMeta?: { accessTokenExpiresIn: number; refreshTokenExpiresIn: number };
  error?: string;
}> {
  try {
    const normalizedIdentifier = normalizeLoginIdentifier(identifier);
    const isPhoneLogin = isChinaMainlandPhone(normalizedIdentifier);
    const isEmailLogin = isEmailIdentifier(normalizedIdentifier);

    if (!normalizedIdentifier || (!isPhoneLogin && !isEmailLogin)) {
      return {
        success: false,
        error: "请输入正确的邮箱或手机号",
      };
    }

    console.log(" [CloudBase Service] 开始登录，标识:", normalizedIdentifier);

    const app = initCloudBase();
    const db = app.database();
    const usersCollection = db.collection("web_users");

    let userResult = await usersCollection
      .where(
        isPhoneLogin
          ? { phone: normalizedIdentifier }
          : { email: normalizedIdentifier.toLowerCase() }
      )
      .limit(1)
      .get();

    if (
      !isPhoneLogin &&
      (!userResult.data || userResult.data.length === 0) &&
      normalizedIdentifier.toLowerCase() !== normalizedIdentifier
    ) {
      userResult = await usersCollection
        .where({ email: normalizedIdentifier })
        .limit(1)
        .get();
    }

    if ((!userResult.data || userResult.data.length === 0) && isPhoneLogin) {
      // Backward compatibility: older phone users may only have a synthetic email.
      const syntheticEmail = `phone_${normalizedIdentifier}@local.phone`;
      const bySyntheticEmail = await usersCollection
        .where({ email: syntheticEmail })
        .limit(1)
        .get();
      if (bySyntheticEmail.data && bySyntheticEmail.data.length > 0) {
        const legacyUser = bySyntheticEmail.data[0];
        if (!legacyUser.phone) {
          await usersCollection.doc(legacyUser._id).update({
            phone: normalizedIdentifier,
            updated_at: new Date().toISOString(),
          });
        }
        userResult = bySyntheticEmail;
      }
    }

    if (!userResult.data || userResult.data.length === 0) {
      return {
        success: false,
        error: "账号不存在或密码错误",
      };
    }

    const user = userResult.data[0];

    const isPasswordValid =
      typeof user.password === "string" &&
      user.password.length > 0 &&
      (await bcrypt.compare(password, user.password));

    if (!isPasswordValid) {
      return {
        success: false,
        error: "账号不存在或密码错误",
      };
    }

    console.log(" [CloudBase Service] 登录成功");

    const tokenPayload = {
      userId: user._id,
      email: user.email,
      region: "CN",
    };

    // ✅ 生成短期 Access Token (1小时)
    const accessToken = signJwt(
      tokenPayload,
      { expiresIn: "1h" }
    );

    // ✅ 生成并保存长期 Refresh Token (7天) - 方案 B
    const refreshTokenRecord = await createRefreshToken({
      userId: user._id,
      email: user.email,
      deviceInfo: options?.deviceInfo,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });

    if (!refreshTokenRecord) {
      return {
        success: false,
        error: "无法生成 refresh token",
      };
    }

    const refreshToken = refreshTokenRecord.refreshToken;

    return {
      success: true,
      userId: user._id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      accessToken,
      refreshToken,
      tokenMeta: {
        accessTokenExpiresIn: 3600, // 1 小时
        refreshTokenExpiresIn: 604800, // 7 天
      },
    };
  } catch (error: any) {
    console.error(" [CloudBase Service] 登录失败:", error);
    return {
      success: false,
      error: error.message || "登录失败",
    };
  }
}

export async function signupUser(
  email: string,
  password: string,
  options?: { deviceInfo?: string; ipAddress?: string; userAgent?: string }
): Promise<{
  success: boolean;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenMeta?: { accessTokenExpiresIn: number; refreshTokenExpiresIn: number };
  error?: string;
}> {
  try {
    console.log(" [CloudBase Service] 开始注册，邮箱:", email);

    const app = initCloudBase();
    const db = app.database();
    const usersCollection = db.collection("web_users");

    const existingUserResult = await usersCollection.where({ email }).get();

    if (existingUserResult.data && existingUserResult.data.length > 0) {
      return {
        success: false,
        error: "该邮箱已被注册",
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      email,
      password: hashedPassword,
      name: email.includes("@") ? email.split("@")[0] : email,
      pro: false,
      region: "china",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await usersCollection.add(newUser);

    console.log(" [CloudBase Service] 注册成功");

    const tokenPayload = {
      userId: result.id,
      email,
      region: "CN",
    };

    // ✅ 生成短期 accessToken (1小时)
    const accessToken = signJwt(
      tokenPayload,
      { expiresIn: "1h" }
    );

    console.log("[CloudBase Service] AccessToken generated for signup");

    // ✅ 生成并持久化 refreshToken (7天)
    const refreshTokenRecord = await createRefreshToken({
      userId: result.id,
      email,
      deviceInfo: options?.deviceInfo || "web-signup",
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });

    if (!refreshTokenRecord) {
      console.warn(
        "[CloudBase Service] Failed to create refresh token during signup"
      );
      // 不返回错误，因为 accessToken 已生成可用
      return {
        success: true,
        userId: result.id,
        accessToken,
        refreshToken: undefined as any,
        tokenMeta: {
          accessTokenExpiresIn: 3600,
          refreshTokenExpiresIn: 0,
        },
      };
    }

    const refreshTokenValue = refreshTokenRecord.refreshToken;

    return {
      success: true,
      userId: result.id,
      accessToken,
      refreshToken: refreshTokenValue,
      tokenMeta: {
        accessTokenExpiresIn: 3600, // 1 hour
        refreshTokenExpiresIn: 604800, // 7 days
      },
    };
  } catch (error: any) {
    console.error(" [CloudBase Service] 注册失败:", error);
    return {
      success: false,
      error: error.message || "注册失败",
    };
  }
}

export function getDatabase() {
  const app = initCloudBase();
  return app.database();
}

export async function loginOrCreatePhoneUser(
  phone: string,
  options?: { deviceInfo?: string; ipAddress?: string; userAgent?: string }
): Promise<{
  success: boolean;
  userId?: string;
  email?: string;
  phone?: string;
  name?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenMeta?: { accessTokenExpiresIn: number; refreshTokenExpiresIn: number };
  error?: string;
}> {
  try {
    const normalizedPhone = normalizeLoginIdentifier(phone);
    if (!isChinaMainlandPhone(normalizedPhone)) {
      return {
        success: false,
        error: "手机号格式不正确",
      };
    }

    const app = initCloudBase();
    const db = app.database();
    const usersCollection = db.collection("web_users");
    const now = new Date().toISOString();
    const syntheticEmail = `phone_${normalizedPhone}@local.phone`;

    const existingUserResult = await usersCollection
      .where({ phone: normalizedPhone })
      .limit(1)
      .get();
    let user = existingUserResult.data?.[0];

    if (!user) {
      const legacyUserResult = await usersCollection
        .where({ email: syntheticEmail })
        .limit(1)
        .get();
      const legacyUser = legacyUserResult.data?.[0];
      if (legacyUser) {
        await usersCollection.doc(legacyUser._id).update({
          phone: normalizedPhone,
          updated_at: now,
        });
        const refreshedLegacyUser = await usersCollection.doc(legacyUser._id).get();
        user =
          refreshedLegacyUser.data?.[0] || {
            ...legacyUser,
            phone: normalizedPhone,
            updated_at: now,
          };
      }
    }

    if (!user) {
      const created = await usersCollection.add({
        email: syntheticEmail,
        password: await bcrypt.hash(crypto.randomUUID(), 10),
        name: `用户${normalizedPhone.slice(-4)}`,
        phone: normalizedPhone,
        status: "active",
        pro: false,
        subscription_plan: "free",
        subscription_status: "inactive",
        region: "china",
        login_count: 1,
        last_login_at: now,
        last_login_ip: options?.ipAddress,
        createdAt: now,
        updatedAt: now,
        created_at: now,
        updated_at: now,
      });

      const createdUserResult = await usersCollection.doc(created.id).get();
      user = createdUserResult.data?.[0] || {
        _id: created.id,
        email: syntheticEmail,
        name: `用户${normalizedPhone.slice(-4)}`,
        phone: normalizedPhone,
      };
    } else {
      if (user.status && user.status !== "active") {
        return {
          success: false,
          error: "账号已被禁用",
        };
      }

      await usersCollection.doc(user._id).update({
        email: user.email || syntheticEmail,
        last_login_at: now,
        last_login_ip: options?.ipAddress,
        login_count: (user.login_count || 0) + 1,
        phone: user.phone || normalizedPhone,
        updatedAt: now,
        updated_at: now,
      });

      const refreshedUserResult = await usersCollection.doc(user._id).get();
      user = refreshedUserResult.data?.[0] || {
        ...user,
        email: user.email || syntheticEmail,
        last_login_at: now,
        last_login_ip: options?.ipAddress,
        login_count: (user.login_count || 0) + 1,
        phone: user.phone || normalizedPhone,
        updatedAt: now,
        updated_at: now,
      };
    }

    const userId = user._id;
    const email = user.email || syntheticEmail;
    const accessToken = signJwt(
      {
        userId,
        email,
        phone: normalizedPhone,
        region: "CN",
      },
      { expiresIn: "1h" }
    );

    const refreshTokenRecord = await createRefreshToken({
      userId,
      email,
      deviceInfo: options?.deviceInfo || "phone-login",
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });

    if (!refreshTokenRecord) {
      return {
        success: false,
        error: "无法生成 refresh token",
      };
    }

    return {
      success: true,
      userId,
      email,
      phone: normalizedPhone,
      name: user.name,
      accessToken,
      refreshToken: refreshTokenRecord.refreshToken,
      tokenMeta: {
        accessTokenExpiresIn: 3600,
        refreshTokenExpiresIn: 604800,
      },
    };
  } catch (error: any) {
    console.error(" [CloudBase Service] 手机号登录失败:", error);
    return {
      success: false,
      error: error.message || "手机号登录失败",
    };
  }
}

function normalizeWechatDisplayName(
  nickName: string | undefined,
  openid: string,
) {
  const normalized = String(nickName || "").trim();
  if (normalized) {
    return normalized.slice(0, 50);
  }
  return `微信用户${openid.slice(-6)}`;
}

export async function loginOrCreateWechatMiniUser(
  openid: string,
  options?: {
    unionid?: string;
    nickName?: string;
    avatarUrl?: string;
    deviceInfo?: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<{
  success: boolean;
  userId?: string;
  email?: string;
  phone?: string;
  name?: string;
  avatarUrl?: string;
  openid?: string;
  unionid?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenMeta?: { accessTokenExpiresIn: number; refreshTokenExpiresIn: number };
  error?: string;
}> {
  try {
    const normalizedOpenId = normalizeLoginIdentifier(openid);
    const normalizedUnionId = normalizeLoginIdentifier(options?.unionid || "");

    if (!normalizedOpenId) {
      return {
        success: false,
        error: "微信登录凭证无效",
      };
    }

    const app = initCloudBase();
    const db = app.database();
    const usersCollection = db.collection("web_users");
    const now = new Date().toISOString();
    const syntheticEmail = `wechat_${normalizedOpenId}@local.wechat`;
    const normalizedName = normalizeWechatDisplayName(
      options?.nickName,
      normalizedOpenId,
    );
    const normalizedAvatar = String(options?.avatarUrl || "").trim();

    let user: any | undefined;

    if (normalizedUnionId) {
      const byUnionId = await usersCollection
        .where({ wechat_unionid: normalizedUnionId })
        .limit(1)
        .get();
      user = byUnionId.data?.[0];
    }

    if (!user) {
      const byOpenId = await usersCollection
        .where({ wechat_openid: normalizedOpenId })
        .limit(1)
        .get();
      user = byOpenId.data?.[0];
    }

    if (!user) {
      const bySyntheticEmail = await usersCollection
        .where({ email: syntheticEmail })
        .limit(1)
        .get();
      user = bySyntheticEmail.data?.[0];
    }

    if (!user) {
      const created = await usersCollection.add({
        email: syntheticEmail,
        password: await bcrypt.hash(crypto.randomUUID(), 10),
        name: normalizedName,
        avatar: normalizedAvatar || "",
        avatar_url: normalizedAvatar || "",
        provider: "wechat",
        provider_id: normalizedOpenId,
        wechat_openid: normalizedOpenId,
        wechat_unionid: normalizedUnionId || null,
        status: "active",
        pro: false,
        subscription_plan: "free",
        subscription_status: "inactive",
        region: "china",
        login_count: 1,
        last_login_at: now,
        last_login_ip: options?.ipAddress,
        createdAt: now,
        updatedAt: now,
        created_at: now,
        updated_at: now,
      });

      const createdUserResult = await usersCollection.doc(created.id).get();
      user = createdUserResult.data?.[0] || {
        _id: created.id,
        email: syntheticEmail,
        name: normalizedName,
        avatar: normalizedAvatar || "",
        avatar_url: normalizedAvatar || "",
        provider: "wechat",
        provider_id: normalizedOpenId,
        wechat_openid: normalizedOpenId,
        wechat_unionid: normalizedUnionId || null,
      };
    } else {
      if (user.status && user.status !== "active") {
        return {
          success: false,
          error: "账号已被禁用",
        };
      }

      const nextName =
        String(options?.nickName || "").trim() ||
        String(user.name || user.full_name || "").trim() ||
        normalizedName;
      const nextAvatar =
        normalizedAvatar ||
        String(user.avatar || user.avatar_url || "").trim();

      await usersCollection.doc(user._id).update({
        email: user.email || syntheticEmail,
        name: nextName,
        avatar: nextAvatar,
        avatar_url: nextAvatar,
        provider: user.provider || "wechat",
        provider_id: user.provider_id || normalizedOpenId,
        wechat_openid: normalizedOpenId,
        wechat_unionid: normalizedUnionId || user.wechat_unionid || null,
        last_login_at: now,
        last_login_ip: options?.ipAddress,
        login_count: (user.login_count || 0) + 1,
        updatedAt: now,
        updated_at: now,
      });

      const refreshedUserResult = await usersCollection.doc(user._id).get();
      user = refreshedUserResult.data?.[0] || {
        ...user,
        email: user.email || syntheticEmail,
        name: nextName,
        avatar: nextAvatar,
        avatar_url: nextAvatar,
        provider: user.provider || "wechat",
        provider_id: user.provider_id || normalizedOpenId,
        wechat_openid: normalizedOpenId,
        wechat_unionid: normalizedUnionId || user.wechat_unionid || null,
        last_login_at: now,
        last_login_ip: options?.ipAddress,
        login_count: (user.login_count || 0) + 1,
        updatedAt: now,
        updated_at: now,
      };
    }

    const userId = user._id;
    const email = user.email || syntheticEmail;
    const accessToken = signJwt(
      {
        userId,
        email,
        openid: normalizedOpenId,
        unionid: normalizedUnionId || undefined,
        provider: "wechat-mini",
        region: "CN",
      },
      { expiresIn: "1h" },
    );

    const refreshTokenRecord = await createRefreshToken({
      userId,
      email,
      deviceInfo: options?.deviceInfo || "wechat-mini-login",
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });

    if (!refreshTokenRecord) {
      return {
        success: false,
        error: "无法生成 refresh token",
      };
    }

    return {
      success: true,
      userId,
      email,
      name: user.name || normalizedName,
      avatarUrl: user.avatar || user.avatar_url || normalizedAvatar,
      openid: normalizedOpenId,
      unionid: normalizedUnionId || user.wechat_unionid || undefined,
      accessToken,
      refreshToken: refreshTokenRecord.refreshToken,
      tokenMeta: {
        accessTokenExpiresIn: 3600,
        refreshTokenExpiresIn: 604800,
      },
    };
  } catch (error: any) {
    console.error(" [CloudBase Service] 微信小程序登录失败:", error);
    return {
      success: false,
      error: error.message || "微信小程序登录失败",
    };
  }
}

export function getCloudBaseApp() {
  return initCloudBase();
}

export async function uploadFileToCloudBase(
  cloudPath: string,
  fileContent: Buffer
): Promise<{ fileID: string }> {
  const app: any = initCloudBase();
  const result = await app.uploadFile({
    cloudPath,
    fileContent,
  });

  const fileID =
    result?.fileID ||
    result?.fileId ||
    result?.fileIDList?.[0] ||
    result?.fileList?.[0];

  if (!fileID || typeof fileID !== "string") {
    throw new Error("CloudBase upload succeeded but no fileID was returned");
  }

  return { fileID };
}

export async function deleteFileFromCloudBase(fileList: string[]) {
  if (!fileList.length) {
    return;
  }

  const app: any = initCloudBase();
  await app.deleteFile({
    fileList,
  });
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const userId = extractUserIdFromToken(token);
    return !!userId;
  } catch (error) {
    console.error(" [CloudBase Service] Token 验证失败:", error);
    return false;
  }
}

/**
 * 从 CloudBase 下载文件
 * @param fileID CloudBase 文件 ID (格式: cloud://bucket/path/to/file)
 * @returns 文件内容的 Buffer
 * @throws 如果文件不存在、权限不足、网络错误等会抛出异常
 */
export async function downloadFileFromCloudBase(fileID: string): Promise<Buffer> {
  try {
    console.log(" [CloudBase Service] 开始下载文件，fileID:", fileID);

    const app = initCloudBase();

    // 验证 CloudBase 初始化
    if (!app) {
      throw new Error('CloudBase 初始化失败，请检查环境变量 NEXT_PUBLIC_WECHAT_CLOUDBASE_ID, CLOUDBASE_SECRET_ID, CLOUDBASE_SECRET_KEY');
    }

    const res = await app.downloadFile({
      fileID: fileID,
    });

    if (!res || !res.fileContent) {
      throw new Error(`文件内容为空，fileID: ${fileID}（可能文件不存在或权限不足）`);
    }

    console.log(" [CloudBase Service] 文件下载成功，大小:", res.fileContent.length, 'bytes');
    return res.fileContent;
  } catch (error: any) {
    const errorMessage = error.message || error.toString();
    console.error(" [CloudBase Service] 文件下载失败:", errorMessage);

    // 根据错误类型提供更详细的错误信息
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      throw new Error(`文件不存在: ${fileID}`);
    } else if (errorMessage.includes('403') || errorMessage.includes('permission') || errorMessage.includes('Forbidden')) {
      throw new Error(`无权限访问文件: ${fileID}`);
    } else if (errorMessage.includes('timeout')) {
      throw new Error(`文件下载超时，请检查网络或 CloudBase 服务状态`);
    } else if (errorMessage.includes('CloudBase 初始化失败')) {
      throw error;
    } else {
      throw new Error(`文件下载失败: ${errorMessage}`);
    }
  }
}
