import type { ContractType } from "../types";
import type { ExpertRole } from "./experts";

export type PromptLanguage = "zh" | "en";

export const CONTRACT_TYPE_LABELS: Record<PromptLanguage, Record<string, string>> = {
  zh: {
    labor: "劳动合同",
    service: "服务合同",
    cooperation: "合作协议",
    nda: "保密协议",
    freelance: "劳务协议",
    tech: "技术开发合同",
    software: "软件开发合同",
    custom: "合同",
  },
  en: {
    labor: "Employment Contract",
    service: "Service Agreement",
    cooperation: "Cooperation Agreement",
    nda: "Non-Disclosure Agreement",
    freelance: "Freelance Agreement",
    tech: "Technology Development Agreement",
    software: "Software Development Agreement",
    custom: "Contract",
  },
};

export const CONTRACT_TYPE_NAMES: Record<string, string> = CONTRACT_TYPE_LABELS.zh;

const SECTION_GUIDANCE: Record<string, Record<PromptLanguage, string[]>> = {
  labor: {
    zh: [
      "合同双方信息",
      "合同期限与试用期",
      "岗位职责与工作地点",
      "工作时间、休息休假",
      "劳动报酬",
      "社会保险与福利",
      "保密与知识产权",
      "合同变更、解除与终止",
      "违约责任",
      "争议解决",
    ],
    en: [
      "Parties",
      "Term and probation",
      "Role and workplace",
      "Working hours and leave",
      "Compensation",
      "Social insurance and benefits",
      "Confidentiality and IP",
      "Amendment, termination, and exit",
      "Breach liability",
      "Dispute resolution",
    ],
  },
  tech: {
    zh: [
      "合同双方信息",
      "项目背景与目标",
      "服务范围与开发内容",
      "项目周期与里程碑",
      "交付成果",
      "验收标准与流程",
      "合同价款与支付安排",
      "知识产权与源码交付",
      "维护与技术支持",
      "保密与数据安全",
      "违约责任",
      "争议解决",
    ],
    en: [
      "Parties",
      "Project background and goals",
      "Scope of services and development work",
      "Timeline and milestones",
      "Deliverables",
      "Acceptance standards and process",
      "Fees and payment schedule",
      "IP ownership and source code delivery",
      "Maintenance and support",
      "Confidentiality and data security",
      "Breach liability",
      "Dispute resolution",
    ],
  },
  software: {
    zh: [
      "合同双方信息",
      "项目背景与目标",
      "服务范围与开发内容",
      "项目周期与里程碑",
      "交付成果",
      "验收标准与流程",
      "合同价款与支付安排",
      "知识产权与源码交付",
      "维护与技术支持",
      "保密与数据安全",
      "违约责任",
      "争议解决",
    ],
    en: [
      "Parties",
      "Project background and goals",
      "Scope of services and development work",
      "Timeline and milestones",
      "Deliverables",
      "Acceptance standards and process",
      "Fees and payment schedule",
      "IP ownership and source code delivery",
      "Maintenance and support",
      "Confidentiality and data security",
      "Breach liability",
      "Dispute resolution",
    ],
  },
  default: {
    zh: [
      "合同双方信息",
      "合作/服务内容",
      "期限安排",
      "价款与支付方式",
      "交付与验收",
      "双方权利义务",
      "保密条款",
      "违约责任",
      "争议解决",
      "其他约定",
    ],
    en: [
      "Parties",
      "Scope of cooperation or services",
      "Term",
      "Fees and payment method",
      "Delivery and acceptance",
      "Rights and obligations",
      "Confidentiality",
      "Breach liability",
      "Dispute resolution",
      "Miscellaneous",
    ],
  },
};

function isChinese(language: PromptLanguage) {
  return language === "zh";
}

function getSectionGuidance(contractType: string, language: PromptLanguage) {
  return (SECTION_GUIDANCE[contractType] || SECTION_GUIDANCE.default)[language];
}

export function getContractTypeDisplayName(
  contractType: string | undefined,
  language: PromptLanguage = "zh",
) {
  if (!contractType) {
    return language === "zh" ? "合同" : "Contract";
  }

  return (
    CONTRACT_TYPE_LABELS[language][contractType] ||
    CONTRACT_TYPE_LABELS[language].custom
  );
}

