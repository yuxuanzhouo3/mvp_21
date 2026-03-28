import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/integrations/supabase";
import { passwordSecurity } from "@/lib/security/password-security";
import { logSecurityEvent } from "@/lib/utils/logger";
import { isChinaRegion } from "@/lib/config/region";

const registerSchema = z
  .object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    fullName: z
      .string()
      .min(1, "Full name is required")
      .max(100, "Full name too long"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      logSecurityEvent("register_validation_failed", undefined, clientIP, {
        errors: validationResult.error.errors,
        email: body.email,
      });

      return NextResponse.json(
        {
          error: "Invalid input",
          code: "VALIDATION_ERROR",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { email, password, fullName } = validationResult.data;

    let passwordValidation: {
      isValid: boolean;
      score: number;
      feedback: string[];
      suggestions: string[];
    } = {
      isValid: true,
      score: 0,
      feedback: [],
      suggestions: [],
    };

    if (!isChinaRegion()) {
      passwordValidation = passwordSecurity.validatePassword(password);
      if (!passwordValidation.isValid) {
        logSecurityEvent("register_weak_password", undefined, clientIP, {
          email,
          score: passwordValidation.score,
          feedback: passwordValidation.feedback,
        });

        return NextResponse.json(
          {
            error: "Password does not meet security requirements",
            code: "WEAK_PASSWORD",
            passwordStrength: {
              score: passwordValidation.score,
              isValid: passwordValidation.isValid,
              feedback: passwordValidation.feedback,
              suggestions: passwordValidation.suggestions,
            },
          },
          { status: 400 },
        );
      }
    }

    let authResponse:
      | {
          user: {
            id: string;
            email?: string | null;
            name: string;
            avatar?: string | null;
          };
        }
      | undefined;

    if (isChinaRegion()) {
      const internalBaseUrl =
        process.env.APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        request.nextUrl.origin ||
        "http://localhost:3000";

      const response = await fetch(`${internalBaseUrl}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signup", email, password }),
      });

      const data = await response.json();
      if (data.success && data.user) {
        authResponse = {
          user: {
            id: data.user.id || data.user.userId,
            email: data.user.email,
            name: data.user.name || fullName,
            avatar: data.user.avatar,
          },
        };
      } else {
        if (
          data.message &&
          (data.message.includes("已存在") || data.message.includes("exists"))
        ) {
          return NextResponse.json(
            {
              error: "Email already registered",
              code: "EMAIL_EXISTS",
            },
            { status: 409 },
          );
        }

        return NextResponse.json(
          {
            error: "Registration failed",
            code: "REGISTRATION_ERROR",
            details: data.message || "注册失败",
          },
          { status: 400 },
        );
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullName,
            full_name: fullName,
            displayName: fullName,
          },
        },
      });

      if (error) {
        logSecurityEvent("register_failed", undefined, clientIP, {
          email,
          error: error.message,
        });

        if (error.message.includes("already registered")) {
          return NextResponse.json(
            {
              error: "Email already registered",
              code: "EMAIL_EXISTS",
            },
            { status: 409 },
          );
        }

        return NextResponse.json(
          {
            error: "Registration failed",
            code: "REGISTRATION_ERROR",
            details: error.message,
          },
          { status: 400 },
        );
      }

      authResponse = {
        user: {
          id: data.user?.id || "",
          email: data.user?.email,
          name: fullName,
          avatar: data.user?.user_metadata?.avatar_url,
        },
      };
    }

    const userId = authResponse?.user.id;

    logSecurityEvent("register_successful", userId, clientIP, {
      email,
      userId,
      fullName,
      passwordStrength: passwordValidation.score,
      profileSaved: isChinaRegion(),
    });

    return NextResponse.json({
      success: true,
      user: {
        id: authResponse?.user.id,
        email: authResponse?.user.email,
        name: authResponse?.user.name || fullName,
        avatar: authResponse?.user.avatar,
      },
      message: "Registration successful. You can now log in.",
      region: isChinaRegion() ? "CN" : "INTL",
    });
  } catch (error) {
    console.error("Registration error:", error);
    logSecurityEvent(
      "register_error",
      undefined,
      request.headers.get("x-forwarded-for") || "unknown",
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    );

    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get("password");

    if (!password) {
      return NextResponse.json(
        { error: "Password parameter required" },
        { status: 400 },
      );
    }

    const validation = passwordSecurity.validatePassword(password);

    return NextResponse.json({
      password,
      strength: {
        score: validation.score,
        isValid: validation.isValid,
        feedback: validation.feedback,
        suggestions: validation.suggestions,
      },
    });
  } catch (error) {
    console.error("Password validation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
