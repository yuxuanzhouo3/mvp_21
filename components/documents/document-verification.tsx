"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Shield,
  Share2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  createDashboardDocumentShare,
  downloadDashboardDocument,
  downloadDashboardDocumentCertificate,
  downloadPublicDashboardDocumentCertificate,
  revokeDashboardDocumentShare,
} from "@/lib/dashboard/client";
import type { DashboardDocumentVerificationData } from "@/lib/dashboard/types";

interface DocumentVerificationProps {
  data: DashboardDocumentVerificationData;
  publicMode?: boolean;
  shareToken?: string;
}

function getDocumentTypeLabel(type: string, isEn: boolean) {
  if (type === "contract") return isEn ? "Contract" : "合同";
  if (type === "draft") return isEn ? "Draft" : "草稿";
  return isEn ? "Uploaded Document" : "上传文档";
}

function formatDateTime(value: string | undefined, isEn: boolean) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(isEn ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShareExpiry(expiresAt: string | undefined, isEn: boolean) {
  return expiresAt ? formatDateTime(expiresAt, isEn) : isEn ? "No expiry" : "长期有效";
}

function isShareExpired(expiresAt: string | undefined) {
  if (!expiresAt) return false;
  const parsed = new Date(expiresAt).getTime();
  return Number.isFinite(parsed) && parsed <= Date.now();
}

export function DocumentVerification({
  data,
  publicMode = false,
  shareToken,
}: DocumentVerificationProps) {
  const { language } = useLanguage();
  const isEn = language === "en";
  const { document } = data;

  const [downloadingCertificate, setDownloadingCertificate] = useState(false);
  const [downloadingDocument, setDownloadingDocument] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [shareUrl, setShareUrl] = useState(data.shareUrl || document.shareUrl || "");
  const [shareExpiresAt, setShareExpiresAt] = useState(data.shareExpiresAt || document.shareExpiresAt);
  const [shareAccessCount, setShareAccessCount] = useState(data.shareAccessCount ?? document.shareAccessCount ?? 0);
  const [shareLastAccessedAt, setShareLastAccessedAt] = useState(data.shareLastAccessedAt || document.shareLastAccessedAt);

  const shareExpired = !shareUrl && isShareExpired(shareExpiresAt);

  const handleDownloadCertificate = async () => {
    try {
      setDownloadingCertificate(true);
      if (publicMode && shareToken) {
        await downloadPublicDashboardDocumentCertificate(shareToken);
      } else {
        await downloadDashboardDocumentCertificate(document.id);
      }
    } catch (error) {
      console.error("[DocumentVerification] Failed to download certificate:", error);
      toast.error(isEn ? "Failed to download certificate." : "下载证书失败。");
    } finally {
      setDownloadingCertificate(false);
    }
  };

  const handleDownloadDocument = async () => {
    try {
      setDownloadingDocument(true);
      await downloadDashboardDocument(document.id);
    } catch (error) {
      console.error("[DocumentVerification] Failed to download document:", error);
      toast.error(isEn ? "Failed to download document." : "下载文档失败。");
    } finally {
      setDownloadingDocument(false);
    }
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      if (publicMode) {
        if (!shareUrl) {
          toast.error(isEn ? "Share link is unavailable." : "分享链接不可用。");
          return;
        }
        await navigator.clipboard.writeText(shareUrl);
        toast.success(isEn ? "Share link copied." : "分享链接已复制。");
        return;
      }

      const result = shareUrl ? null : await createDashboardDocumentShare(document.id);
      const targetUrl = shareUrl || result?.shareUrl;
      if (!targetUrl) {
        toast.error(isEn ? "Share link is unavailable." : "分享链接不可用。");
        return;
      }

      if (result) {
        setShareUrl(result.shareUrl);
        setShareExpiresAt(result.expiresAt);
        setShareAccessCount(result.accessCount);
      }

      await navigator.clipboard.writeText(targetUrl);
      toast.success(isEn ? "Share link copied." : "分享链接已复制。");
    } catch (error) {
      console.error("[DocumentVerification] Failed to create share link:", error);
      toast.error(isEn ? "Failed to create share link." : "生成分享链接失败。");
    } finally {
      setSharing(false);
    }
  };

  const handleRevokeShare = async () => {
    try {
      setRevoking(true);
      await revokeDashboardDocumentShare(document.id);
      setShareUrl("");
      setShareExpiresAt(undefined);
      setShareAccessCount(0);
      setShareLastAccessedAt(undefined);
      toast.success(isEn ? "Share link revoked." : "分享链接已撤销。");
    } catch (error) {
      console.error("[DocumentVerification] Failed to revoke share link:", error);
      toast.error(isEn ? "Failed to revoke share link." : "撤销分享链接失败。");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {publicMode ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Share2 className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="mb-2 text-2xl font-bold text-primary">
                      {isEn ? "Shared Verification Certificate" : "公开验真证书页"}
                    </h2>
                    <p className="text-muted-foreground">
                      {isEn
                        ? "This public page exposes the verification result and evidence summary only."
                        : "这个公开页面仅展示验真结果与证据摘要，不包含后台管理能力。"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className={document.verificationStatus === "verified" ? "border-accent bg-accent/5" : "border-amber-200 bg-amber-50/60"}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className={`rounded-full p-3 ${document.verificationStatus === "verified" ? "bg-accent/10" : "bg-amber-100"}`}>
                  <CheckCircle className={`h-8 w-8 ${document.verificationStatus === "verified" ? "text-accent" : "text-amber-700"}`} />
                </div>
                <div className="flex-1">
                  <h2 className={`mb-2 text-2xl font-bold ${document.verificationStatus === "verified" ? "text-accent" : "text-amber-900"}`}>
                    {document.verificationStatus === "verified"
                      ? isEn
                        ? "Document Verified"
                        : "文档已验真"
                      : isEn
                        ? "Verification In Progress"
                        : "验真处理中"}
                  </h2>
                  <p className="mb-4 text-muted-foreground">{data.integritySummary}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={document.verificationStatus === "verified" ? "border-accent/20 bg-accent/10 text-accent" : "border-amber-200 bg-amber-100 text-amber-800"}>
                      {document.verificationStatus === "verified" ? (isEn ? "Verified" : "已验真") : isEn ? "Pending" : "待完成"}
                    </Badge>
                    <Badge className="border-accent/20 bg-accent/10 text-accent">
                      {isEn ? "Hash Recorded" : "哈希已记录"}
                    </Badge>
                    <Badge className="border-accent/20 bg-accent/10 text-accent">
                      {isEn ? "Evidence Retained" : "证据已留存"}
                    </Badge>
                    <Badge variant="outline">
                      {document.sourceKind === "contract" ? (isEn ? "Contract Workflow" : "合同流程") : isEn ? "Independent Upload" : "独立上传"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <FileText className="h-5 w-5 text-primary" />
                {isEn ? "Document Information" : "文档信息"}
              </h3>
              <div className="space-y-3">
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Document Name" : "文档名称"}</span>
                  <span className="break-words text-sm font-medium">{document.fileName}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Display Title" : "展示标题"}</span>
                  <span className="break-words text-sm font-medium">{document.title}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Document Type" : "文档类型"}</span>
                  <span className="text-sm font-medium">{getDocumentTypeLabel(document.documentType, isEn)}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Category" : "分类"}</span>
                  <span className="text-sm font-medium">{document.category}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Group" : "分组"}</span>
                  <span className="text-sm font-medium">{document.groupName || "-"}</span>
                </div>
                <div className="flex flex-col gap-2 border-b border-border py-2 sm:flex-row sm:items-start sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Tags" : "标签"}</span>
                  <div className="flex flex-wrap gap-2 sm:max-w-[70%] sm:justify-end">
                    {document.tags.length > 0 ? (
                      document.tags.map((tag) => (
                        <Badge key={`${document.id}-${tag}`} variant="secondary">
                          #{tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm font-medium">-</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "File Size" : "文件大小"}</span>
                  <span className="text-sm font-medium">{document.sizeLabel}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Pages" : "页数"}</span>
                  <span className="text-sm font-medium">{document.pageCount}</span>
                </div>
                <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Document ID" : "文档编号"}</span>
                  <span className="text-sm font-mono">{`DOC-${document.id}`}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <Shield className="h-5 w-5 text-primary" />
                {isEn ? "Integrity Verification" : "完整性校验"}
              </h3>
              <div className="space-y-3">
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Source Type" : "来源类型"}</span>
                  <span className="text-sm font-medium">{document.sourceType || "-"}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="text-sm text-muted-foreground">{isEn ? "Document Hash (SHA-256)" : "文档哈希 (SHA-256)"}</span>
                  <span className="max-w-full break-all text-sm font-mono sm:max-w-[70%] sm:text-right">{data.contentHash}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Storage Provider" : "存储提供方"}</span>
                  <span className="text-sm font-medium">{document.storageProvider || "-"}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Contract Status" : "合同状态"}</span>
                  <span className="text-sm font-medium">{document.contractStatus || "-"}</span>
                </div>
                <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{isEn ? "Signing Flow" : "签署流程"}</span>
                  <span className="text-sm font-medium">{document.signFlowStatus || "-"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <Users className="h-5 w-5 text-primary" />
                {isEn ? "Signature Verification" : "签署验真"}
              </h3>
              {data.signatures.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {isEn ? "No signature records are attached to this document." : "当前文档没有附带签署记录。"}
                </div>
              ) : (
                <div className="space-y-4">
                  {data.signatures.map((signature) => (
                    <div key={signature.id} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 text-accent" />
                      <div className="flex-1">
                        <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-medium">{signature.signerName}</p>
                          <Badge className={signature.status === "confirmed" ? "border-accent/20 bg-accent/10 text-accent" : ""}>
                            {signature.status === "confirmed" ? (isEn ? "Confirmed" : "已确认") : isEn ? "Pending" : "待确认"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {signature.role === "sender" ? (isEn ? "Sender" : "发起方") : isEn ? "Counterparty" : "对方"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isEn ? "Method" : "方式"}: {signature.method || "-"}
                          {signature.source ? ` | ${signature.source}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isEn ? "Recorded At" : "记录时间"}: {formatDateTime(signature.createdAt, isEn)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {data.evidence.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold">
                  <Shield className="h-5 w-5 text-primary" />
                  {isEn ? "Evidence Records" : "证据记录"}
                </h3>
                <div className="space-y-3">
                  {data.evidence.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{item.label}</p>
                        <Badge variant="outline">{item.type}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(item.createdAt, isEn)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-4 font-semibold">{isEn ? "Actions" : "操作"}</h3>
              <div className="space-y-2">
                {!publicMode ? (
                  <Button className="w-full bg-transparent" variant="outline" onClick={() => void handleDownloadDocument()} disabled={downloadingDocument}>
                    <Download className="mr-2 h-4 w-4" />
                    {downloadingDocument ? (isEn ? "Preparing Document..." : "正在准备文档...") : isEn ? "Download Document" : "下载文档"}
                  </Button>
                ) : null}
                <Button className="w-full bg-transparent" variant="outline" onClick={() => void handleDownloadCertificate()} disabled={downloadingCertificate}>
                  <Download className="mr-2 h-4 w-4" />
                  {downloadingCertificate ? (isEn ? "Preparing Certificate..." : "正在生成证书...") : isEn ? "Download Certificate" : "下载验真证书"}
                </Button>
                <Button className="w-full bg-transparent" variant="outline" onClick={() => void handleShare()} disabled={sharing}>
                  <Copy className="mr-2 h-4 w-4" />
                  {sharing ? (isEn ? "Preparing Share Link..." : "正在准备分享链接...") : isEn ? "Copy Share Link" : "复制分享链接"}
                </Button>
                {!publicMode && (shareUrl || shareExpiresAt) ? (
                  <Button className="w-full bg-transparent" variant="outline" onClick={() => void handleRevokeShare()} disabled={revoking}>
                    <Share2 className="mr-2 h-4 w-4" />
                    {revoking ? (isEn ? "Revoking..." : "撤销中...") : isEn ? "Revoke Share Link" : "撤销分享链接"}
                  </Button>
                ) : null}
                {shareUrl ? (
                  <Button className="w-full bg-transparent" variant="outline" asChild>
                    <a href={shareUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {isEn ? "Open Shared Page" : "打开分享页"}
                    </a>
                  </Button>
                ) : null}
                {!publicMode && document.contractId ? (
                  <Button className="w-full bg-transparent" variant="outline" asChild>
                    <Link href={`/contracts/${document.contractId}?ctx=dashboard`}>
                      <FileText className="mr-2 h-4 w-4" />
                      {isEn ? "Open Contract" : "打开合同"}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <Share2 className="h-5 w-5 text-primary" />
                {isEn ? "Share Status" : "分享状态"}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{isEn ? "Status" : "状态"}</span>
                  <Badge variant={shareExpired ? "secondary" : "outline"}>
                    {shareUrl ? (isEn ? "Active" : "有效") : shareExpired ? (isEn ? "Expired" : "已过期") : isEn ? "Not Shared" : "未分享"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{isEn ? "Effective Until" : "有效截止"}</span>
                  <span>{formatShareExpiry(shareExpiresAt, isEn)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{isEn ? "Visit Count" : "访问次数"}</span>
                  <span>{shareAccessCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{isEn ? "Last Visit" : "最近访问"}</span>
                  <span>{formatDateTime(shareLastAccessedAt, isEn)}</span>
                </div>
                {shareUrl ? (
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                    <div className="mb-1">{isEn ? "Share URL" : "分享链接"}</div>
                    <div className="break-all">{shareUrl}</div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <Calendar className="h-5 w-5 text-primary" />
                {isEn ? "Timeline" : "时间线"}
              </h3>
              <div className="space-y-4">
                {data.timeline.map((item, index) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-accent" />
                      {index < data.timeline.length - 1 ? <div className="h-full w-px bg-border" /> : null}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(item.occurredAt, isEn)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="mb-1 font-semibold">{isEn ? "Security" : "安全"}</h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {isEn ? "The verification result comes from the stored hash snapshot, retained evidence, and current document metadata." : "验真结果来自已留存的哈希快照、证据记录和当前文档元数据。"}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{isEn ? "SHA-256 Hash" : "SHA-256 哈希"}</span>
                      <CheckCircle className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{isEn ? "Evidence Trail" : "证据链"}</span>
                      <CheckCircle className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{isEn ? "Audit Timeline" : "审计时间线"}</span>
                      <CheckCircle className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{isEn ? "Metadata Retention" : "元数据留存"}</span>
                      <CheckCircle className="h-4 w-4 text-accent" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {data.finalCopy ? (
            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-2 font-semibold">{isEn ? "Retained Final Copy" : "留存电子定稿"}</h3>
                <p className="text-sm font-medium">{data.finalCopy.filename}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(data.finalCopy.createdAt, isEn)}</p>
                <p className="mt-2 text-xs text-muted-foreground">{data.finalCopy.note}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="mb-1 font-semibold text-primary">{isEn ? "Evidence Summary" : "证据摘要"}</h3>
                  <p className="text-xs text-muted-foreground">
                    {isEn ? `This verification page is backed by ${data.evidence.length} evidence records and ${data.timeline.length} timeline events.` : `当前验真页基于 ${data.evidence.length} 条证据记录和 ${data.timeline.length} 个时间线事件生成。`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
