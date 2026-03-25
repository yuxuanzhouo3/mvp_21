/**
 * 对话分析 Prompt 模板 - 专家版
 * 由专业法律顾问角色分析用户对话，提取合同关键信息
 */

import { getExpertByContractType, ExpertRole } from './experts';

// 初步分析：识别合同类型和场景
export const PRE_ANALYZE_PROMPT = `
你是一位经验丰富的法律顾问。请快速浏览以下对话内容，判断这可能涉及什么类型的合同。

## 对话内容
{conversation}

## 请判断
1. 这是什么场景？（求职面试/商务洽谈/项目合作/咨询服务等）
2. 可能需要什么类型的合同？
3. 对话双方的身份是什么？

只需返回JSON格式：
\`\`\`json
{
  "scenario": "场景描述",
  "contractType": "labor|service|cooperation|nda|freelance|tech|custom",
  "partyARole": "甲方角色",
  "partyBRole": "乙方角色",
  "keyIssues": ["需要关注的关键问题1", "问题2"]
}
\`\`\`
`;

// 专家分析提示词生成器
export function generateAnalyzePrompt(expert: ExpertRole, conversation: string): string {
  return `
${expert.systemPrompt}

---

## 行业知识库
${expert.industryKnowledge}

## 相关法律依据
${expert.legalBasis.map(law => `- ${law}`).join('\n')}

## 常见陷阱（务必警惕）
${expert.commonPitfalls.map(pitfall => `⚠️ ${pitfall}`).join('\n')}

---

# 你的任务

请以 ${expert.name}（${expert.title}）的专业视角，分析以下对话内容，提取可用于生成合同的关键信息。

## 对话内容
${conversation}

## 分析要求

### 1. 场景判断
首先判断这个对话的真实场景：
- 这是正式的商务洽谈还是初步意向？
- 双方的谈判地位如何？
- 是否存在信息不对称？

### 2. 风险识别
根据你的专业经验，识别对话中的潜在风险：
- 有没有明显不合理的条款？
- 有没有重要信息缺失？
- 有没有可能引发争议的模糊表述？

### 3. 信息提取
提取所有可用于合同的关键信息，并标注可信度。

### 4. 专业建议
基于行业最佳实践，给出具体建议。

## 输出格式

请严格按照以下JSON格式输出：

\`\`\`json
{
  "expertAnalysis": {
    "expertName": "${expert.name}",
    "expertTitle": "${expert.title}",
    "analysisDate": "分析日期",
    "overallAssessment": "整体评估（一句话概括）"
  },
  "scenario": {
    "type": "场景类型",
    "description": "场景描述",
    "negotiationStatus": "谈判阶段（初步接触/深入洽谈/基本达成一致）",
    "powerBalance": "双方地位（平等/甲方强势/乙方强势）"
  },
  "contractType": "labor|service|cooperation|nda|freelance|tech|custom",
  "confidence": 0.0-1.0,
  "partyA": {
    "name": "甲方姓名或公司名",
    "role": "具体角色",
    "company": "公司名称",
    "position": "职位",
    "contact": "联系方式",
    "identified": true/false
  },
  "partyB": {
    "name": "乙方姓名",
    "role": "具体角色",
    "company": "公司名称",
    "position": "职位",
    "contact": "联系方式",
    "identified": true/false
  },
  "keyTerms": [
    {
      "category": "compensation|duration|workContent|benefits|ip|confidentiality|termination|other",
      "label": "条款名称",
      "value": "提取的具体值",
      "source": "原文引用",
      "confidence": 0.0-1.0,
      "riskLevel": "low|medium|high",
      "riskNote": "风险说明（如有）",
      "suggestion": "专业建议（如有）"
    }
  ],
  "riskAlerts": [
    {
      "severity": "high|medium|low",
      "issue": "问题描述",
      "impact": "可能影响",
      "suggestion": "建议措施"
    }
  ],
  "missingInfo": [
    {
      "item": "缺失信息项",
      "importance": "high|medium|low",
      "defaultSuggestion": "建议默认值或处理方式"
    }
  ],
  "professionalAdvice": [
    "建议1：具体的专业建议",
    "建议2：...",
    "建议3：..."
  ],
  "suggestedTemplate": "推荐的合同模板类型",
  "summary": "专业分析总结（2-3句话）"
}
\`\`\`

## 重要提醒
- 只提取对话中明确提到的信息，不要编造
- 对不确定的信息，confidence 设为较低值
- 必须保留原文引用（source字段）
- 风险提示要具体、可操作
- 建议要基于行业最佳实践
`;
}

// 分析系统提示
export function generateAnalyzeSystemPrompt(expert: ExpertRole): string {
  return `你是 ${expert.name}，${expert.title}。

你的专业领域：${expert.expertise.join('、')}

你的分析风格：${expert.personality}

你正在为 ContractHub 平台的用户提供专业的合同分析服务。你需要：
1. 以专业法律顾问的视角分析用户提供的对话
2. 识别潜在的法律风险和合规问题
3. 提取可用于生成合同的关键信息
4. 给出专业、可操作的建议

你的分析必须：
- 准确、客观，不添加对话中没有的内容
- 风险提示要明确、具体
- 建议要实用、可执行
- 输出必须是有效的JSON格式`;
}

// 兼容旧版本的导出
export const ANALYZE_CONVERSATION_PROMPT = `
你是一位资深法律顾问。请分析以下对话内容，提取可能用于生成合同的关键信息。

## 任务
1. 识别对话双方的身份和角色
2. 判断合同类型
3. 提取关键条款信息
4. 识别潜在风险

## 对话内容
{conversation}

## 输出格式（JSON）
\`\`\`json
{
  "contractType": "labor|service|cooperation|nda|freelance|tech|custom",
  "confidence": 0.0-1.0,
  "partyA": { "name": "", "role": "", "company": "", "contact": "" },
  "partyB": { "name": "", "role": "", "company": "", "contact": "" },
  "keyTerms": [
    {
      "type": "salary|duration|payment|workContent|benefit|other",
      "label": "条款名称",
      "value": "具体值",
      "source": "原文引用",
      "confidence": 0.0-1.0
    }
  ],
  "riskAlerts": [{ "severity": "high|medium|low", "issue": "", "suggestion": "" }],
  "suggestedTemplate": "推荐模板",
  "summary": "分析总结"
}
\`\`\`
`;

export const ANALYZE_CONVERSATION_SYSTEM = `
你是ContractHub的资深法律顾问，拥有丰富的合同分析经验。
你需要准确、专业地分析用户提供的商务对话，提取关键信息并识别潜在风险。
输出必须是有效的JSON格式。
`;
