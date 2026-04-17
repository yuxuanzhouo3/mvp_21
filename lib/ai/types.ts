export type ContractType =
  | "labor"
  | "service"
  | "cooperation"
  | "nda"
  | "freelance"
  | "tech"
  | "software"
  | "custom";

export type SourceType = "text" | "screenshot" | "wechat" | "feishu";

export interface PartyInfo {
  name?: string;
  role?: string;
  company?: string;
  position?: string;
  contact?: string;
  idNumber?: string;
  identified?: boolean;
}

export type RiskLevel = "low" | "medium" | "high";

export interface KeyTerm {
  type: string;
  label: string;
  value: string;
  source: string;
  confidence: number;
  riskLevel?: RiskLevel;
  riskNote?: string;
  suggestion?: string;
}

export interface RiskAlert {
  severity: RiskLevel;
  issue: string;
  impact?: string;
  suggestion: string;
}

export interface MissingInfo {
  item: string;
  importance: RiskLevel;
  defaultSuggestion?: string;
}

export interface ExpertAnalysis {
  expertName: string;
  expertTitle: string;
  analysisDate?: string;
  overallAssessment: string;
}

export interface ScenarioInfo {
  type: string;
  description: string;
  negotiationStatus?: string;
  powerBalance?: string;
}

export interface AIAnalysisResult {
  contractType: ContractType | string;
  confidence: number;
  partyA: PartyInfo;
  partyB: PartyInfo;
  keyTerms: KeyTerm[];
  suggestedTemplate?: string;
  summary: string;
  expertAnalysis?: ExpertAnalysis;
  scenario?: ScenarioInfo;
  riskAlerts?: RiskAlert[];
  missingInfo?: MissingInfo[];
  professionalAdvice?: string[];
}

export interface ContractSection {
  id: string;
  title: string;
  content: string;
  order: number;
  editable: boolean;
  tips?: string;
}

export interface SignatureInfo {
  name: string;
  title?: string;
  representative?: string;
  idNumber?: string;
  date?: string;
  signed?: boolean;
}

export interface GeneratedByInfo {
  expertName: string;
  expertTitle: string;
  generatedAt: string;
}

export interface AppendixInfo {
  name: string;
  description?: string;
}

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

export interface GenerateContractRequest {
  analysisResult: AIAnalysisResult;
  templateId?: string;
  templateName?: string;
  templateContent?: string;
  templateVersion?: number;
  customFields?: Record<string, string>;
  language?: "zh" | "en";
}

export interface GenerateContractResponse {
  success: boolean;
  data?: ContractContent;
  expert?: {
    name: string;
    title: string;
  };
  error?: string;
}

export interface AnalyzeConversationRequest {
  content: string;
  sourceType: SourceType;
  language?: "zh" | "en";
}

export interface AnalyzeConversationResponse {
  success: boolean;
  data?: AIAnalysisResult;
  expert?: {
    name: string;
    title: string;
  };
  error?: string;
}

export interface ExpertInfo {
  id: string;
  name: string;
  title: string;
  expertise: string[];
}

export interface ContractTypeInfo {
  value: ContractType;
  label: string;
  description: string;
  expert: string;
}
