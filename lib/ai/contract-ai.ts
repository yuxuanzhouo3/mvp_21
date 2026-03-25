/**
 * ContractHub AI 合同服务 - 专家版
 * 核心功能：专家角色分析、专业合同生成
 * 支持：OpenAI (国际) / 通义千问 (国内)
 */

import OpenAI from 'openai';
import {
  AIAnalysisResult,
  ContractContent,
  AnalyzeConversationRequest,
  GenerateContractRequest,
  ContractType,
} from './types';
import {
  ANALYZE_CONVERSATION_PROMPT,
  ANALYZE_CONVERSATION_SYSTEM,
  generateAnalyzePrompt,
  generateAnalyzeSystemPrompt,
  PRE_ANALYZE_PROMPT,
} from './prompts/analyze';
import {
  GENERATE_CONTRACT_PROMPT,
  GENERATE_CONTRACT_SYSTEM,
  CONTRACT_TYPE_NAMES,
  generateContractPrompt,
  generateContractSystemPrompt,
} from './prompts/generate';
import {
  getExpertByContractType,
  ALL_EXPERTS,
  ExpertRole,
  LABOR_LAW_EXPERT,
  BUSINESS_CONTRACT_EXPERT,
  FREELANCE_EXPERT,
  TECH_CONTRACT_EXPERT,
} from './prompts/experts';

// 判断是否使用通义千问
function useQwen(): boolean {
  return !!process.env.DASHSCOPE_API_KEY;
}

// 获取 AI 客户端（兼容 OpenAI 和通义千问）
function getAIClient(): OpenAI {
  if (useQwen()) {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new Error('DASHSCOPE_API_KEY is not configured');
    }
    return new OpenAI({
      apiKey,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
}

// 获取使用的模型
function getModel(): string {
  if (useQwen()) {
    return process.env.QWEN_MODEL || 'qwen-plus'; // 使用更强的模型以获得更专业的输出
  }
  return process.env.OPENAI_MODEL || 'gpt-4';
}

/**
 * 预分析：快速判断合同类型以选择正确的专家
 */
async function preAnalyze(content: string): Promise<{
  contractType: string;
  scenario: string;
}> {
  const client = getAIClient();
  const model = getModel();

  const prompt = PRE_ANALYZE_PROMPT.replace('{conversation}', content);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: '你是一位经验丰富的法律顾问，请快速判断对话内容。输出JSON格式。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    return {
      contractType: result.contractType || 'custom',
      scenario: result.scenario || '未知场景',
    };
  } catch {
    return { contractType: 'custom', scenario: '未知场景' };
  }
}

/**
 * 分析对话内容 - 专家版
 * 使用专业法律顾问角色进行深度分析
 */
export async function analyzeConversation(
  request: AnalyzeConversationRequest
): Promise<AIAnalysisResult> {
  const client = getAIClient();
  const model = getModel();

  // 第一步：预分析确定合同类型
  const { contractType } = await preAnalyze(request.content);
  console.log(`📋 识别合同类型: ${contractType}`);

  // 第二步：获取对应专家
  const expert = getExpertByContractType(contractType);
  console.log(`👨‍💼 分配专家: ${expert.name}（${expert.title}）`);

  // 第三步：使用专家进行深度分析
  const userPrompt = generateAnalyzePrompt(expert, request.content);
  const systemPrompt = generateAnalyzeSystemPrompt(expert);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AI 返回内容为空');
    }

    // 解析 JSON 响应
    const result = JSON.parse(content);

    // 转换为标准格式（兼容新旧格式）
    const analysisResult: AIAnalysisResult = {
      contractType: result.contractType || contractType,
      confidence: result.confidence || 0.8,
      partyA: result.partyA || { name: '', role: '' },
      partyB: result.partyB || { name: '', role: '' },
      keyTerms: (result.keyTerms || []).map((term: any) => ({
        type: term.category || term.type || 'other',
        label: term.label,
        value: term.value,
        source: term.source,
        confidence: term.confidence || 0.8,
        riskLevel: term.riskLevel,
        suggestion: term.suggestion,
      })),
      suggestedTemplate: result.suggestedTemplate,
      summary: result.summary,
      // 新增专家分析字段
      expertAnalysis: result.expertAnalysis,
      scenario: result.scenario,
      riskAlerts: result.riskAlerts || [],
      missingInfo: result.missingInfo || [],
      professionalAdvice: result.professionalAdvice || [],
    };

    return analysisResult;
  } catch (error) {
    console.error('专家分析失败，降级到基础分析:', error);
    // 降级到基础分析
    return analyzeConversationBasic(request);
  }
}

/**
 * 基础分析（降级方案）
 */
async function analyzeConversationBasic(
  request: AnalyzeConversationRequest
): Promise<AIAnalysisResult> {
  const client = getAIClient();
  const model = getModel();

  const userPrompt = ANALYZE_CONVERSATION_PROMPT.replace(
    '{conversation}',
    request.content
  );

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: ANALYZE_CONVERSATION_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('AI 返回内容为空');
  }

  return JSON.parse(content) as AIAnalysisResult;
}

/**
 * 根据分析结果生成合同 - 专家版
 */