export function generateContractPrompt(
  expert: ExpertRole,
  analysisResult: string,
  contractType: string,
  language: PromptLanguage,
): string {
  const contractTypeName = getContractTypeDisplayName(contractType, language);
  const sections = getSectionGuidance(contractType, language);

  if (isChinese(language)) {
    return `请以 ${expert.name}（${expert.title}）的专业视角，根据下面的结构化分析结果生成一份可直接进入编辑页的《${contractTypeName}》草稿。

专家特点：${expert.personality}
专业方向：${expert.expertise.join("、")}
最佳实践：
${expert.bestPractices.map((item) => `- ${item}`).join("\n")}
常见风险：
${expert.commonPitfalls.map((item) => `- ${item}`).join("\n")}

分析结果：
${analysisResult}

生成要求：
1. 所有面向用户展示的文本必须使用简体中文。
2. 合同要专业、清晰、可执行，适合中国用户使用。
3. 不要虚构已确定的主体信息；缺失处可用【待补充：...】。
4. 需要覆盖以下章节（可根据场景微调）：
${sections.map((item, index) => `${index + 1}. ${item}`).join("\n")}
5. 如果分析结果包含付款、交付、验收、知识产权、保密、违约责任、争议解决等信息，必须体现在合同正文中。
6. 返回 JSON，不要输出 Markdown。

JSON Schema:
{
  "title": "${contractTypeName}",
  "contractType": "${contractType}",
  "legalBasis": "适用法律依据说明",
  "generatedBy": {
    "expertName": "${expert.name}",
    "expertTitle": "${expert.title}",
    "generatedAt": "${new Date().toISOString()}"
  },
  "contractNumber": "建议的合同编号",
  "sections": [
    {
      "id": "section-1",
      "title": "第一条 合同双方",
      "content": "条款正文",
      "order": 1,
      "editable": true,
      "tips": "可选填写提示"
    }
  ],
  "signature": {
    "partyA": {
      "title": "甲方（盖章）",
      "name": "甲方名称",
      "representative": "法定代表人/授权代表",
      "date": "签署日期"
    },
    "partyB": {
      "title": "乙方（签字/盖章）",
      "name": "乙方名称",
      "idNumber": "身份证号/统一社会信用代码",
      "date": "签署日期"
    }
  },
  "disclaimer": "简短免责声明",
  "appendices": [
    {
      "name": "附件名称",
      "description": "附件说明"
    }
  ]
}`;
  }

  return `Generate a draft ${contractTypeName} from the structured analysis below, from the professional perspective of ${expert.name} (${expert.title}).

Expert profile: ${expert.personality}
Expertise: ${expert.expertise.join(", ")}
Best practices:
${expert.bestPractices.map((item) => `- ${item}`).join("\n")}
Common pitfalls:
${expert.commonPitfalls.map((item) => `- ${item}`).join("\n")}

Analysis result:
${analysisResult}

Requirements:
1. All user-facing text must be written in English.
2. The contract must be clear, professional, and directly editable.
3. Do not invent confirmed party details; use placeholders like [To be completed: ...] when needed.
4. Cover these sections, adjusting when the scenario requires it:
${sections.map((item, index) => `${index + 1}. ${item}`).join("\n")}
5. If the analysis contains payment, delivery, acceptance, IP, confidentiality, breach, or dispute terms, reflect them explicitly in the contract body.
6. Return JSON only, without markdown.

JSON Schema:
{
  "title": "${contractTypeName}",
  "contractType": "${contractType}",
  "legalBasis": "short legal basis note",
  "generatedBy": {
    "expertName": "${expert.name}",
    "expertTitle": "${expert.title}",
    "generatedAt": "${new Date().toISOString()}"
  },
  "contractNumber": "suggested contract number",
  "sections": [
    {
      "id": "section-1",
      "title": "1. Parties",
      "content": "clause body",
      "order": 1,
      "editable": true,
      "tips": "optional drafting note"
    }
  ],
  "signature": {
    "partyA": {
      "title": "Party A (Signature / Seal)",
      "name": "Party A name",
      "representative": "Authorized representative",
      "date": "Signing date"
    },
    "partyB": {
      "title": "Party B (Signature / Seal)",
      "name": "Party B name",
      "idNumber": "ID / registration number",
      "date": "Signing date"
    }
  },
  "disclaimer": "short disclaimer",
  "appendices": [
    {
      "name": "Appendix name",
      "description": "Appendix description"
    }
  ]
}`;
}

export function generateContractSystemPrompt(
  expert: ExpertRole,
  language: PromptLanguage,
): string {
  return isChinese(language)
    ? `你是 ${expert.name}（${expert.title}）。请生成适合法律和商业场景使用的合同草稿。输出必须是合法 JSON。`
    : `You are ${expert.name} (${expert.title}). Draft a professional contract suitable for legal and business use. Output must be valid JSON.`;
}

export const GENERATE_CONTRACT_PROMPT = generateContractPrompt(
  {
    id: "default",
    name: "Default Counsel",
    title: "Contracts Counsel",
    expertise: ["contracts"],
    personality: "practical",
    systemPrompt: "",
    industryKnowledge: "",
    legalBasis: [],
    commonPitfalls: [],
    bestPractices: [],
  },
  "{analysisResult}",
  "custom",
  "zh",
);

export const GENERATE_CONTRACT_SYSTEM = generateContractSystemPrompt(
  {
    id: "default",
    name: "Default Counsel",
    title: "Contracts Counsel",
    expertise: ["contracts"],
    personality: "practical",
    systemPrompt: "",
    industryKnowledge: "",
    legalBasis: [],
    commonPitfalls: [],
    bestPractices: [],
  },
  "zh",
);
