import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  attachMarketAdminSessionCookie,
  createMarketAdminSessionToken,
  verifyMarketAdminLogin,
} from "@/lib/market/admin-auth"
import { resolveDeploymentRegion } from "@/lib/config/deployment-region"
import { assertSupabaseRuntimeEnv } from "@/lib/config/supabase-runtime"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const region = resolveDeploymentRegion()
    const isCn = region === "CN"
    const body = await request.json().catch(() => ({}))
    const username = String(body?.username || body?.email || body?.identifier || "").trim()
    const password = String(body?.password || "").trim()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: isCn ? "请输入账号和密码" : "Username and password are required" },
        { status: 400 },
      )
    }

    let loginName = username
    let isValid = verifyMarketAdminLogin({ username, password })

    if (!isValid && !isCn) {
      try {
        const env = assertSupabaseRuntimeEnv({ context: "market-auth-login-intl" })
        if (env.url && env.anonKey) {
          const supabase = createClient(env.url, env.anonKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
              detectSessionInUrl: false,
            },
          })
          const normalizedEmail = username.toLowerCase()
          const {
            data: { user, session },
            error,
          } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          })
          if (!error && user && session) {
            isValid = true
            loginName = user.email || normalizedEmail
          }
        }
      } catch {
        // Keep default invalid credentials behavior to avoid leaking internal config details.
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: isCn ? "账号或密码错误" : "Invalid credentials" },
        { status: 401 },
      )
    }

    const token = createMarketAdminSessionToken(loginName)
    const response = NextResponse.json({ success: true })
    attachMarketAdminSessionCookie(response, token)
    return response
  } catch (error: any) {
    const isCn = resolveDeploymentRegion() === "CN"
    return NextResponse.json(
      { success: false, error: error?.message || (isCn ? "登录失败，请稍后重试" : "Login failed") },
      { status: 500 },
    )
  }
}
