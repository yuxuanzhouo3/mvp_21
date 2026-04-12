import "server-only";

import fs from "node:fs";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import type { ContractContent } from "@/lib/ai/types";
import { isChinaRegion } from "@/lib/config/region";
import { buildContractPdfBuffer as buildLegacyContractPdfBuffer } from "@/lib/contracts/format";

type SupportedLanguage = "zh" | "en";

function hasCjkCharacters(value: string): boolean {
  return /[\u3400-\u9FFF]/.test(value);
}

function collectContractText(contract: ContractContent): string {
  const sectionsText = contract.sections
    .map((section) => `${section.title}\n${section.content}`)
    .join("\n");

  return [
    contract.title,
    contract.contractType || "",
    contract.legalBasis || "",
    contract.disclaimer || "",
    sectionsText,
  ].join("\n");
}

function resolvePreferredLanguage(
  contract: ContractContent,
  language?: SupportedLanguage,
): SupportedLanguage {
  if (language) {
    return language;
  }

  if (hasCjkCharacters(collectContractText(contract))) {
    return "zh";
  }

  return isChinaRegion() ? "zh" : "en";
}

function normalizePdfText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPdfTextLines(contract: ContractContent, language: SupportedLanguage) {
  const labels = {
    generatedAt: language === "en" ? "Generated At" : "生成时间",
    type: language === "en" ? "Contract Type" : "合同类型",
    legalBasis: language === "en" ? "Legal Basis" : "法律依据",
    disclaimer: language === "en" ? "Disclaimer" : "声明",
    signatures: language === "en" ? "Signature Blocks" : "签署栏",
    partyA: language === "en" ? "Party A" : "甲方",
    partyB: language === "en" ? "Party B" : "乙方",
    signDate: language === "en" ? "Date" : "日期",
    blankDate: language === "en" ? "_______ / _____ / _____" : "_______年___月___日",
  };
  const lines: string[] = [];

  lines.push(
    normalizePdfText(contract.title || (language === "en" ? "Contract Draft" : "合同草稿")),
  );
  lines.push("");
  lines.push(
    `${labels.generatedAt}: ${new Date().toLocaleString(language === "en" ? "en-US" : "zh-CN")}`,
  );

  if (contract.contractType) {
    lines.push(`${labels.type}: ${normalizePdfText(String(contract.contractType))}`);
  }
  if (contract.legalBasis) {
    lines.push(`${labels.legalBasis}: ${normalizePdfText(contract.legalBasis)}`);
  }

  lines.push("");

  [...contract.sections]
    .sort((left, right) => left.order - right.order)
    .forEach((section, index) => {
      lines.push(`${index + 1}. ${normalizePdfText(section.title)}`);
      section.content.split(/\r?\n/).forEach((paragraph) => {
        lines.push(normalizePdfText(paragraph));
      });
      lines.push("");
    });

  if (contract.disclaimer) {
    lines.push(labels.disclaimer);
    contract.disclaimer.split(/\r?\n/).forEach((paragraph) => {
      lines.push(normalizePdfText(paragraph));
    });
    lines.push("");
  }

  lines.push(labels.signatures);
  lines.push(`${labels.partyA}: ______________________________`);
  lines.push(`${labels.signDate}: ${labels.blankDate}`);
  lines.push("");
  lines.push(`${labels.partyB}: ______________________________`);
  lines.push(`${labels.signDate}: ${labels.blankDate}`);

  return lines;
}

function splitLineByWidth(value: string, font: PDFFont, fontSize: number, maxWidth: number) {
  if (!value.trim()) {
    return [""];
  }

  const result: string[] = [];
  let current = "";

  for (const char of Array.from(value)) {
    const next = `${current}${char}`;
    if (font.widthOfTextAtSize(next, fontSize) > maxWidth) {
      if (current) {
        result.push(current);
      }
      current = char;
    } else {
      current = next;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

function tryReadFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
  } catch {
    // Ignore and continue trying next path.
  }

  return null;
}

function loadChineseFontBuffer() {
  const candidates = [
    process.env.CONTRACT_PDF_FONT_PATH,
    "C:\\Windows\\Fonts\\simhei.ttf",
    "C:\\Windows\\Fonts\\simsun.ttf",
    "C:\\Windows\\Fonts\\NotoSansSC-VF.ttf",
    "C:\\Windows\\Fonts\\msyh.ttf",
    "C:\\Windows\\Fonts\\msyh.ttc",
    "C:\\Windows\\Fonts\\simsunb.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansCJKsc-Regular.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
  ].filter((item): item is string => Boolean(item && item.trim()));

  for (const filePath of candidates) {
    const buffer = tryReadFile(filePath);
    if (buffer) {
      return buffer;
    }
  }

  return null;
}

async function buildModernPdfBuffer(
  contract: ContractContent,
  language: SupportedLanguage,
  chineseFontBuffer?: Buffer | null,
) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const font =
    chineseFontBuffer && language === "zh"
      ? await pdfDoc.embedFont(chineseFontBuffer, { subset: false })
      : await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fontSize = 12;
  const lineHeight = 18;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 50;
  const marginTop = 56;
  const marginBottom = 56;
  const maxTextWidth = pageWidth - marginX * 2;
  const maxLinesPerPage = Math.floor((pageHeight - marginTop - marginBottom) / lineHeight);
  const wrappedLines = buildPdfTextLines(contract, language).flatMap((line) =>
    splitLineByWidth(line, font, fontSize, maxTextWidth),
  );

  let index = 0;
  while (index < wrappedLines.length) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const currentLines = wrappedLines.slice(index, index + maxLinesPerPage);
    let y = pageHeight - marginTop;

    currentLines.forEach((line) => {
      if (line) {
        page.drawText(line, {
          x: marginX,
          y,
          font,
          size: fontSize,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
      y -= lineHeight;
    });

    index += maxLinesPerPage;
  }

  if (wrappedLines.length === 0) {
    pdfDoc.addPage([pageWidth, pageHeight]);
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function buildContractPdfBuffer(
  contract: ContractContent,
  options?: {
    language?: SupportedLanguage;
  },
) {
  const language = resolvePreferredLanguage(contract, options?.language);
  const chineseFontBuffer = language === "zh" ? loadChineseFontBuffer() : null;

  if (language === "zh" && !chineseFontBuffer) {
    // Avoid rendering Chinese with Helvetica (which lacks CJK glyphs).
    // Fall back to the legacy PDF writer that uses STSong-Light.
    return buildLegacyContractPdfBuffer(contract, { language });
  }

  try {
    return await buildModernPdfBuffer(contract, language, chineseFontBuffer);
  } catch (error) {
    console.error("[contracts/pdf] Modern PDF generation failed, fallback to legacy writer:", error);
    return buildLegacyContractPdfBuffer(contract, { language });
  }
}
