import { CONTRACT_TYPE_NAMES } from "@/lib/ai/prompts/generate";
import type { AIAnalysisResult, ContractContent, ContractSection } from "@/lib/ai/types";

type SupportedLanguage = "zh" | "en";
export type ContractVersionAction = "draft_created" | "analysis_generated" | "draft_saved";

export interface ContractVersionEntry {
  id: string;
  action: ContractVersionAction;
  label: string;
  createdAt: string;
  title: string;
  summary?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRichText(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function isContractSection(value: unknown): value is ContractSection {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const section = value as Record<string, unknown>;
  return typeof section.title === "string" && typeof section.content === "string";
}

export function normalizeContractContent(value: unknown): ContractContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.sections)) {
    return null;
  }

  const sections = data.sections.filter(isContractSection);
  if (sections.length === 0) {
    return null;
  }

  return {
    title: typeof data.title === "string" && data.title.trim()
      ? data.title.trim()
      : "合同草稿",
    contractType: typeof data.contractType === "string" ? data.contractType : undefined,
    legalBasis: typeof data.legalBasis === "string" ? data.legalBasis : undefined,
    generatedBy:
      data.generatedBy && typeof data.generatedBy === "object" && !Array.isArray(data.generatedBy)
        ? (data.generatedBy as ContractContent["generatedBy"])
        : undefined,
    contractNumber: typeof data.contractNumber === "string" ? data.contractNumber : undefined,
    sections: sections.map((section, index) => ({
      id:
        typeof section.id === "string" && section.id.trim()
          ? section.id
          : `section-${index + 1}`,
      title: section.title,
      content: section.content,
      order:
        typeof section.order === "number" && Number.isFinite(section.order)
          ? section.order
          : index + 1,
      editable: section.editable !== false,
      tips: typeof section.tips === "string" ? section.tips : undefined,
    })),
    disclaimer: typeof data.disclaimer === "string" ? data.disclaimer : "",
    signature:
      data.signature && typeof data.signature === "object" && !Array.isArray(data.signature)
        ? (data.signature as ContractContent["signature"])
        : {
            partyA: { name: "" },
            partyB: { name: "" },
          },
    appendices: Array.isArray(data.appendices)
      ? (data.appendices as ContractContent["appendices"])
      : undefined,
  };
}

export function buildContractParties(analysis: AIAnalysisResult): Array<Record<string, unknown>> {
  return [analysis.partyA, analysis.partyB]
    .filter((party) => party && typeof party === "object")
    .map((party, index) => ({
      role: index === 0 ? "partyA" : "partyB",
      name: party.name || "",
      company: party.company || "",
      position: party.position || "",
      contact: party.contact || "",
      identified: party.identified ?? Boolean(party.name || party.company),
    }));
}

export function deriveDraftTitle(analysis: AIAnalysisResult): string {
  const contractTypeName =
    CONTRACT_TYPE_NAMES[analysis.contractType] || String(analysis.contractType || "合同");
  const partyNames = [analysis.partyA?.name, analysis.partyB?.name]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, 2);

  if (partyNames.length > 0) {
    return `${contractTypeName} - ${partyNames.join(" / ")}`;
  }

  return `${contractTypeName}草稿`;
}

export function sanitizeDownloadFileName(value: string): string {
  const trimmed = value.trim() || "contract";
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").slice(0, 80);
}

function isVersionEntry(value: unknown): value is ContractVersionEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.action === "string" &&
    typeof entry.label === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.title === "string"
  );
}

export function getContractVersionHistory(metadata: Record<string, unknown> | undefined) {
  const raw = metadata?.versionHistory;
  if (!Array.isArray(raw)) {
    return [] as ContractVersionEntry[];
  }

  return raw
    .filter(isVersionEntry)
    .sort((left, right) => {
      if (left.createdAt === right.createdAt) {
        return left.id < right.id ? 1 : -1;
      }
      return left.createdAt < right.createdAt ? 1 : -1;
    });
}

export function createVersionEntry(input: {
  action: ContractVersionAction;
  title: string;
  summary?: string;
  createdAt?: string;
}): ContractVersionEntry {
  const createdAt = input.createdAt || new Date().toISOString();
  return {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    action: input.action,
    label:
      input.action === "draft_created"
        ? "创建草稿"
        : input.action === "analysis_generated"
          ? "重新生成合同"
          : "保存编辑",
    createdAt,
    title: input.title,
    summary: input.summary,
  };
}

export function appendContractVersionHistory(
  metadata: Record<string, unknown> | undefined,
  versionEntry: ContractVersionEntry,
) {
  const current = getContractVersionHistory(metadata);
  return {
    ...(metadata || {}),
    versionHistory: [versionEntry, ...current].slice(0, 30),
  };
}

export function buildContractHtml(
  contract: ContractContent,
  options?: {
    language?: SupportedLanguage;
    renderedHtml?: string | null;
  },
): string {
  if (options?.renderedHtml && options.renderedHtml.trim()) {
    return options.renderedHtml;
  }

  const language = options?.language || "zh";
  const labels = {
    disclaimer: language === "en" ? "Disclaimer" : "声明",
    partyASign: language === "en" ? "Party A (Signature)" : "甲方（签字）",
    partyBSign: language === "en" ? "Party B (Signature)" : "乙方（签字）",
    date: language === "en" ? "Date" : "日期",
    emptyDate: language === "en" ? "_______ / _____ / _____" : "_______年____月____日",
  };

  const sections = [...contract.sections].sort((left, right) => left.order - right.order);
  let html = `<h1 style="text-align:center;margin-bottom:24px;">${escapeHtml(contract.title)}</h1>\n\n`;

  sections.forEach((section) => {
    html += `<h2 style="margin-top:20px;margin-bottom:12px;">${escapeHtml(section.title)}</h2>\n`;
    html += `<p style="text-indent:2em;line-height:1.8;">${formatRichText(section.content)}</p>\n\n`;
  });

  if (contract.disclaimer) {
    html += `<div style="margin-top:32px;padding:16px;background:#f5f5f5;border-radius:8px;">`;
    html += `<p style="color:#666;font-size:14px;"><strong>${labels.disclaimer}:</strong> ${formatRichText(contract.disclaimer)}</p>`;
    html += `</div>\n\n`;
  }

  html += `<div style="margin-top:48px;">`;
  html += `<div style="display:flex;justify-content:space-between;gap:24px;">`;
  html += `<div style="width:45%;">`;
  html += `<p><strong>${labels.partyASign}</strong></p>`;
  html += `<p style="margin-top:40px;border-bottom:1px solid #000;width:200px;"></p>`;
  html += `<p style="margin-top:16px;"><strong>${labels.date}:</strong> ${labels.emptyDate}</p>`;
  html += `</div>`;
  html += `<div style="width:45%;">`;
  html += `<p><strong>${labels.partyBSign}</strong></p>`;
  html += `<p style="margin-top:40px;border-bottom:1px solid #000;width:200px;"></p>`;
  html += `<p style="margin-top:16px;"><strong>${labels.date}:</strong> ${labels.emptyDate}</p>`;
  html += `</div>`;
  html += `</div>`;
  html += `</div>`;

  return html;
}

export function buildContractDocumentHtml(
  title: string,
  bodyHtml: string,
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: "SimSun", "Songti SC", serif;
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 24px 56px;
      line-height: 1.8;
      color: #111827;
      background: #ffffff;
    }
    h1 { font-size: 28px; text-align: center; margin-bottom: 32px; }
    h2 { font-size: 18px; margin-top: 28px; margin-bottom: 12px; }
    p { margin: 10px 0; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
