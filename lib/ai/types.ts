/**
 * ContractHub AI 模块类型定义 - 专家版
 */

// 合同类型
export type ContractType =
  | 'labor'        // 劳动合同
  | 'service'      // 服务协议
  | 'cooperation'  // 合作协议
  | 'nda'          // 保密协议
  | 'freelance'    // 劳务协议（自由职业）
  | 'tech'         // 技术开发合同
  | 'software'     // 软件开发合同
  | 'custom';      // 自定义

// 对话来源类型
export type SourceType = 'text' | 'screenshot' | 'wechat' | 'feishu';

// 甲乙方信息
export interface PartyInfo {
  name?: string;
  role?: string;
  company?: string;
  position?: string;
  contact?: string;
  idNumber?: string;
  identified?: boolean;
}

// 风险等级
export type RiskLevel = 'low' | 'medium' | 'high';

// 关键条款
export interface KeyTerm {
  type: string;       // salary/duration/payment/workContent/benefit/ip/confidentiality/other
  label: string;      // 显示名称
  value: string;      // 提取的值
  source: string;     // 原文引用
  confidence: number; // 置信度 0-1
  riskLevel?: RiskLevel;  // 风险等级
  riskNote?: string;      // 风险说明
  suggestion?: string;    // 专业建议
}

// 风险提醒
export interface RiskAlert {
  severity: RiskLevel;
  issue: string;
  impact?: string;
  suggestion: string;
}

// 缺失信息
export interface MissingInfo {
  item: string;
  importance: RiskLevel;
  defaultSuggestion?: string;
}

// 专家分析信息
export interface ExpertAnalysis {
  expertName: string;
  expertTitle: string;
  analysisDate?: string;
  overallAssessment: string;
}

// 场景信息
export interface ScenarioInfo {
  type: string;
  description: string;
  negotiationStatus?: string;
  powerBalance?: string;
}

// AI 分析结果
export interface AIAnalysisResult {
  contractType: ContractType | string;
  confidence: number;
  partyA: PartyInfo;
  partyB: PartyInfo;
  keyTerms: KeyTerm[];
  suggestedTemplate?: string;
  summary: string;
  // 专家分析扩展字段
  expertAnalysis?: ExpertAnalysis;
  scenario?: ScenarioInfo;
  riskAlerts?: RiskAlert[];
  missingInfo?: MissingInfo[];
  professionalAdvice?: string[];
}

// 合同章节
export interface ContractSection {
  id: string;
  title: string;
  content: string;
  order: number;
  editable: boolean;
  tips?: string;  // 填写提示
}

// 签名信息
export interface SignatureInfo {
  name: string;
  title?: string;
  representative?: string;
  idNumber?: string;
  date?: string;
  signed?: boolean;
}

// 生成者信息
export interface GeneratedByInfo {
  expertName: string;
  expertTitle: string;
  generatedAt: string;
}

// 附件信息
export interface AppendixInfo {
  name: string;
  description?: string;
}

// 合同内容
export interface ContractContent {
  title: string;
  contractType?: ContractType | string;
  legalBasis?: string;
  generatedBy?: GeneratedByInfo;
  contractNumber?: string;
  sections: ContractSection[];
  disclaimer: string;
  signature: {
    partyA: SignatureInfo;
    partyB: SignatureInfo;
  };
  appendices?: AppendixInfo[];
}

// AI 生成请求
export interface GenerateContractRequest {
  analysisResult: AIAnalysisResult;
  templateId?: string;
  templateName?: string;
  templateContent?: string;
  templateVersion?: number;
  customFields?: Record<string, string>;
  language?: 'zh' | 'en';
}

// AI 生成响应
export interface GenerateContractResponse {
  success: boolean;
  data?: ContractContent;
  expert?: {
    name: string;
    title: string;
  };
  error?: string;
}

// 对话分析请求
export interface AnalyzeConversationRequest {
  content: string;
  sourceType: SourceType;
}

// 对话分析响应
export interface AnalyzeConversationResponse {
  success: boolean;
  data?: AIAnalysisResult;
  expert?: {
    name: string;
    title: string;
  };
  error?: string;
}

// 专家信息
export interface ExpertInfo {
  id: string;
  name: string;
  title: string;
  expertise: string[];
}

// 合同类型信息
export interface ContractTypeInfo {
  value: ContractType;
  label: string;
  description: string;
  expert: string;
}
