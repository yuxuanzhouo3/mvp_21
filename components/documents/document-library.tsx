"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Copy,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Pencil,
  Search,
  Share2,
  Shield,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  batchOrganizeDashboardDocuments,
  batchUpdateDashboardDocumentTags,
  createDashboardDocumentShare,
  deleteDashboardDocument,
  downloadDashboardDocument,
  revokeDashboardDocumentShare,
  updateDashboardDocument,
  uploadDashboardDocument,
} from "@/lib/dashboard/client";
import type { DashboardDocumentItem } from "@/lib/dashboard/types";

interface DocumentLibraryProps {
  documents: DashboardDocumentItem[];
  onDocumentsChanged?: () => Promise<void> | void;
}

type ShareExpiryMode = "never" | "7" | "30" | "90";

function getDocumentTypeLabel(documentType: DashboardDocumentItem["documentType"], isEn: boolean) {
  if (documentType === "contract") return isEn ? "Contract" : "合同";
  if (documentType === "draft") return isEn ? "Draft" : "草稿";
  return isEn ? "Uploaded Document" : "上传文档";
}

function splitTags(value: string) {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 10);
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

function inferShareExpiryMode(expiresAt: string | undefined): ShareExpiryMode {
  if (!expiresAt) return "never";
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 10) return "7";
  if (diffDays <= 45) return "30";
  return "90";
}

function isShareExpired(expiresAt: string | undefined) {
  if (!expiresAt) return false;
  const parsed = new Date(expiresAt).getTime();
  return Number.isFinite(parsed) && parsed <= Date.now();
}

