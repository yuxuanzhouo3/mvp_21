import { BUSINESS_CONTRACT_EXPERT, type ExpertRole } from "./experts";

export type PromptLanguage = "zh" | "en";

const CONTRACT_TYPE_VALUES = "labor|service|cooperation|nda|freelance|tech|software|custom";

function isChinese(language: PromptLanguage) {
  return language === "zh";
}

export function generatePreAnalyzePrompt(
  conversation: string,
  language: PromptLanguage,
): string {
  if (isChinese(language)) {
    return `请快速判断下面这段对话最可能对应的合同场景与合同类型。

对话内容：
${conversation}

输出要求：
1. 识别最可能的场景。
2. 识别最可能的合同类型。
3. 识别甲乙双方的角色。
4. 如果是软件开发、外包、系统建设、交付、验收、里程碑付款、源码或部署文档场景，优先判断为 service、tech 或 cooperation，而不是 labor。
5. 只返回 JSON。

JSON Schema:
{
  "scenario": "场景描述",
  "contractType": "${CONTRACT_TYPE_VALUES}",
  "partyARole": "甲方角色",
  "partyBRole": "乙方角色",
  "keyIssues": ["关键问题1", "关键问题2"]
}`;
  }

  return `Quickly classify the likely contract scenario and contract type for the conversation below.

Conversation:
${conversation}

Requirements:
1. Identify the most likely scenario.
2. Identify the most likely contract type.
3. Identify Party A and Party B roles.
4. If this is about outsourcing, software development, implementation, delivery, acceptance, milestones, source code, or deployment documentation, prefer service, tech, or cooperation instead of labor.
5. Return JSON only.

JSON Schema:
{
  "scenario": "scenario summary",
  "contractType": "${CONTRACT_TYPE_VALUES}",
  "partyARole": "role of party A",
  "partyBRole": "role of party B",
  "keyIssues": ["issue 1", "issue 2"]
}`;
}

export function generatePreAnalyzeSystemPrompt(language: PromptLanguage): string {
  return isChinese(language)
    ? "你是一名资深合同分析律师。请根据用户对话准确判断合同类型，只输出合法 JSON。"
    : "You are a senior contracts lawyer. Classify the likely contract type from the conversation and return valid JSON only.";
}

