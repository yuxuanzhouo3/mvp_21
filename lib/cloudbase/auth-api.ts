import type { NextApiRequest, NextApiResponse } from "next";
import cloudbase from "@cloudbase/node-sdk";
import bcrypt from "bcryptjs";

import { signJwt } from "@/lib/auth/jwt";

type AuthAction = "signup" | "login" | "refresh";

interface ApiSuccessPayload {
  success: true;
  message: string;
  user?: {
    id: string;
    userId: string;
    email: string;
    name: string;
    pro: boolean;
    region: "china";
  };
  token?: string;
  expiresIn?: string;
}

interface ApiErrorPayload {
  success: false;
  message: string;
}

const isDev = process.env.NODE_ENV !== "production";

function debugLog(message: string, meta?: Record<string, unknown>) {
  if (!isDev) {
    return;
  }
  if (meta) {
    console.log(message, meta);
    return;
  }
  console.log(message);
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) {
    return "unknown";
  }
  return `${name.slice(0, 2)}***@${domain}`;
}

function createCloudbaseDb() {
  const app = cloudbase.init({
    env: process.env.TENCENT_ENV_ID || process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    secretId: process.env.TENCENT_SECRET_ID || process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY || process.env.CLOUDBASE_SECRET_KEY,
  });
  return app.database();
}

function getExpiryByPlan(pro: unknown): "30d" | "90d" {
  return pro ? "90d" : "30d";
}

function resolveDocData(docResult: any): any | null {
  if (Array.isArray(docResult?.data)) {
    return docResult.data[0] ?? null;
  }
  return docResult?.data ?? null;
}

export default async function authCnHandler(
  req: NextApiRequest,
  res: NextApiResponse<ApiSuccessPayload | ApiErrorPayload>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const { email, password, action = "signup", userId } = req.body as {
      email?: string;
      password?: string;
      action?: AuthAction;
      userId?: string;
    };

    if (action === "refresh") {
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "Missing userId",
        });
      }

      const db = createCloudbaseDb();
      const docResult = await db.collection("web_users").doc(userId).get();
      const user = resolveDocData(docResult);

      if (!user?._id || !user?.email) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const expiresIn = getExpiryByPlan(user.pro);
      const token = signJwt(
        { userId: user._id, email: user.email, region: "china" },
        { expiresIn },
      );

      debugLog("[CloudBase Auth API] Token refreshed", {
        userId: user._id,
        email: maskEmail(user.email),
        expiresIn,
      });

      return res.status(200).json({
        success: true,
        message: "Token refreshed",
        token,
        expiresIn,
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const db = createCloudbaseDb();
    const usersCollection = db.collection("web_users");

    if (action === "signup") {
      const existingUserResult = await usersCollection.where({ email }).get();
      if (existingUserResult.data && existingUserResult.data.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Email already registered",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const now = new Date().toISOString();
      const newUser = {
        email,
        password: hashedPassword,
        name: email.includes("@") ? email.split("@")[0] : email,
        pro: false,
        region: "china" as const,
        createdAt: now,
        updatedAt: now,
      };

      const result = await usersCollection.add(newUser);
      const createdUserId = String(result?.id || "");
      if (!createdUserId) {
        throw new Error("CloudBase did not return a valid user id");
      }
      const expiresIn = getExpiryByPlan(newUser.pro);
      const token = signJwt(
        {
          userId: createdUserId,
          email,
          region: "china",
        },
        { expiresIn },
      );

      debugLog("[CloudBase Auth API] Signup succeeded", {
        userId: createdUserId,
        email: maskEmail(email),
      });

      return res.status(200).json({
        success: true,
        message: "Signup successful",
        user: {
          id: createdUserId,
          userId: createdUserId,
          email,
          name: newUser.name,
          pro: false,
          region: "china",
        },
        token,
      });
    }

    if (action === "login") {
      const userResult = await usersCollection.where({ email }).get();
      const user = userResult.data?.[0];

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      const expiresIn = getExpiryByPlan(user.pro);
      const token = signJwt(
        {
          userId: user._id,
          email: user.email,
          region: "china",
        },
        { expiresIn },
      );

      debugLog("[CloudBase Auth API] Login succeeded", {
        userId: user._id,
        email: maskEmail(user.email),
      });

      return res.status(200).json({
        success: true,
        message: "Login successful",
        user: {
          id: user._id,
          userId: user._id,
          email: user.email,
          name: user.name,
          pro: !!user.pro,
          region: "china",
        },
        token,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid action, expected signup/login/refresh",
    });
  } catch (error: any) {
    console.error("[CloudBase Auth API] Error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
}
