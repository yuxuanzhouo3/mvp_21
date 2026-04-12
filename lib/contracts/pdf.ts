import "server-only";

import fs from "node:fs";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";

import type { ContractContent } from "@/lib/ai/types";
import { isChinaRegion } from "@/lib/config/region";
import type {
  ContractExportSignatureRecord,
  ContractExportSignatures,
} from "@/lib/contracts/export-signatures";
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

function sanitizeSignatureImageDataUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^data:image\/(png|jpe?g);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
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

function decodeSignatureImageDataUrl(dataUrl: string) {
  const matched = /^data:image\/(png|jpe?g);base64,([a-z0-9+/=]+)$/i.exec(dataUrl);
  if (!matched) {
    return null;
  }

  return {
    format: matched[1].toLowerCase() as "png" | "jpg" | "jpeg",
    bytes: Buffer.from(matched[2], "base64"),
  };
}

function buildPdfTextLines(
  contract: ContractContent,
  language: SupportedLanguage,
  signatures?: ContractExportSignatures,
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
    typed: language === "en" ? "Typed Name" : "输入签名",
    image: language === "en" ? "Image" : "签名图片",
    unsigned: language === "en" ? "Pending signature" : "待签署",
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

  const appendParty = (
    title: string,
    signature: ContractExportSignatureRecord | undefined,
  ) => {
    lines.push(title);
    if (!signature) {
      lines.push(`${labels.signer}: ${labels.unsigned}`);
      lines.push(`${labels.signDate}: ${labels.blankDate}`);
      lines.push("");
      return;
    }

    lines.push(`${labels.signer}: ${normalizePdfText(signature.signerName || labels.unsigned)}`);
    lines.push(`${labels.signDate}: ${formatSignatureDate(signature.createdAt, language)}`);
    lines.push(`${labels.method}: ${normalizeSignatureMethodLabel(signature.method, language)}`);
    lines.push(`${labels.source}: ${normalizePdfText(signature.source || "-")}`);
    if (signature.typedName) {
      lines.push(`${labels.typed}: ${normalizePdfText(signature.typedName)}`);
    }
    if (sanitizeSignatureImageDataUrl(signature.imageDataUrl)) {
      lines.push(`${labels.image}: ${language === "en" ? "Attached below" : "见后续附图"}`);
    }
    lines.push("");
  };

  lines.push(labels.signatures);
  appendParty(labels.partyA, signatures?.sender);
  appendParty(labels.partyB, signatures?.counterparty);

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

async function appendSignatureImagePages(args: {
  pdfDoc: PDFDocument;
  language: SupportedLanguage;
  signatures?: ContractExportSignatures;
  font: PDFFont;
}) {
  const { pdfDoc, language, signatures, font } = args;
  const labels = {
    sectionTitle: language === "en" ? "Signature Image Records" : "电子签名图像记录",
    signer: language === "en" ? "Signer" : "签署人",
    signedAt: language === "en" ? "Signed At" : "签署时间",
    partyA: language === "en" ? "Party A (Sender)" : "甲方（发起方）",
    partyB: language === "en" ? "Party B (Counterparty)" : "乙方（对方）",
  };
  const sourceEntries = [
    { title: labels.partyA, signature: signatures?.sender },
    { title: labels.partyB, signature: signatures?.counterparty },
  ];

  const entries: Array<{
    title: string;
    signature: ContractExportSignatureRecord;
    image: PDFImage;
  }> = [];

  for (const entry of sourceEntries) {
    if (!entry.signature) {
      continue;
    }

    const dataUrl = sanitizeSignatureImageDataUrl(entry.signature.imageDataUrl);
    if (!dataUrl) {
      continue;
    }

    const decoded = decodeSignatureImageDataUrl(dataUrl);
    if (!decoded) {
      continue;
    }

    try {
      const image =
        decoded.format === "png"
          ? await pdfDoc.embedPng(decoded.bytes)
          : await pdfDoc.embedJpg(decoded.bytes);
      entries.push({
        title: entry.title,
        signature: entry.signature,
        image,
      });
    } catch {
      // Skip invalid signature image payload and keep text records.
    }
  }

  if (entries.length === 0) {
    return;
  }

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 50;
  const marginTop = 56;
  const marginBottom = 56;
  const textColor = rgb(0.1, 0.1, 0.1);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - marginTop;

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY - requiredHeight < marginBottom) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - marginTop;
    }
  };

  page.drawText(labels.sectionTitle, {
    x: marginX,
    y: cursorY,
    font,
    size: 14,
    color: textColor,
  });
  cursorY -= 28;

  for (const entry of entries) {
    const imageOriginal = entry.image.scale(1);
    const imageMaxWidth = pageWidth - marginX * 2 - 16;
    const imageMaxHeight = 132;
    const scale = Math.min(
      imageMaxWidth / imageOriginal.width,
      imageMaxHeight / imageOriginal.height,
      1,
    );
    const imageWidth = imageOriginal.width * scale;
    const imageHeight = imageOriginal.height * scale;
    const frameHeight = imageMaxHeight + 16;
    const blockHeight = 88 + frameHeight;

    ensureSpace(blockHeight);

    page.drawText(entry.title, {
      x: marginX,
      y: cursorY,
      font,
      size: 12,
      color: textColor,
    });
    cursorY -= 18;

    page.drawText(
      `${labels.signer}: ${normalizePdfText(entry.signature.signerName || "-")}`,
      {
        x: marginX,
        y: cursorY,
        font,
        size: 10,
        color: textColor,
      },
    );
    cursorY -= 14;

    page.drawText(
      `${labels.signedAt}: ${formatSignatureDate(entry.signature.createdAt, language)}`,
      {
        x: marginX,
        y: cursorY,
        font,
        size: 10,
        color: textColor,
      },
    );
    cursorY -= 18;

    const frameTop = cursorY;
    const frameBottom = frameTop - frameHeight;
    page.drawRectangle({
      x: marginX,
      y: frameBottom,
      width: imageMaxWidth + 16,
      height: frameHeight,
      borderColor: rgb(0.86, 0.86, 0.86),
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });

    page.drawImage(entry.image, {
      x: marginX + 8 + (imageMaxWidth - imageWidth) / 2,
      y: frameBottom + 8 + (imageMaxHeight - imageHeight) / 2,
      width: imageWidth,
      height: imageHeight,
    });

    cursorY = frameBottom - 16;
  }
}

