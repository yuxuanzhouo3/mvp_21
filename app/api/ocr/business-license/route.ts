import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken, extractTokenFromHeader } from "@/lib/auth/auth-utils";

/**
 * 营业执照 OCR 识别接口
 * 使用阿里云通义千问多模态模型识别营业执照信息
 */
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

    const body = await request.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "缺少图片数据" }, { status: 400 });
    }

    // 调用阿里云通义千问多模态模型
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OCR 服务未配置" }, { status: 500 });
    }

    console.log("🔍 [OCR] 开始识别营业执照...");

    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "qwen-vl-plus",
          input: {
            messages: [
              {
                role: "user",
                content: [
                  {
                    image: imageBase64,
                  },
                  {
                    text: `请识别这张营业执照图片，提取以下信息：
1. 公司名称
2. 统一社会信用代码
3. 法定代表人
4. 注册地址

请以 JSON 格式返回，格式如下：
{
  "companyName": "公司名称",
  "creditCode": "统一社会信用代码",
  "legalPerson": "法定代表人",
  "address": "注册地址"
}

只返回 JSON，不要其他文字说明。`,
                  },
                ],
              },
            ],
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ [OCR] API 调用失败:", errorText);
      return NextResponse.json(
        { error: "OCR 识别失败，请重试" },
        { status: 500 },
      );
    }

    const result = await response.json();
    console.log("✅ [OCR] API 响应:", result);

    // 同步模式，直接使用返回结果，不需要轮询

    // 提取识别结果
    const content = result.output?.choices?.[0]?.message?.content?.[0]?.text;
    if (!content) {
      console.error("❌ [OCR] 无法提取识别结果");
      return NextResponse.json(
        { error: "OCR 识别失败，未能提取信息" },
        { status: 500 },
      );
    }

    console.log("📝 [OCR] 识别结果:", content);

    // 解析 JSON 结果
    try {
      // 尝试提取 JSON（可能包含在代码块中）
      let jsonStr = content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const companyInfo = JSON.parse(jsonStr);

      return NextResponse.json({
        success: true,
        data: {
          companyName: companyInfo.companyName || "",
          creditCode: companyInfo.creditCode || "",
          legalPerson: companyInfo.legalPerson || "",
          address: companyInfo.address || "",
        },
      });
    } catch (parseError) {
      console.error("❌ [OCR] JSON 解析失败:", parseError);
      console.error("原始内容:", content);

      // 如果 JSON 解析失败，尝试使用正则提取
      const companyNameMatch = content.match(
        /公司名称[：:]\s*["']?([^"'\n]+)["']?/,
      );
      const creditCodeMatch = content.match(
        /统一社会信用代码[：:]\s*["']?([^"'\n]+)["']?/,
      );
      const legalPersonMatch = content.match(
        /法定代表人[：:]\s*["']?([^"'\n]+)["']?/,
      );
      const addressMatch = content.match(
        /注册地址[：:]\s*["']?([^"'\n]+)["']?/,
      );

      return NextResponse.json({
        success: true,
        data: {
          companyName: companyNameMatch?.[1]?.trim() || "",
          creditCode: creditCodeMatch?.[1]?.trim() || "",
          legalPerson: legalPersonMatch?.[1]?.trim() || "",
          address: addressMatch?.[1]?.trim() || "",
        },
      });
    }
  } catch (error) {
    console.error("❌ [OCR] 异常:", error);
    return NextResponse.json({ error: "OCR 识别失败" }, { status: 500 });
  }
}
