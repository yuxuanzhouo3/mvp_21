/**
 * 合同生成 Prompt 模板 - 专业版
 * 根据行业规范和法律要求生成专业合同文本
 */

import { getExpertByContractType, ExpertRole } from "./experts";

// 合同类型名称映射
export const CONTRACT_TYPE_NAMES: Record<string, string> = {
  labor: "劳动合同",
  service: "服务协议",
  cooperation: "合作协议",
  nda: "保密协议",
  freelance: "劳务协议",
  tech: "技术开发合同",
  software: "软件开发合同",
  custom: "合同",
};

// 行业合同模板配置
export const CONTRACT_TEMPLATES: Record<string, ContractTemplate> = {
  // 劳动合同模板
  labor: {
    name: "劳动合同",
    sections: [
      { id: "parties", title: "第一条 双方基本信息", required: true },
      { id: "term", title: "第二条 合同期限", required: true },
      { id: "work", title: "第三条 工作内容和工作地点", required: true },
      { id: "hours", title: "第四条 工作时间和休息休假", required: true },
      { id: "compensation", title: "第五条 劳动报酬", required: true },
      { id: "insurance", title: "第六条 社会保险和福利待遇", required: true },
      { id: "protection", title: "第七条 劳动保护和劳动条件", required: true },
      { id: "discipline", title: "第八条 劳动纪律", required: false },
      {
        id: "termination",
        title: "第九条 合同的变更、解除和终止",
        required: true,
      },
      { id: "breach", title: "第十条 违约责任", required: true },
      { id: "dispute", title: "第十一条 争议解决", required: true },
      { id: "other", title: "第十二条 其他约定", required: false },
    ],
    legalBasis: "依据《中华人民共和国劳动合同法》及相关法律法规",
  },

  // 劳务协议模板（自由职业）
  freelance: {
    name: "劳务协议",
    sections: [
      { id: "parties", title: "第一条 双方信息", required: true },
      { id: "scope", title: "第二条 服务内容", required: true },
      { id: "term", title: "第三条 服务期限", required: true },
      { id: "deliverables", title: "第四条 工作成果与验收", required: true },
      { id: "payment", title: "第五条 劳务报酬", required: true },
      { id: "tax", title: "第六条 税务处理", required: true },
      { id: "ip", title: "第七条 知识产权", required: true },
      { id: "confidentiality", title: "第八条 保密义务", required: true },
      { id: "liability", title: "第九条 责任与免责", required: true },
      { id: "termination", title: "第十条 协议终止", required: true },
      { id: "dispute", title: "第十一条 争议解决", required: true },
    ],
    legalBasis: "依据《中华人民共和国民法典》合同编",
  },

  // 技术开发合同模板
  tech: {
    name: "技术开发合同",
    sections: [
      { id: "parties", title: "第一条 合同双方", required: true },
      { id: "project", title: "第二条 项目概述", required: true },
      { id: "requirements", title: "第三条 技术需求与规格", required: true },
      { id: "schedule", title: "第四条 开发计划与里程碑", required: true },
      { id: "acceptance", title: "第五条 验收标准与流程", required: true },
      { id: "payment", title: "第六条 合同价款与支付", required: true },
      { id: "ip", title: "第七条 知识产权归属", required: true },
      { id: "source", title: "第八条 源代码与技术文档", required: true },
      { id: "maintenance", title: "第九条 维护与技术支持", required: true },
      { id: "confidentiality", title: "第十条 保密条款", required: true },
      { id: "warranty", title: "第十一条 质量保证", required: true },
      { id: "breach", title: "第十二条 违约责任", required: true },
      { id: "dispute", title: "第十三条 争议解决", required: true },
    ],
    legalBasis: "依据《中华人民共和国民法典》及《计算机软件保护条例》",
  },

  // 合作协议模板
  cooperation: {
    name: "合作协议",
    sections: [
      { id: "parties", title: "第一条 合作各方", required: true },
      { id: "background", title: "第二条 合作背景与目的", required: true },
      { id: "scope", title: "第三条 合作范围与内容", required: true },
      { id: "term", title: "第四条 合作期限", required: true },
      {
        id: "responsibilities",
        title: "第五条 各方权利与义务",
        required: true,
      },
      { id: "investment", title: "第六条 投入与资源", required: true },
      { id: "profit", title: "第七条 利益分配", required: true },
      { id: "ip", title: "第八条 知识产权", required: true },
      { id: "confidentiality", title: "第九条 保密条款", required: true },
      { id: "governance", title: "第十条 合作管理", required: false },
      { id: "exit", title: "第十一条 退出机制", required: true },
      { id: "breach", title: "第十二条 违约责任", required: true },
      { id: "dispute", title: "第十三条 争议解决", required: true },
    ],
    legalBasis: "依据《中华人民共和国民法典》合同编",
  },

  // 保密协议模板
  nda: {
    name: "保密协议",
    sections: [
      { id: "parties", title: "第一条 协议双方", required: true },
      { id: "background", title: "第二条 签署背景", required: true },
      { id: "definition", title: "第三条 保密信息的定义", required: true },
      { id: "scope", title: "第四条 保密信息的范围", required: true },
      { id: "obligations", title: "第五条 保密义务", required: true },
      { id: "exceptions", title: "第六条 例外情形", required: true },
      { id: "term", title: "第七条 保密期限", required: true },
      { id: "return", title: "第八条 信息返还与销毁", required: true },
      { id: "breach", title: "第九条 违约责任", required: true },
      { id: "dispute", title: "第十条 争议解决", required: true },
    ],
    legalBasis: "依据《中华人民共和国反不正当竞争法》及相关法律法规",
  },

  // 服务协议模板
  service: {
    name: "服务协议",
    sections: [
      { id: "parties", title: "第一条 双方信息", required: true },
      { id: "scope", title: "第二条 服务内容与范围", required: true },
      { id: "standard", title: "第三条 服务标准与要求", required: true },
      { id: "term", title: "第四条 服务期限", required: true },
      { id: "payment", title: "第五条 服务费用与支付", required: true },
      { id: "rights", title: "第六条 双方权利与义务", required: true },
      { id: "acceptance", title: "第七条 验收与确认", required: true },
      { id: "confidentiality", title: "第八条 保密条款", required: true },
      { id: "breach", title: "第九条 违约责任", required: true },
      { id: "termination", title: "第十条 合同终止", required: true },
      { id: "dispute", title: "第十一条 争议解决", required: true },
    ],
    legalBasis: "依据《中华人民共和国民法典》合同编",
  },
};