async function buildModernPdfBuffer(
  contract: ContractContent,
  language: SupportedLanguage,
  chineseFontBuffer?: Buffer | null,
  signatures?: ContractExportSignatures,
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
  const wrappedLines = buildPdfTextLines(contract, language, signatures).flatMap((line) =>
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

  await appendSignatureImagePages({
    pdfDoc,
    language,
    signatures,
    font,
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function buildContractPdfBuffer(
  contract: ContractContent,
  options?: {
    language?: SupportedLanguage;
    signatures?: ContractExportSignatures;
  },
) {
  const language = resolvePreferredLanguage(contract, options?.language);
  const chineseFontBuffer = language === "zh" ? loadChineseFontBuffer() : null;

  if (language === "zh" && !chineseFontBuffer) {
    // Avoid rendering Chinese with Helvetica (which lacks CJK glyphs).
    // Fall back to the legacy PDF writer that uses STSong-Light.
    return buildLegacyContractPdfBuffer(contract, {
      language,
      signatures: options?.signatures,
    });
  }

  try {
    return await buildModernPdfBuffer(
      contract,
      language,
      chineseFontBuffer,
      options?.signatures,
    );
  } catch (error) {
    console.error("[contracts/pdf] Modern PDF generation failed, fallback to legacy writer:", error);
    return buildLegacyContractPdfBuffer(contract, {
      language,
      signatures: options?.signatures,
    });
  }
}