export async function generateContract(
  request: GenerateContractRequest
): Promise<ContractContent> {
  const client = getAIClient();
  const model = getModel();

  // 获取合同类型
  const contractType = request.analysisResult.contractType || 'custom';
  const contractTypeName = CONTRACT_TYPE_NAMES[contractType] || '合同';

  // 获取对应专家
  const expert = getExpertByContractType(contractType);
  console.log(`📝 ${expert.name} 正在生成 ${contractTypeName}...`);

  // 使用专家生成合同
  const userPrompt = generateContractPrompt(
    expert,
    JSON.stringify(request.analysisResult, null, 2),
    contractType
  );
  const systemPrompt = generateContractSystemPrompt(expert);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
      max_tokens: 6000, // 专业合同内容较长
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AI 返回内容为空');
    }

    // 解析 JSON 响应
    const result = JSON.parse(content);

    // 转换为标准格式
    const contractContent: ContractContent = {
      title: result.title || contractTypeName,
      contractType: contractType as ContractType,
      legalBasis: result.legalBasis,
      generatedBy: result.generatedBy || {
        expertName: expert.name,
        expertTitle: expert.title,
        generatedAt: new Date().toISOString(),
      },
      sections: (result.sections || []).map((section: any, index: number) => ({
        id: section.id || `section-${index + 1}`,
        title: section.title,
        content: section.content,
        order: section.order || index + 1,
        editable: section.editable !== false,
        tips: section.tips,
      })),
      disclaimer: result.disclaimer ||
        '**重要声明**\n\n本合同由ContractHub平台基于AI技术辅助生成，仅供参考。签署前请仔细审核所有条款，如有必要请咨询专业律师。合同双方应在充分理解条款内容后签署。平台不对合同内容的法律效力及执行后果承担责任。',
      signature: result.signature || {
        partyA: { name: '【待填写】', title: '甲方（盖章）', date: '【待填写】' },
        partyB: { name: '【待填写】', title: '乙方（签字）', date: '【待填写】' },
      },
      appendices: result.appendices,
    };

    return contractContent;
  } catch (error) {
    console.error('专家生成合同失败，降级到基础生成:', error);
    return generateContractBasic(request);
  }
}

/**
 * 基础合同生成（降级方案）
 */
async function generateContractBasic(
  request: GenerateContractRequest
): Promise<ContractContent> {
  const client = getAIClient();
  const model = getModel();

  const contractTypeName =
    CONTRACT_TYPE_NAMES[request.analysisResult.contractType] || '合同';

  const userPrompt = GENERATE_CONTRACT_PROMPT
    .replace('{contractType}', contractTypeName)
    .replace('{analysisResult}', JSON.stringify(request.analysisResult, null, 2));

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: GENERATE_CONTRACT_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('AI 返回内容为空');
  }

  const result = JSON.parse(content) as ContractContent;
  result.contractType = request.analysisResult.contractType as ContractType;

  return result;
}

/**
 * 一站式服务：分析对话并生成合同
 */
export async function analyzeAndGenerateContract(
  conversationContent: string,
  sourceType: 'text' | 'screenshot' | 'wechat' | 'feishu' = 'text'
): Promise<{
  analysis: AIAnalysisResult;
  contract: ContractContent;
  expert: { name: string; title: string };
}> {
  // 第一步：专家分析对话
  const analysis = await analyzeConversation({
    content: conversationContent,
    sourceType,
  });

  // 获取专家信息
  const expert = getExpertByContractType(analysis.contractType);

  // 第二步：专家生成合同
  const contract = await generateContract({
    analysisResult: analysis,
  });

  return {
    analysis,
    contract,
    expert: {
      name: expert.name,
      title: expert.title,
    },
  };
}

/**
 * 获取支持的合同类型列表
 */
export function getSupportedContractTypes(): Array<{
  value: ContractType;
  label: string;
  description: string;
  expert: string;
}> {
  return [
    {
      value: 'labor',
      label: '劳动合同',
      description: '用于正式员工入职签署的劳动合同',
      expert: LABOR_LAW_EXPERT.name,
    },
    {
      value: 'freelance',
      label: '劳务协议',
      description: '用于自由职业者、兼职人员的劳务协议',
      expert: FREELANCE_EXPERT.name,
    },
    {
      value: 'tech',
      label: '技术开发合同',
      description: '用于软件开发、技术外包等项目',
      expert: TECH_CONTRACT_EXPERT.name,
    },
    {
      value: 'cooperation',
      label: '合作协议',
      description: '用于商务合作、项目合作的协议',
      expert: BUSINESS_CONTRACT_EXPERT.name,
    },
    {
      value: 'nda',
      label: '保密协议',
      description: '用于保护商业机密的保密协议（NDA）',
      expert: BUSINESS_CONTRACT_EXPERT.name,
    },
    {
      value: 'service',
      label: '服务协议',
      description: '用于提供各类服务的通用协议',
      expert: BUSINESS_CONTRACT_EXPERT.name,
    },
    {
      value: 'custom',
      label: '自定义合同',
      description: '其他类型的自定义合同',
      expert: BUSINESS_CONTRACT_EXPERT.name,
    },
  ];
}

/**
 * 获取所有专家列表
 */
export function getAllExperts(): Array<{
  id: string;
  name: string;
  title: string;
  expertise: string[];
}> {
  return ALL_EXPERTS.map(expert => ({
    id: expert.id,
    name: expert.name,
    title: expert.title,
    expertise: expert.expertise,
  }));
}

/**
 * 根据合同类型获取专家信息
 */
export function getExpertInfo(contractType: string): {
  name: string;
  title: string;
  expertise: string[];
} {
  const expert = getExpertByContractType(contractType);
  return {
    name: expert.name,
    title: expert.title,
    expertise: expert.expertise,
  };
}