interface ContractTemplate {
  name: string;
  sections: { id: string; title: string; required: boolean }[];
  legalBasis: string;
}

// 专业合同生成提示词
export function generateContractPrompt(
  expert: ExpertRole,
  analysisResult: string,
  contractType: string,
): string {
  const template =
    CONTRACT_TEMPLATES[contractType] || CONTRACT_TEMPLATES.service;

  return `
${expert.systemPrompt}

---

## 你现在的任务
根据分析结果，生成一份专业、规范、可执行的【${template.name}】。

## 分析结果
${analysisResult}

## 合同模板结构
${template.legalBasis}

本合同应包含以下章节：
${template.sections.map((s, i) => `${i + 1}. ${s.title}${s.required ? "（必填）" : "（选填）"}`).join("\n")}

## 行业规范要求
${expert.industryKnowledge}

## 最佳实践
${expert.bestPractices.map((bp) => `✓ ${bp}`).join("\n")}

## 必须避免的问题
${expert.commonPitfalls.map((cp) => `✗ ${cp}`).join("\n")}

---

## 生成要求

### 1. 格式规范
- 使用正式法律文书语言
- 章节编号清晰（第一条、第二条...）
- 条款层级分明（一、二、三... 或 1、2、3...）
- 内容必须是纯文本格式，不使用加粗、斜体、代码块等Markdown格式符号
- 通过缩进和换行实现层次结构
- 重要内容使用全角符号标注，如【重要】或「注意」

### 2. 内容专业
- 准确使用法律术语
- 条款完整，不留漏洞
- 权利义务对等
- 违约责任明确

### 3. 实用性
- 对于分析结果中已有的信息，直接填入
- 对于缺失的必要信息，使用【待填写：xxx】标注
- 给出合理的默认值建议

### 4. 风险防范
- 根据分析中的风险提示，在相关条款中做好防范
- 加入必要的免责条款
- 设置合理的违约金

## 输出格式

请严格按照以下JSON格式输出：

\`\`\`json
{
  "title": "${template.name}",
  "contractType": "${contractType}",
  "legalBasis": "${template.legalBasis}",
  "generatedBy": {
    "expertName": "${expert.name}",
    "expertTitle": "${expert.title}",
    "generatedAt": "生成时间"
  },
  "contractNumber": "合同编号（建议格式）",
  "sections": [
    {
      "id": "section-1",
      "title": "第一条 标题",
      "content": "条款内容（纯文本格式，不使用Markdown符号，通过换行和缩进实现层次结构）",
      "order": 1,
      "editable": true,
      "tips": "该条款的填写提示或注意事项"
    }
  ],
  "signature": {
    "partyA": {
      "title": "甲方（盖章）",
      "name": "【待填写：甲方名称】",
      "representative": "【待填写：法定代表人/授权代表】",
      "date": "【待填写：签署日期】"
    },
    "partyB": {
      "title": "乙方（签字/盖章）",
      "name": "【待填写：乙方名称】",
      "idNumber": "【待填写：身份证号/统一社会信用代码】",
      "date": "【待填写：签署日期】"
    }
  },
  "disclaimer": "【重要声明】\\n\\n本合同由ContractHub平台基于AI技术辅助生成，仅供参考。签署前请仔细审核所有条款，如有必要请咨询专业律师。合同双方应在充分理解条款内容后签署。平台不对合同内容的法律效力及执行后果承担责任。",
  "appendices": [
    {
      "name": "附件名称（如有）",
      "description": "附件说明"
    }
  ]
}
\`\`\`

## 特别提醒
1. 每个条款内容要具体、可操作，避免空泛表述
2. 金额、日期、比例等关键数字要明确标注
3. 需要用户填写的地方用【待填写：xxx】格式
4. 法律专业术语使用准确
5. 整体风格要正式、严谨
`;
}

