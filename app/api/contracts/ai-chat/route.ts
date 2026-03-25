import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken, extractTokenFromHeader } from "@/lib/auth/auth-utils";

/**
 * AI 对话生成合同 API
 * 通过多轮对话收集信息，最终生成劳动合同
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
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "缺少对话历史" }, { status: 400 });
    }

    // 调用通义千问 API
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI 服务未配置" }, { status: 500 });
    }

    console.log("🤖 [AI Chat] 开始生成回复...");

    // 系统提示词
    const systemPrompt = `你是一个专业的劳动合同生成助手。你的任务是通过友好的对话，收集生成劳动合同所需的信息。

你需要收集以下信息：
1. 岗位名称（已在第一条消息中询问）
2. 员工姓名
3. 员工身份证号
4. 工作地点
5. 合同期限（如：3年）
6. 试用期（如：3个月）
7. 月薪（如：15000元）
8. 工作内容描述

收集信息的原则：
- 一次只问1-2个问题，不要一次问太多
- 语气要轻松友好，像朋友聊天
- 根据岗位性质，主动建议是否需要竞业限制、保密协议等条款
- 当收集完所有信息后，告诉用户"信息已收集完成，正在生成合同..."

当所有信息收集完成后，以 JSON 格式输出合同内容，格式如下：
\`\`\`json
{
  "contractGenerated": true,
  "contractData": {
    "position": "岗位",
    "employeeName": "员工姓名",
    "employeeId": "身份证号",
    "workLocation": "工作地点",
    "contractPeriod": "合同期限",
    "probationPeriod": "试用期",
    "salary": "月薪",
    "jobDescription": "工作内容"
  }
}
\`\`\`

在收集信息的过程中，只返回普通文本回复，不要返回 JSON。`;

    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "qwen-plus",
          input: {
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              ...messages,
            ],
          },
          parameters: {
            temperature: 0.7,
            top_p: 0.8,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ [AI Chat] API 调用失败:", errorText);
      return NextResponse.json({ error: "AI 服务调用失败" }, { status: 500 });
    }

    const result = await response.json();
    const aiReply =
      result.output?.text || result.output?.choices?.[0]?.message?.content;

    if (!aiReply) {
      console.error("❌ [AI Chat] 无法提取 AI 回复");
      return NextResponse.json({ error: "AI 回复生成失败" }, { status: 500 });
    }

    console.log("✅ [AI Chat] AI 回复:", aiReply);

    // 检查是否生成了合同
    let contractGenerated = false;
    let contractContent = "";
    let contractData = null;

    // 尝试从回复中提取 JSON
    const jsonMatch = aiReply.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data.contractGenerated && data.contractData) {
          contractGenerated = true;
          contractData = data.contractData;

          // 生成合同内容
          contractContent = generateContractText(contractData);
          console.log("📄 [AI Chat] 合同已生成");
        }
      } catch (parseError) {
        console.warn("⚠️  [AI Chat] JSON 解析失败，继续对话");
      }
    }

    return NextResponse.json({
      reply: contractGenerated
        ? "信息已收集完成！正在为您生成合同... ✨"
        : aiReply,
      contractGenerated,
      contractContent,
      contractData,
    });
  } catch (error) {
    console.error("❌ [AI Chat] 异常:", error);
    return NextResponse.json({ error: "AI 服务异常" }, { status: 500 });
  }
}

// 生成合同文本
function generateContractText(data: any): string {
  return `
劳动合同

甲方（用人单位）：[公司名称]
统一社会信用代码：[信用代码]
法定代表人：[法定代表人]
地址：[公司地址]

乙方（员工）：${data.employeeName}
身份证号：${data.employeeId}

根据《中华人民共和国劳动合同法》及相关法律法规，甲乙双方在平等自愿、协商一致的基础上，订立本合同。

第一条 合同期限
本合同为固定期限劳动合同，期限为${data.contractPeriod}，自____年__月__日起至____年__月__日止。

第二条 试用期
本合同试用期为${data.probationPeriod}，自____年__月__日起至____年__月__日止。

第三条 工作岗位
甲方安排乙方在${data.workLocation}从事${data.position}工作。
工作内容：${data.jobDescription}

第四条 劳动报酬
1. 乙方月工资为人民币${data.salary}元（税前）
2. 工资发放时间：每月__日
3. 试用期工资按正式工资的80%执行

第五条 工作时间和休息休假
1. 实行标准工时制，每日工作8小时，每周工作5天
2. 乙方享有国家法定节假日、年休假等休假

第六条 社会保险
甲方依法为乙方缴纳养老保险、医疗保险、失业保险、工伤保险和生育保险。

第七条 劳动保护和工作条件
甲方根据国家有关规定，为乙方提供必要的劳动保护和工作条件。

第八条 保密义务
乙方应对在工作中知悉的甲方商业秘密和技术秘密承担保密义务。

第九条 合同的变更、解除和终止
按照《中华人民共和国劳动合同法》的相关规定执行。

第十条 争议处理
因履行本合同发生的劳动争议，由双方协商解决；协商不成的，可向劳动争议仲裁委员会申请仲裁。

第十一条 其他约定
[其他需要约定的事项]

本合同一式两份，甲乙双方各执一份，具有同等法律效力。

甲方（盖章）：              乙方（签字）：
法定代表人（签字）：
签订日期：____年__月__日     签订日期：____年__月__日

---
✨ 本合同由 ContractHub AI 智能生成
`;
}
