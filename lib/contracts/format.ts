import { getContractTypeDisplayName } from "@/lib/ai/prompts/generate";
import type { AIAnalysisResult, ContractContent, ContractSection } from "@/lib/ai/types";
import { isChinaRegion } from "@/lib/config/region";
import type {
  ContractExportSignatureRecord,
  ContractExportSignatures,
} from "@/lib/contracts/export-signatures";

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

export interface ContractExportSealOptions {
  stampedAt?: string;
  stampedBy?: string;
  note?: string;
  stamp?: {
    imageDataUrl: string;
    imageMimeType?: string;
    fileName?: string;
    source?: string;
  };
  placement?: {
    page?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    opacity?: number;
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRichText(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function sanitizeSignatureImageDataUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

function formatSignatureDate(value: string | undefined, language: SupportedLanguage) {
  if (!value) {
    return language === "en" ? "Not signed yet" : "未签署";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeSignatureMethodLabel(
  method: string | undefined,
  language: SupportedLanguage,
) {
  if (!method) {
    return language === "en" ? "Not specified" : "未标注";
  }

  if (method === "draw") {
    return language === "en" ? "Handwritten" : "手写签名";
  }
  if (method === "type") {
    return language === "en" ? "Typed signature" : "输入签名";
  }
  if (method === "upload") {
    return language === "en" ? "Uploaded signature image" : "上传签名图";
  }
  if (method === "confirmation") {
    return language === "en" ? "Confirmation record" : "确认记录";
  }
  return method;
}

function buildPartySignatureHtml(args: {
  language: SupportedLanguage;
  title: string;
  signature: ContractExportSignatureRecord;
}) {
  const { language, title, signature } = args;
  const labels = {
    signer: language === "en" ? "Signer" : "签署人",
    date: language === "en" ? "Signed At" : "签署时间",
    method: language === "en" ? "Method" : "签署方式",
    source: language === "en" ? "Source" : "来源",
  };
  const imageDataUrl = sanitizeSignatureImageDataUrl(signature?.imageDataUrl);
  const signerName = signature?.signerName || (language === "en" ? "-" : "未签署");

  let html = `<div style="flex:1;min-width:260px;border:1px solid #d1d5db;border-radius:10px;padding:14px 16px;">`;
  html += `<p style="margin:0 0 8px 0;"><strong>${escapeHtml(title)}</strong></p>`;

  html += `<p style="margin:0 0 6px 0;"><strong>${labels.signer}:</strong> ${escapeHtml(signerName)}</p>`;
  if (imageDataUrl) {
    html += `<div style="margin:8px 0 10px 0;border:1px solid #e5e7eb;background:#fff;padding:8px;border-radius:8px;width:236px;max-width:100%;">`;
    html += `<img src="${imageDataUrl}" width="220" height="88" alt="${escapeHtml(title)} signature" style="display:block;width:220px;height:88px;max-width:100%;object-fit:contain;" />`;
    html += `</div>`;
  } else if (signature.typedName) {
    html += `<p style="margin:8px 0 10px 0;font-size:24px;font-family:'Times New Roman', serif;">${escapeHtml(signature.typedName)}</p>`;
  } else {
    html += `<p style="margin:8px 0 10px 0;border-bottom:1px solid #111827;width:220px;"></p>`;
  }

  html += `<p style="margin:0 0 4px 0;"><strong>${labels.date}:</strong> ${escapeHtml(formatSignatureDate(signature.createdAt, language))}</p>`;
  html += `<p style="margin:0 0 4px 0;"><strong>${labels.method}:</strong> ${escapeHtml(normalizeSignatureMethodLabel(signature.method, language))}</p>`;
  html += `<p style="margin:0;"><strong>${labels.source}:</strong> ${escapeHtml(signature.source || "-")}</p>`;

  html += `</div>`;
  return html;
}

function buildSignatureSectionHtml(
  language: SupportedLanguage,
  signatures?: ContractExportSignatures,
) {
  const entries = [
    { title: language === "en" ? "Party A (Sender)" : "甲方（发起方）", signature: signatures?.sender },
    {
      title: language === "en" ? "Party B (Counterparty)" : "乙方（对方）",
      signature: signatures?.counterparty,
    },
  ].filter(
    (entry): entry is {
      title: string;
      signature: ContractExportSignatureRecord;
    } => Boolean(entry.signature),
  );

  if (entries.length === 0) {
    return "";
  }

  const labels = {
    title: language === "en" ? "Signature Records" : "电子签署记录",
  };

  let html = `<div style="margin-top:48px;">`;
  html += `<h2 style="margin:0 0 12px 0;">${labels.title}</h2>`;
  html += `<div style="display:flex;justify-content:flex-start;gap:16px;align-items:stretch;flex-wrap:wrap;">`;
  entries.forEach((entry) => {
    html += buildPartySignatureHtml({
      language,
      title: entry.title,
      signature: entry.signature,
    });
  });
  html += `</div>`;
  html += `</div>`;
  return html;
}

function buildSealSectionHtml(
  language: SupportedLanguage,
  seal?: ContractExportSealOptions,
) {
  const imageDataUrl = sanitizeSignatureImageDataUrl(seal?.stamp?.imageDataUrl);
  if (!imageDataUrl) {
    return "";
  }

  const labels = {
    title: language === "en" ? "Seal Record" : "盖章记录",
    stampedAt: language === "en" ? "Stamped At" : "盖章时间",
    stampedBy: language === "en" ? "Stamped By" : "盖章人",
    source: language === "en" ? "Source" : "来源",
    fileName: language === "en" ? "Stamp File" : "印章文件",
    note: language === "en" ? "Note" : "备注",
  };

  let html = `<div style="margin-top:36px;border:1px solid #fca5a5;border-radius:12px;padding:16px 18px;background:#fff7f7;">`;
  html += `<h2 style="margin:0 0 10px 0;color:#991b1b;">${labels.title}</h2>`;
  html += `<div style="display:flex;align-items:flex-start;gap:18px;flex-wrap:wrap;">`;
  html += `<div style="width:184px;height:184px;border:1px dashed #fca5a5;background:#fff;padding:10px;border-radius:8px;display:flex;align-items:center;justify-content:center;">`;
  html += `<img src="${imageDataUrl}" width="160" height="160" alt="${escapeHtml(labels.title)}" style="display:block;width:160px;height:160px;object-fit:contain;margin:0 auto;" />`;
  html += `</div>`;
  html += `<div style="flex:1;min-width:240px;font-size:13px;line-height:1.7;color:#7f1d1d;">`;
  html += `<p style="margin:0 0 4px 0;"><strong>${labels.stampedAt}:</strong> ${escapeHtml(formatSignatureDate(seal?.stampedAt, language))}</p>`;
  html += `<p style="margin:0 0 4px 0;"><strong>${labels.stampedBy}:</strong> ${escapeHtml(seal?.stampedBy || "-")}</p>`;
  html += `<p style="margin:0 0 4px 0;"><strong>${labels.source}:</strong> ${escapeHtml(seal?.stamp?.source || "-")}</p>`;
  html += `<p style="margin:0 0 4px 0;"><strong>${labels.fileName}:</strong> ${escapeHtml(seal?.stamp?.fileName || "-")}</p>`;
  if (seal?.note) {
    html += `<p style="margin:0;"><strong>${labels.note}:</strong> ${escapeHtml(seal.note)}</p>`;
  }
  html += `</div>`;
  html += `</div>`;
  html += `</div>`;
  return html;
}

function encodePdfHexString(value: string): string {
  const utf16 = Buffer.from(value, "utf16le");
  const bytes: string[] = [];

  for (let index = 0; index < utf16.length; index += 2) {
    bytes.push(utf16[index + 1]!.toString(16).padStart(2, "0").toUpperCase());
    bytes.push(utf16[index]!.toString(16).padStart(2, "0").toUpperCase());
  }

  return bytes.join("");
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
    title:
      typeof data.title === "string" && data.title.trim()
        ? data.title.trim()
        : isChinaRegion()
          ? "合同草稿"
          : "Contract Draft",
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
  const language: SupportedLanguage = isChinaRegion() ? "zh" : "en";
  const contractTypeName = getContractTypeDisplayName(analysis.contractType, language);
  const partyNames = [analysis.partyA?.name, analysis.partyB?.name]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, 2);

  if (partyNames.length > 0) {
    return `${contractTypeName} - ${partyNames.join(" / ")}`;
  }

  return language === "zh" ? `${contractTypeName}草稿` : `${contractTypeName} Draft`;
}

export function sanitizeDownloadFileName(value: string): string {
  const trimmed = value.trim() || "contract";
  return trimmed.replace(/[<>:\"/\\|?*\u0000-\u001F]/g, "_").slice(0, 80);
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
  const isZh = isChinaRegion();

  return {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    action: input.action,
    label:
      input.action === "draft_created"
        ? isZh
          ? "创建草稿"
          : "Create Draft"
        : input.action === "analysis_generated"
          ? isZh
            ? "重新生成合同"
            : "Regenerate Contract"
          : isZh
            ? "保存编辑"
            : "Save Edits",
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
    signatures?: ContractExportSignatures;
    seal?: ContractExportSealOptions;
  },
): string {
  const language = options?.language || "zh";
  const labels = {
    disclaimer: language === "en" ? "Disclaimer" : "声明",
  };
  let html = "";

  if (options?.renderedHtml && options.renderedHtml.trim()) {
    html = options.renderedHtml;
  } else {
    const sections = [...contract.sections].sort((left, right) => left.order - right.order);
    html = `<h1 style="text-align:center;margin-bottom:24px;">${escapeHtml(contract.title)}</h1>\n\n`;

    sections.forEach((section) => {
      html += `<h2 style="margin-top:20px;margin-bottom:12px;">${escapeHtml(section.title)}</h2>\n`;
      html += `<p style="text-indent:2em;line-height:1.8;">${formatRichText(section.content)}</p>\n\n`;
    });

    if (contract.disclaimer) {
      html += `<div style="margin-top:32px;padding:16px;background:#f5f5f5;border-radius:8px;">`;
      html += `<p style="color:#666;font-size:14px;"><strong>${labels.disclaimer}:</strong> ${formatRichText(contract.disclaimer)}</p>`;
      html += `</div>\n\n`;
    }
  }

  html += buildSignatureSectionHtml(language, options?.signatures);
  html += buildSealSectionHtml(language, options?.seal);

  return html;
}

export function buildContractDocumentHtml(
  title: string,
  bodyHtml: string,
  options?: {
    language?: SupportedLanguage;
  },
): string {
  const language = options?.language || "zh";
  const bodyFontFamily =
    language === "zh"
      ? `"MornContractSimHei", "SimHei", "Microsoft YaHei", "PingFang SC", sans-serif`
      : `"Times New Roman", "Georgia", "MornContractSimHei", "SimHei", "Microsoft YaHei", "PingFang SC", serif`;

  return `<!DOCTYPE html>
<html lang="${language === "en" ? "en-US" : "zh-CN"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    @font-face {
      font-family: "MornContractSimHei";
      src: url("/fonts/simhei.ttf") format("truetype");
      font-weight: normal;
      font-style: normal;
    }
    body {
      font-family: ${bodyFontFamily};
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

function buildPdfTextLines(
  contract: ContractContent,
  language: SupportedLanguage,
  signatures?: ContractExportSignatures,
  seal?: ContractExportSealOptions,
) {
  const labels = {
    generatedAt: language === "en" ? "Generated At" : "生成时间",
    type: language === "en" ? "Contract Type" : "合同类型",
    legalBasis: language === "en" ? "Legal Basis" : "法律依据",
    disclaimer: language === "en" ? "Disclaimer" : "声明",
    signatures: language === "en" ? "Signature Records" : "电子签署记录",
    partyA: language === "en" ? "Party A (Sender)" : "甲方（发起方）",
    partyB: language === "en" ? "Party B (Counterparty)" : "乙方（对方）",
    signer: language === "en" ? "Signer" : "签署人",
    signDate: language === "en" ? "Signed At" : "签署时间",
    method: language === "en" ? "Method" : "签署方式",
    source: language === "en" ? "Source" : "来源",
    sealTitle: language === "en" ? "Seal Record" : "盖章记录",
    stampedAt: language === "en" ? "Stamped At" : "盖章时间",
    stampedBy: language === "en" ? "Stamped By" : "盖章人",
    stampSource: language === "en" ? "Seal Source" : "印章来源",
    stampFile: language === "en" ? "Seal File" : "印章文件",
    sealNote: language === "en" ? "Seal Note" : "盖章备注",
  };
  const lines: string[] = [];

  lines.push(contract.title || (language === "en" ? "Contract Draft" : "合同草稿"));
  lines.push("");
  lines.push(
    `${labels.generatedAt}: ${new Date().toLocaleString(language === "en" ? "en-US" : "zh-CN")}`,
  );

  if (contract.contractType) {
    lines.push(`${labels.type}: ${contract.contractType}`);
  }
  if (contract.legalBasis) {
    lines.push(`${labels.legalBasis}: ${contract.legalBasis}`);
  }

  lines.push("");

  [...contract.sections]
    .sort((left, right) => left.order - right.order)
    .forEach((section, index) => {
      lines.push(`${index + 1}. ${section.title}`);
      section.content.split(/\r?\n/).forEach((paragraph) => {
        lines.push(paragraph.trim());
      });
      lines.push("");
    });

  if (contract.disclaimer) {
    lines.push(labels.disclaimer);
    contract.disclaimer.split(/\r?\n/).forEach((paragraph) => {
      lines.push(paragraph.trim());
    });
    lines.push("");
  }

  const appendParty = (
    title: string,
    signature: ContractExportSignatureRecord | undefined,
  ) => {
    if (!signature) {
      return;
    }

    lines.push(title);
    lines.push(`${labels.signer}: ${signature.signerName}`);
    lines.push(`${labels.signDate}: ${formatSignatureDate(signature.createdAt, language)}`);
    lines.push(`${labels.method}: ${normalizeSignatureMethodLabel(signature.method, language)}`);
    lines.push(`${labels.source}: ${signature.source || "-"}`);
    lines.push("");
  };

  const hasAnySignature = Boolean(signatures?.sender || signatures?.counterparty);
  if (hasAnySignature) {
    lines.push(labels.signatures);
    appendParty(labels.partyA, signatures?.sender);
    appendParty(labels.partyB, signatures?.counterparty);
  }

  const sealImageDataUrl = sanitizeSignatureImageDataUrl(seal?.stamp?.imageDataUrl);
  if (sealImageDataUrl) {
    lines.push(labels.sealTitle);
    lines.push(`${labels.stampedAt}: ${formatSignatureDate(seal?.stampedAt, language)}`);
    lines.push(`${labels.stampedBy}: ${seal?.stampedBy || "-"}`);
    lines.push(`${labels.stampSource}: ${seal?.stamp?.source || "-"}`);
    lines.push(`${labels.stampFile}: ${seal?.stamp?.fileName || "-"}`);
    if (seal?.note) {
      lines.push(`${labels.sealNote}: ${seal.note}`);
    }
    lines.push("");
  }

  return lines;
}

function getDisplayWidth(value: string) {
  return Array.from(value).reduce((width, char) => {
    return width + (/[^\u0000-\u00FF]/.test(char) ? 2 : 1);
  }, 0);
}

function wrapPdfLine(value: string, maxWidth: number) {
  if (!value.trim()) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const char of Array.from(value)) {
    const next = `${current}${char}`;
    if (getDisplayWidth(next) > maxWidth) {
      if (current) {
        lines.push(current);
      }
      current = char;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function buildPdfContentStreams(lines: string[]) {
  const pageHeight = 842;
  const marginTop = 56;
  const marginBottom = 56;
  const lineHeight = 18;
  const maxLinesPerPage = Math.floor((pageHeight - marginTop - marginBottom) / lineHeight);
  const pages: string[][] = [];
  let currentPage: string[] = [];

  lines.forEach((line) => {
    wrapPdfLine(line, 64).forEach((wrappedLine) => {
      if (currentPage.length >= maxLinesPerPage) {
        pages.push(currentPage);
        currentPage = [];
      }
      currentPage.push(wrappedLine);
    });
  });

  if (currentPage.length === 0) {
    currentPage.push("");
  }
  pages.push(currentPage);

  return pages.map((pageLines) => {
    const commands = ["BT", "/F1 12 Tf", "50 786 Td", "18 TL"];

    pageLines.forEach((line, index) => {
      if (index > 0) {
        commands.push("T*");
      }

      if (!line) {
        return;
      }

      commands.push(`<${encodePdfHexString(line)}> Tj`);
    });

    commands.push("ET");
    return commands.join("\n");
  });
}

export function buildContractPdfBuffer(
  contract: ContractContent,
  options?: {
    language?: SupportedLanguage;
    signatures?: ContractExportSignatures;
    seal?: ContractExportSealOptions;
  },
) {
  const streams = buildPdfContentStreams(
    buildPdfTextLines(
      contract,
      options?.language || "zh",
      options?.signatures,
      options?.seal,
    ),
  );
  const fontObjectId = 3 + streams.length * 2;
  const descendantFontObjectId = fontObjectId + 1;
  const objects: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${streams
      .map((_, index) => `${3 + index * 2} 0 R`)
      .join(" ")}] /Count ${streams.length} >>`,
  );

  streams.forEach((stream, index) => {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
  });

  objects.push(
    `<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${descendantFontObjectId} 0 R] >>`,
  );
  objects.push(
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /DW 1000 >>",
  );

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