// 系统提示
export function generateContractSystemPrompt(expert: ExpertRole): string {
  return `你是 ${expert.name}，${expert.title}。

你正在为 ContractHub 平台的用户生成专业合同。

你的职责：
1. 根据分析结果生成规范、专业的合同文本
2. 确保合同符合相关法律法规要求
3. 条款清晰、权责分明、可操作性强
4. 对重要条款给出填写提示

你必须：
- 使用正式的法律文书语言
- 条款完整，不留法律漏洞
- 对需要用户补充的信息明确标注
- 输出有效的JSON格式

法律依据：${expert.legalBasis.join("、")}`;
}

// 兼容旧版本
export const GENERATE_CONTRACT_PROMPT = `
你是一位资深法律顾问。请根据以下分析结果，生成一份规范的{contractType}。

## 分析结果
{analysisResult}

## 要求
1. 合同格式规范，包含所有必要的法律条款
2. 语言正式、专业，符合法律文书规范
3. 对于未提供的信息，使用【待填写】标记

## 输出格式（JSON）
\`\`\`json
{
  "title": "合同标题",
  "sections": [
    {
      "id": "section-1",
      "title": "第一条 标题",
      "content": "内容",
      "order": 1,
      "editable": true
    }
  ],
  "disclaimer": "免责声明",
  "signature": {
    "partyA": { "name": "", "title": "", "date": "" },
    "partyB": { "name": "", "title": "", "date": "" }
  }
}
\`\`\`
`;

export const GENERATE_CONTRACT_SYSTEM = `
你是ContractHub的资深法律顾问，负责生成专业的合同文本。
合同应符合中国法律规范，语言正式、条款完整。
输出必须是有效的JSON格式。
`;