export function generateAnalyzePrompt(
  expert: ExpertRole,
  conversation: string,
  language: PromptLanguage,
): string {
  if (isChinese(language)) {
    return `请以 ${expert.name}（${expert.title}）的专业视角分析下面的合同相关对话，并提取可用于生成合同草稿的结构化信息。

专家特点：${expert.personality}
专业方向：${expert.expertise.join("、")}
关注重点：${expert.industryKnowledge}
最佳实践：
${expert.bestPractices.map((item) => `- ${item}`).join("\n")}
常见风险：
${expert.commonPitfalls.map((item) => `- ${item}`).join("\n")}
法律依据：
${expert.legalBasis.map((item) => `- ${item}`).join("\n")}

对话内容：
${conversation}

分析要求：
1. 所有面向用户展示的文本字段必须使用简体中文。
2. 只提取对话中已经明确出现或可以高度确定的信息，不要臆造事实。
3. 如果信息不足，请放入 missingInfo，而不是虚构。
4. keyTerms 的 source 应尽量保留原始表述。
5. 如果是国内软件开发、外包、实施、交付类项目，优先识别为服务/技术开发类合同。
6. 返回 JSON，不要使用 Markdown。

JSON Schema:
{
  "contractType": "${CONTRACT_TYPE_VALUES}",
  "confidence": 0.0,
  "partyA": {
    "name": "甲方名称",
    "role": "甲方角色",
    "company": "甲方公司",
    "position": "甲方职位",
    "contact": "联系方式",
    "identified": true
  },
  "partyB": {
    "name": "乙方名称",
    "role": "乙方角色",
    "company": "乙方公司",
    "position": "乙方职位",
    "contact": "联系方式",
    "identified": true
  },
  "keyTerms": [
    {
      "type": "payment",
      "label": "合同总价",
      "value": "人民币 80000 元",
      "source": "合同总价 80000 元",
      "confidence": 0.95,
      "riskLevel": "low",
      "riskNote": "",
      "suggestion": ""
    }
  ],
  "riskAlerts": [
    {
      "severity": "medium",
      "issue": "缺少验收标准",
      "impact": "可能影响付款与交付争议处理",
      "suggestion": "建议补充明确的验收标准和验收期限"
    }
  ],
  "missingInfo": [
    {
      "item": "验收流程",
      "importance": "medium",
      "defaultSuggestion": "约定收到交付物后 5-7 日内完成验收"
    }
  ],
  "professionalAdvice": ["建议 1", "建议 2"],
  "suggestedTemplate": "推荐合同模板",
  "summary": "当前已识别的合同事实摘要",
  "scenario": {
    "type": "场景类型",
    "description": "场景描述",
    "negotiationStatus": "初步沟通/已基本达成一致",
    "powerBalance": "平衡/甲方主导/乙方主导"
  },
  "expertAnalysis": {
    "expertName": "${expert.name}",
    "expertTitle": "${expert.title}",
    "analysisDate": "${new Date().toISOString()}",
    "overallAssessment": "一句话总结"
  }
}`;
  }

  return `Analyze the contract-related conversation below from the perspective of ${expert.name} (${expert.title}) and extract structured information that can be used to draft a contract.

Expert profile: ${expert.personality}
Expertise: ${expert.expertise.join(", ")}
Focus areas: ${expert.industryKnowledge}
Best practices:
${expert.bestPractices.map((item) => `- ${item}`).join("\n")}
Common pitfalls:
${expert.commonPitfalls.map((item) => `- ${item}`).join("\n")}
Legal basis:
${expert.legalBasis.map((item) => `- ${item}`).join("\n")}

Conversation:
${conversation}

Requirements:
1. All user-facing string fields must be written in English.
2. Only extract facts that are explicit or strongly supported by the conversation.
3. If information is missing, put it in missingInfo instead of inventing it.
4. Preserve original wording in keyTerms.source when possible.
5. If the conversation describes software outsourcing, implementation, delivery, acceptance, milestones, source code, or deployment docs, prefer service/tech/cooperation rather than labor.
6. Return JSON only, without markdown.

JSON Schema:
{
  "contractType": "${CONTRACT_TYPE_VALUES}",
  "confidence": 0.0,
  "partyA": {
    "name": "Party A name",
    "role": "Party A role",
    "company": "Party A company",
    "position": "Party A position",
    "contact": "contact details",
    "identified": true
  },
  "partyB": {
    "name": "Party B name",
    "role": "Party B role",
    "company": "Party B company",
    "position": "Party B position",
    "contact": "contact details",
    "identified": true
  },
  "keyTerms": [
    {
      "type": "payment",
      "label": "Total contract price",
      "value": "CNY 80,000",
      "source": "total price 80,000 CNY",
      "confidence": 0.95,
      "riskLevel": "low",
      "riskNote": "",
      "suggestion": ""
    }
  ],
  "riskAlerts": [
    {
      "severity": "medium",
      "issue": "Acceptance criteria are missing",
      "impact": "This may create delivery and payment disputes",
      "suggestion": "Add clear acceptance standards and review timing"
    }
  ],
  "missingInfo": [
    {
      "item": "Acceptance workflow",
      "importance": "medium",
      "defaultSuggestion": "State that review must finish within 5-7 days after delivery"
    }
  ],
  "professionalAdvice": ["Advice 1", "Advice 2"],
  "suggestedTemplate": "Recommended template",
  "summary": "Short factual summary of the contract context",
  "scenario": {
    "type": "scenario type",
    "description": "scenario description",
    "negotiationStatus": "early discussion / near agreement",
    "powerBalance": "balanced / party A led / party B led"
  },
  "expertAnalysis": {
    "expertName": "${expert.name}",
    "expertTitle": "${expert.title}",
    "analysisDate": "${new Date().toISOString()}",
    "overallAssessment": "one-line assessment"
  }
}`;
}

export function generateAnalyzeSystemPrompt(
  expert: ExpertRole,
  language: PromptLanguage,
): string {
  return isChinese(language)
    ? `你是 ${expert.name}（${expert.title}）。请提供严谨、可执行、适合生成合同草稿的结构化分析。输出必须是合法 JSON。`
    : `You are ${expert.name} (${expert.title}). Provide rigorous, practical structured analysis suitable for drafting a contract. Output must be valid JSON.`;
}

export const PRE_ANALYZE_PROMPT = generatePreAnalyzePrompt("{conversation}", "zh");
export const ANALYZE_CONVERSATION_PROMPT = generateAnalyzePrompt(
  BUSINESS_CONTRACT_EXPERT,
  "{conversation}",
  "zh",
);
export const ANALYZE_CONVERSATION_SYSTEM = generateAnalyzeSystemPrompt(
  BUSINESS_CONTRACT_EXPERT,
  "zh",
);
