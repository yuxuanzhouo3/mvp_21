import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuthToken, extractTokenFromHeader } from "@/lib/auth/auth-utils";

// 创建 Supabase 管理员客户端
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get("authorization");
    const { token, error: tokenError } = extractTokenFromHeader(authHeader);

    if (tokenError || !token) {
      return NextResponse.json(
        { error: tokenError || "Unauthorized" },
        { status: 401 },
      );
    }

    const authResult = await verifyAuthToken(token);
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        { error: authResult.error || "Invalid token" },
        { status: 401 },
      );
    }

    const userId = authResult.userId;
    const body = await request.json();

    const {
      companyName,
      creditCode,
      legalPerson,
      address,
      contactPerson,
      contactPhone,
      contactEmail,
    } = body;

    // 验证必填字段
    if (!companyName || !creditCode || !legalPerson || !address) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    // 检查是否已存在企业信息
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("company_profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 是 "没有找到记录" 的错误码
      console.error("检查企业信息失败:", checkError);
      return NextResponse.json({ error: "检查企业信息失败" }, { status: 500 });
    }

    // 如果已存在则更新，否则插入
    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from("company_profiles")
        .update({
          company_name: companyName,
          credit_code: creditCode,
          legal_person: legalPerson,
          address,
          contact_person: contactPerson,
          contact_phone: contactPhone,
          contact_email: contactEmail,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("更新企业信息失败:", updateError);
        return NextResponse.json(
          { error: "更新企业信息失败" },
          { status: 500 },
        );
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("company_profiles")
        .insert({
          user_id: userId,
          company_name: companyName,
          credit_code: creditCode,
          legal_person: legalPerson,
          address,
          contact_person: contactPerson,
          contact_phone: contactPhone,
          contact_email: contactEmail,
        });

      if (insertError) {
        console.error("保存企业信息失败:", insertError);
        return NextResponse.json(
          { error: "保存企业信息失败" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/company-info POST] 异常:", error);
    return NextResponse.json({ error: "保存企业信息失败" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get("authorization");
    const { token, error: tokenError } = extractTokenFromHeader(authHeader);

    if (tokenError || !token) {
      return NextResponse.json(
        { error: tokenError || "Unauthorized" },
        { status: 401 },
      );
    }

    const authResult = await verifyAuthToken(token);
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        { error: authResult.error || "Invalid token" },
        { status: 401 },
      );
    }

    const userId = authResult.userId;

    // 查询企业信息
    const { data, error } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // 没有找到记录
        return NextResponse.json({ hasCompanyInfo: false });
      }
      console.error("查询企业信息失败:", error);
      return NextResponse.json({ error: "查询企业信息失败" }, { status: 500 });
    }

    return NextResponse.json({
      hasCompanyInfo: true,
      ...data,
    });
  } catch (error) {
    console.error("[/api/company-info GET] 异常:", error);
    return NextResponse.json({ error: "查询企业信息失败" }, { status: 500 });
  }
}