export function DocumentLibrary({ documents, onDocumentsChanged }: DocumentLibraryProps) {
  const { language } = useLanguage();
  const isEn = language === "en";

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [downloadingId, setDownloadingId] = useState("");
  const [sharingId, setSharingId] = useState("");
  const [revokingShareId, setRevokingShareId] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("General");
  const [uploadGroupName, setUploadGroupName] = useState("Workspace");
  const [uploadTags, setUploadTags] = useState("");
  const [selectedUploadedIds, setSelectedUploadedIds] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DashboardDocumentItem | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editGroupName, setEditGroupName] = useState("");
  const [editTags, setEditTags] = useState("");
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagMode, setTagMode] = useState<"add" | "replace" | "remove">("add");
  const [tagInput, setTagInput] = useState("");
  const [updatingTags, setUpdatingTags] = useState(false);
  const [organizeDialogOpen, setOrganizeDialogOpen] = useState(false);
  const [batchCategory, setBatchCategory] = useState("");
  const [batchGroupName, setBatchGroupName] = useState("");
  const [updatingOrganization, setUpdatingOrganization] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<DashboardDocumentItem | null>(null);
  const [shareExpiryMode, setShareExpiryMode] = useState<ShareExpiryMode>("30");
  const [deleteTarget, setDeleteTarget] = useState<DashboardDocumentItem | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(documents.map((doc) => doc.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [documents],
  );

  const groups = useMemo(
    () =>
      Array.from(
        new Set(
          documents
            .map((doc) => doc.groupName)
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [documents],
  );

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchesQuery =
        !normalizedQuery ||
        doc.title.toLowerCase().includes(normalizedQuery) ||
        doc.fileName.toLowerCase().includes(normalizedQuery) ||
        doc.hash.toLowerCase().includes(normalizedQuery) ||
        doc.category.toLowerCase().includes(normalizedQuery) ||
        (doc.groupName || "").toLowerCase().includes(normalizedQuery) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
      const matchesFilter =
        filter === "all" ||
        (filter === "verified" && doc.verificationStatus === "verified") ||
        (filter === "pending" && doc.verificationStatus === "pending") ||
        (filter === "draft" && doc.documentType === "draft") ||
        (filter === "contract" && doc.documentType === "contract") ||
        (filter === "uploaded" && doc.documentType === "uploaded");
      const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
      const matchesGroup = groupFilter === "all" || (doc.groupName || "Workspace") === groupFilter;
      return matchesQuery && matchesFilter && matchesCategory && matchesGroup;
    });
  }, [categoryFilter, documents, filter, groupFilter, query]);

  const visibleUploadedIds = useMemo(
    () => filteredDocuments.filter((doc) => doc.sourceKind === "uploaded").map((doc) => doc.id),
    [filteredDocuments],
  );

  useEffect(() => {
    setSelectedUploadedIds((current) => current.filter((id) => documents.some((doc) => doc.id === id)));
  }, [documents]);

  const allVisibleUploadsSelected =
    visibleUploadedIds.length > 0 && visibleUploadedIds.every((id) => selectedUploadedIds.includes(id));

  const handleDownload = async (documentId: string) => {
    try {
      setDownloadingId(documentId);
      await downloadDashboardDocument(documentId);
    } catch (error) {
      console.error("[DocumentLibrary] Failed to download document:", error);
      toast.error(isEn ? "Failed to download document." : "下载文档失败。");
    } finally {
      setDownloadingId("");
    }
  };

  const openShareDialog = (document: DashboardDocumentItem) => {
    setShareTarget(document);
    setShareExpiryMode(inferShareExpiryMode(document.shareExpiresAt));
    setShareDialogOpen(true);
  };

  const handleCreateOrUpdateShare = async () => {
    if (!shareTarget) return;
    try {
      setSharingId(shareTarget.id);
      const expiresInDays = shareExpiryMode === "never" ? null : Number.parseInt(shareExpiryMode, 10);
      const result = await createDashboardDocumentShare(shareTarget.id, { expiresInDays });
      await navigator.clipboard.writeText(result.shareUrl);
      toast.success(isEn ? "Share link copied." : "分享链接已复制。");
      setShareDialogOpen(false);
      await onDocumentsChanged?.();
    } catch (error) {
      console.error("[DocumentLibrary] Failed to create share link:", error);
      toast.error(isEn ? "Failed to create share link." : "生成分享链接失败。");
    } finally {
      setSharingId("");
    }
  };

  const handleRevokeShare = async (documentId: string) => {
    try {
      setRevokingShareId(documentId);
      await revokeDashboardDocumentShare(documentId);
      toast.success(isEn ? "Share link revoked." : "分享链接已撤销。");
      await onDocumentsChanged?.();
    } catch (error) {
      console.error("[DocumentLibrary] Failed to revoke share link:", error);
      toast.error(isEn ? "Failed to revoke share link." : "撤销分享链接失败。");
    } finally {
      setRevokingShareId("");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error(isEn ? "Please choose a file first." : "请先选择文件。");
      return;
    }

    try {
      setUploading(true);
      await uploadDashboardDocument({
        file: selectedFile,
        title: uploadTitle.trim() || undefined,
        category: uploadCategory.trim() || undefined,
        groupName: uploadGroupName.trim() || undefined,
        tags: uploadTags.trim() || undefined,
      });
      toast.success(isEn ? "Document uploaded." : "文档上传成功。");
      setSelectedFile(null);
      setUploadTitle("");
      setUploadCategory("General");
      setUploadGroupName("Workspace");
      setUploadTags("");
      setUploadOpen(false);
      await onDocumentsChanged?.();
    } catch (error) {
      console.error("[DocumentLibrary] Failed to upload document:", error);
      toast.error(isEn ? "Failed to upload document." : "上传文档失败。");
    } finally {
      setUploading(false);
    }
  };

  const openEditDialog = (document: DashboardDocumentItem) => {
    setEditingDocument(document);
    setEditTitle(document.title);
    setEditCategory(document.category);
    setEditGroupName(document.groupName || "Workspace");
    setEditTags(document.tags.join(", "));
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDocument) return;
    try {
      setSavingEdit(true);
      await updateDashboardDocument(editingDocument.id, {
        title: editTitle.trim() || editingDocument.title,
        category: editCategory.trim() || editingDocument.category,
        groupName: editGroupName.trim() || editingDocument.groupName || "Workspace",
        tags: splitTags(editTags),
      });
      toast.success(isEn ? "Document updated." : "文档已更新。");
      setEditOpen(false);
      setEditingDocument(null);
      await onDocumentsChanged?.();
    } catch (error) {
      console.error("[DocumentLibrary] Failed to update document:", error);
      toast.error(isEn ? "Failed to update document." : "更新文档失败。");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeletingDocumentId(deleteTarget.id);
      await deleteDashboardDocument(deleteTarget.id);
      setSelectedUploadedIds((current) => current.filter((id) => id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success(isEn ? "Document deleted." : "文档已删除。");
      await onDocumentsChanged?.();
    } catch (error) {
      console.error("[DocumentLibrary] Failed to delete document:", error);
      toast.error(isEn ? "Failed to delete document." : "删除文档失败。");
    } finally {
      setDeletingDocumentId("");
    }
  };

  const toggleUploadedSelection = (documentId: string, checked: boolean) => {
    setSelectedUploadedIds((current) => {
      if (checked) return Array.from(new Set([...current, documentId]));
      return current.filter((id) => id !== documentId);
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedUploadedIds((current) => {
      if (allVisibleUploadsSelected) {
        return current.filter((id) => !visibleUploadedIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleUploadedIds]));
    });
  };

  const handleBatchTags = async () => {
    const tags = splitTags(tagInput);
    if (tags.length === 0 && tagMode !== "replace") {
      toast.error(isEn ? "Please enter at least one tag." : "请至少输入一个标签。");
      return;
    }

    try {
      setUpdatingTags(true);
      await batchUpdateDashboardDocumentTags({ documentIds: selectedUploadedIds, tags, mode: tagMode });
      toast.success(isEn ? "Batch tags updated." : "批量标签已更新。");
      setTagDialogOpen(false);
      setTagInput("");
      setSelectedUploadedIds([]);
      await onDocumentsChanged?.();
    } catch (error) {
      console.error("[DocumentLibrary] Failed to batch update tags:", error);
      toast.error(isEn ? "Failed to update tags." : "批量更新标签失败。");
    } finally {
      setUpdatingTags(false);
    }
  };

  const handleBatchOrganization = async () => {
    if (!batchCategory.trim() && !batchGroupName.trim()) {
      toast.error(isEn ? "Please enter a category or group." : "请至少填写分类或分组。");
      return;
    }

    try {
      setUpdatingOrganization(true);
      await batchOrganizeDashboardDocuments({
        documentIds: selectedUploadedIds,
        category: batchCategory.trim() || undefined,
        groupName: batchGroupName.trim() || undefined,
      });
      toast.success(isEn ? "Documents reorganized." : "文档分类和分组已更新。");
      setOrganizeDialogOpen(false);
      setBatchCategory("");
      setBatchGroupName("");
      setSelectedUploadedIds([]);
      await onDocumentsChanged?.();
    } catch (error) {
      console.error("[DocumentLibrary] Failed to batch organize documents:", error);
      toast.error(isEn ? "Failed to update category or group." : "批量更新分类或分组失败。");
    } finally {
      setUpdatingOrganization(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>{isEn ? "Document Library" : "文档库"}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setUploadOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                {isEn ? "Upload Document" : "上传文档"}
              </Button>
              <Button asChild>
                <Link href="/create?ctx=dashboard">{isEn ? "Create Contract" : "创建合同"}</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={
                  isEn
                    ? "Search by title, file name, category, group, tags, or hash..."
                    : "按标题、文件名、分类、分组、标签或哈希搜索..."
                }
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isEn ? "All Documents" : "全部文档"}</SelectItem>
                <SelectItem value="contract">{isEn ? "Contracts" : "合同"}</SelectItem>
                <SelectItem value="draft">{isEn ? "Drafts" : "草稿"}</SelectItem>
                <SelectItem value="uploaded">{isEn ? "Uploads" : "上传文档"}</SelectItem>
                <SelectItem value="verified">{isEn ? "Verified" : "已验真"}</SelectItem>
                <SelectItem value="pending">{isEn ? "Pending" : "处理中"}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isEn ? "All Categories" : "全部分类"}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isEn ? "All Groups" : "全部分组"}</SelectItem>
                {groups.map((groupName) => (
                  <SelectItem key={groupName} value={groupName}>
                    {groupName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visibleUploadedIds.length > 0 ? (
            <div className="mb-4 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox checked={allVisibleUploadsSelected} onCheckedChange={() => toggleSelectAllVisible()} />
                    <span>{isEn ? "Select visible uploads" : "选中当前可见上传文档"}</span>
                  </label>
                  <span className="text-muted-foreground">
                    {isEn
                      ? `${selectedUploadedIds.length} uploaded documents selected`
                      : `已选中 ${selectedUploadedIds.length} 个上传文档`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setTagDialogOpen(true)} disabled={selectedUploadedIds.length === 0}>
                    <Tag className="mr-2 h-4 w-4" />
                    {isEn ? "Batch Tags" : "批量标签"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setOrganizeDialogOpen(true)} disabled={selectedUploadedIds.length === 0}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    {isEn ? "Batch Organize" : "批量分类/分组"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUploadedIds([])} disabled={selectedUploadedIds.length === 0}>
                    {isEn ? "Clear Selection" : "清空选择"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {filteredDocuments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {documents.length === 0
                ? isEn
                  ? "No documents yet. Create a contract or upload a file to start."
                  : "当前还没有文档，请先创建合同或上传独立文档。"
                : isEn
                  ? "No documents matched your current filters."
                  : "没有匹配当前筛选条件的文档。"}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => {
                const isUploaded = doc.sourceKind === "uploaded";
                const hasShareRecord = Boolean(doc.shareUrl || doc.shareExpiresAt);
                const expired = !doc.shareUrl && isShareExpired(doc.shareExpiresAt);
                const primaryLink =
                  doc.sourceKind === "contract" && doc.contractId
                    ? `/contracts/${doc.contractId}?ctx=dashboard`
                    : `/dashboard/documents/${doc.id}/verify`;

                return (
                  <div key={doc.id} className="rounded-lg border border-border p-4 transition-colors hover:border-primary/50">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        {isUploaded ? (
                          <Checkbox
                            className="mt-1"
                            checked={selectedUploadedIds.includes(doc.id)}
                            onCheckedChange={(checked) => toggleUploadedSelection(doc.id, checked === true)}
                          />
                        ) : null}
                        <div className="rounded-lg bg-muted p-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h4 className="truncate font-medium">{doc.title}</h4>
                            {doc.verificationStatus === "verified" ? (
                              <div className="flex items-center gap-1 text-accent">
                                <Shield className="h-4 w-4" />
                                <CheckCircle className="h-4 w-4" />
                              </div>
                            ) : null}
                            <Badge
                              variant={doc.verificationStatus === "verified" ? "default" : "secondary"}
                              className={doc.verificationStatus === "verified" ? "border-accent/20 bg-accent/10 text-accent" : ""}
                            >
                              {getDocumentTypeLabel(doc.documentType, isEn)}
                            </Badge>
                            <Badge variant="outline">{doc.category}</Badge>
                            <Badge variant="outline">{doc.groupName || "Workspace"}</Badge>
                          </div>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span>{doc.fileName}</span>
                              <span>·</span>
                              <span>{doc.sizeLabel}</span>
                              <span>·</span>
                              <span>{formatDateTime(doc.updatedAt || doc.uploadedAt, isEn)}</span>
                              <span>·</span>
                              <span>{isEn ? "Pages" : "页数"}: {doc.pageCount}</span>
                              <span>·</span>
                              <span>
                                {isEn ? "Source" : "来源"}: {doc.sourceKind === "uploaded" ? (isEn ? "Upload" : "上传") : isEn ? "Contract" : "合同"}
                              </span>
                            </div>
                            <div className="font-mono text-xs">
                              {isEn ? "Hash" : "哈希"}: {doc.hash.slice(0, 20)}...
                            </div>
                          </div>
                          {doc.tags.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {doc.tags.map((tag, index) => (
                                <Badge key={`${doc.id}-${tag}-${index}`} variant="secondary">
                                  #{tag}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                          {hasShareRecord ? (
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Share2 className="h-3.5 w-3.5" />
                                <span>
                                  {doc.shareUrl ? (isEn ? "Share Active" : "分享中") : expired ? (isEn ? "Share Expired" : "分享已过期") : isEn ? "Share Recorded" : "已记录分享"}
                                </span>
                              </div>
                              <span>{isEn ? "Expiry" : "有效期"}: {formatShareExpiry(doc.shareExpiresAt, isEn)}</span>
                              <span>{isEn ? "Visits" : "访问次数"}: {doc.shareAccessCount ?? 0}</span>
                              {doc.shareLastAccessedAt ? (
                                <span>{isEn ? "Last Visit" : "最近访问"}: {formatDateTime(doc.shareLastAccessedAt, isEn)}</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={primaryLink}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => void handleDownload(doc.id)} disabled={downloadingId === doc.id}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openShareDialog(doc)} disabled={sharingId === doc.id}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        {hasShareRecord ? (
                          <Button variant="ghost" size="sm" onClick={() => void handleRevokeShare(doc.id)} disabled={revokingShareId === doc.id}>
                            {isEn ? "Revoke Share" : "撤销分享"}
                          </Button>
                        ) : null}
                        {isUploaded ? (
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(doc)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {isUploaded ? (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(doc)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/documents/${doc.id}/verify`}>
                            {isEn ? "Verify" : "验真"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEn ? "Upload Independent Document" : "上传独立文档"}</DialogTitle>
            <DialogDescription>
              {isEn
                ? "Store a standalone file in the document center, assign a category and group, and retain verification metadata."
                : "将独立文件存入文档中心，并补充分组、分类和验真元数据。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="document-file">{isEn ? "File" : "文件"}</Label>
              <Input id="document-file" type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-title">{isEn ? "Title" : "标题"}</Label>
              <Input id="document-title" placeholder={isEn ? "Optional display title" : "可选展示标题"} value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="document-category">{isEn ? "Category" : "分类"}</Label>
                <Input id="document-category" placeholder={isEn ? "e.g. HR, Invoice, Evidence" : "例如：人事、发票、证据"} value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-group">{isEn ? "Group" : "分组"}</Label>
                <Input id="document-group" placeholder={isEn ? "e.g. Workspace, Litigation" : "例如：工作台、诉讼材料"} value={uploadGroupName} onChange={(event) => setUploadGroupName(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-tags">{isEn ? "Tags" : "标签"}</Label>
              <Input id="document-tags" placeholder={isEn ? "Separate tags with commas" : "多个标签请用逗号分隔"} value={uploadTags} onChange={(event) => setUploadTags(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              {isEn ? "Cancel" : "取消"}
            </Button>
            <Button onClick={() => void handleUpload()} disabled={uploading}>
              {uploading ? (isEn ? "Uploading..." : "上传中...") : isEn ? "Upload" : "上传"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEn ? "Edit Uploaded Document" : "编辑上传文档"}</DialogTitle>
            <DialogDescription>
              {isEn ? "Adjust the title, category, group, and tags of this uploaded file." : "修改这个上传文件的标题、分类、分组和标签。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">{isEn ? "Title" : "标题"}</Label>
              <Input id="edit-title" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-category">{isEn ? "Category" : "分类"}</Label>
                <Input id="edit-category" value={editCategory} onChange={(event) => setEditCategory(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-group">{isEn ? "Group" : "分组"}</Label>
                <Input id="edit-group" value={editGroupName} onChange={(event) => setEditGroupName(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tags">{isEn ? "Tags" : "标签"}</Label>
              <Input id="edit-tags" value={editTags} onChange={(event) => setEditTags(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {isEn ? "Cancel" : "取消"}
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={savingEdit}>
              {savingEdit ? (isEn ? "Saving..." : "保存中...") : isEn ? "Save" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEn ? "Batch Tag Management" : "批量标签管理"}</DialogTitle>
            <DialogDescription>
              {isEn ? "Apply tag changes to the selected uploaded documents." : "把标签变更应用到当前选中的上传文档。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isEn ? "Mode" : "模式"}</Label>
              <Select value={tagMode} onValueChange={(value) => setTagMode(value as "add" | "replace" | "remove")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">{isEn ? "Add Tags" : "追加标签"}</SelectItem>
                  <SelectItem value="replace">{isEn ? "Replace Tags" : "替换标签"}</SelectItem>
                  <SelectItem value="remove">{isEn ? "Remove Tags" : "移除标签"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-tags">{isEn ? "Tags" : "标签"}</Label>
              <Input id="batch-tags" placeholder={isEn ? "Separate tags with commas" : "多个标签请用逗号分隔"} value={tagInput} onChange={(event) => setTagInput(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              {isEn ? "Cancel" : "取消"}
            </Button>
            <Button onClick={() => void handleBatchTags()} disabled={updatingTags}>
              {updatingTags ? (isEn ? "Updating..." : "更新中...") : isEn ? "Apply" : "应用"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={organizeDialogOpen} onOpenChange={setOrganizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEn ? "Batch Organize Documents" : "批量分类/分组"}</DialogTitle>
            <DialogDescription>
              {isEn ? "Move the selected uploaded documents into a category and group." : "将选中的上传文档统一移动到新的分类和分组。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="batch-category">{isEn ? "Category" : "分类"}</Label>
              <Input id="batch-category" placeholder={isEn ? "Optional category" : "可选分类"} value={batchCategory} onChange={(event) => setBatchCategory(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-group">{isEn ? "Group" : "分组"}</Label>
              <Input id="batch-group" placeholder={isEn ? "Optional group" : "可选分组"} value={batchGroupName} onChange={(event) => setBatchGroupName(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrganizeDialogOpen(false)}>
              {isEn ? "Cancel" : "取消"}
            </Button>
            <Button onClick={() => void handleBatchOrganization()} disabled={updatingOrganization}>
              {updatingOrganization ? (isEn ? "Updating..." : "更新中...") : isEn ? "Apply" : "应用"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEn ? "Share Verification Page" : "分享验真页"}</DialogTitle>
            <DialogDescription>
              {isEn ? "Choose how long the verification link should stay active." : "设置验真分享链接的有效期。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isEn ? "Validity" : "有效期"}</Label>
              <Select value={shareExpiryMode} onValueChange={(value) => setShareExpiryMode(value as ShareExpiryMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">{isEn ? "No Expiry" : "长期有效"}</SelectItem>
                  <SelectItem value="7">{isEn ? "7 Days" : "7 天"}</SelectItem>
                  <SelectItem value="30">{isEn ? "30 Days" : "30 天"}</SelectItem>
                  <SelectItem value="90">{isEn ? "90 Days" : "90 天"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {shareTarget ? (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                <div>{isEn ? "Current status" : "当前状态"}: {shareTarget.shareUrl ? (isEn ? "Active" : "有效") : isShareExpired(shareTarget.shareExpiresAt) ? (isEn ? "Expired" : "已过期") : isEn ? "Not shared" : "未分享"}</div>
                <div>{isEn ? "Current expiry" : "当前有效期"}: {formatShareExpiry(shareTarget.shareExpiresAt, isEn)}</div>
                <div>{isEn ? "Visits" : "访问次数"}: {shareTarget.shareAccessCount ?? 0}</div>
                {shareTarget.shareLastAccessedAt ? (
                  <div>{isEn ? "Last visit" : "最近访问"}: {formatDateTime(shareTarget.shareLastAccessedAt, isEn)}</div>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              {isEn ? "Cancel" : "取消"}
            </Button>
            <Button onClick={() => void handleCreateOrUpdateShare()} disabled={!shareTarget || sharingId === shareTarget.id}>
              {sharingId === shareTarget?.id ? (isEn ? "Preparing..." : "处理中...") : isEn ? "Copy Share Link" : "复制分享链接"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isEn ? "Delete Uploaded Document?" : "删除上传文档？"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isEn ? "This removes the original file, metadata, and any existing share link." : "这会删除原始文件、元数据以及现有分享链接。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isEn ? "Cancel" : "取消"}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={deletingDocumentId === deleteTarget?.id}>
              {deletingDocumentId === deleteTarget?.id ? (isEn ? "Deleting..." : "删除中...") : isEn ? "Delete" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
