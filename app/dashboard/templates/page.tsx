"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Eye,
  FileText,
  History,
  Loader2,
  PenSquare,
  Plus,
  Power,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import { ConsoleShell } from "@/components/layout/console-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  createDashboardTemplate,
  getDashboardTemplates,
  updateDashboardTemplate,
} from "@/lib/dashboard/client";
import type {
  DashboardTemplate,
  DashboardTemplatePermissions,
} from "@/lib/dashboard/types";

function getTemplateRootId(template: DashboardTemplate) {
  return template.sourceTemplateId || template.id;
}

export default function TemplatesPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const isEn = language === "en";
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [permissions, setPermissions] = useState<DashboardTemplatePermissions>({
    canCreate: true,
    canEditOwned: true,
    canCreateVersion: true,
    canCopy: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    category: "",
    content: "",
  });
  const [editorForm, setEditorForm] = useState({
    name: "",
    description: "",
    category: "",
    content: "",
  });

  const labels = {
    overview: isEn ? "Overview" : "总览",
    templates: isEn ? "Templates" : "模板中心",
  };

  const content = {
    title: isEn ? "Contract Templates" : "合同模板",
    description: isEn
      ? "Turn templates into a managed library with details, versions, status controls, and ownership."
      : "将模板中心升级为可管理的模板库，支持详情、版本、状态与归属治理。",
    useTemplate: isEn ? "Use Template" : "使用模板",
    emptyTitle: isEn ? "No templates yet" : "暂无模板",
    emptyDescription: isEn
      ? "Templates will appear here once they are created in the database."
      : "数据库中的模板会显示在这里。",
    loadFailed: isEn ? "Failed to load templates." : "加载模板失败。",
  };

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates],
  );

  const relatedVersions = useMemo(() => {
    if (!selectedTemplate) {
      return [];
    }

    const rootId = getTemplateRootId(selectedTemplate);
    return [...templates]
      .filter((template) => {
        const templateRootId = getTemplateRootId(template);
        return template.id === rootId || templateRootId === rootId;
      })
      .sort((left, right) => right.version - left.version);
  }, [selectedTemplate, templates]);

  const stats = useMemo(
    () => ({
      total: templates.length,
      active: templates.filter((template) => template.status === "active").length,
      draft: templates.filter((template) => template.status === "draft").length,
      owned: templates.filter((template) => Boolean(template.userId)).length,
    }),
    [templates],
  );

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }

    setEditorForm({
      name: selectedTemplate.name,
      description: selectedTemplate.description,
      category: selectedTemplate.category,
      content: selectedTemplate.content || "",
    });
  }, [selectedTemplate]);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getDashboardTemplates();
      setTemplates(result.templates || []);
      setPermissions((current) => result.permissions || current);
    } catch (loadError) {
      console.error("[TemplatesPage] Failed to load templates:", loadError);
      setError(content.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [content.loadFailed]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const formatDate = (value?: string) => {
    if (!value) {
      return isEn ? "Not yet" : "暂无";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(isEn ? "en-US" : "zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const statusLabel = (status: DashboardTemplate["status"]) => {
    if (status === "active") {
      return isEn ? "Active" : "启用中";
    }
    if (status === "draft") {
      return isEn ? "Draft" : "草稿";
    }
    return isEn ? "Archived" : "已归档";
  };

  const canEditTemplate = Boolean(selectedTemplate?.userId && permissions.canEditOwned);

  async function handleCreateTemplate() {
    if (!createForm.name.trim() || !createForm.content.trim()) {
      toast.error(isEn ? "Please complete the template name and content." : "请填写模板名称和正文内容。");
      return;
    }

    try {
      setSaving(true);
      const result = await createDashboardTemplate({
        name: createForm.name,
        description: createForm.description,
        category: createForm.category,
        content: createForm.content,
      });
      toast.success(isEn ? "Template created." : "模板已创建。");
      setCreateOpen(false);
      setCreateForm({
        name: "",
        description: "",
        category: "",
        content: "",
      });
      await loadTemplates();
      setSelectedTemplateId(result.template.id);
    } catch (createError) {
      console.error("[TemplatesPage] Failed to create template:", createError);
      toast.error(isEn ? "Failed to create template." : "创建模板失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTemplate() {
    if (!selectedTemplate) {
      return;
    }

    try {
      setSaving(true);
      await updateDashboardTemplate(selectedTemplate.id, {
        name: editorForm.name,
        description: editorForm.description,
        category: editorForm.category,
        content: editorForm.content,
      });
      toast.success(isEn ? "Template updated." : "模板已更新。");
      await loadTemplates();
    } catch (saveError) {
      console.error("[TemplatesPage] Failed to save template:", saveError);
      toast.error(isEn ? "Failed to save template." : "保存模板失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(template: DashboardTemplate) {
    try {
      setSaving(true);
      const nextStatus = template.status === "archived" ? "active" : "archived";
      await updateDashboardTemplate(template.id, { status: nextStatus });
      toast.success(
        nextStatus === "active"
          ? isEn
            ? "Template enabled."
            : "模板已启用。"
          : isEn
            ? "Template archived."
            : "模板已归档。",
      );
      await loadTemplates();
    } catch (toggleError) {
      console.error("[TemplatesPage] Failed to toggle template status:", toggleError);
      toast.error(isEn ? "Failed to update template status." : "更新模板状态失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicateTemplate(template: DashboardTemplate) {
    try {
      setSaving(true);
      const result = await updateDashboardTemplate(template.id, { action: "duplicate" });
      toast.success(isEn ? "Template copied." : "模板已复制。");
      await loadTemplates();
      setSelectedTemplateId(result.template.id);
    } catch (copyError) {
      console.error("[TemplatesPage] Failed to duplicate template:", copyError);
      toast.error(isEn ? "Failed to copy template." : "复制模板失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateVersion(template: DashboardTemplate) {
    try {
      setSaving(true);
      const result = await updateDashboardTemplate(template.id, { action: "create_version" });
      toast.success(isEn ? "New template version created." : "已创建新的模板版本。");
      await loadTemplates();
      setSelectedTemplateId(result.template.id);
    } catch (versionError) {
      console.error("[TemplatesPage] Failed to create template version:", versionError);
      toast.error(isEn ? "Failed to create template version." : "创建模板版本失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleUseTemplate(template: DashboardTemplate) {
    if (template.userId) {
      try {
        await updateDashboardTemplate(template.id, {
          usageCount: template.usageCount + 1,
          lastUsedAt: new Date().toISOString(),
        });
      } catch (markUsedError) {
        console.error("[TemplatesPage] Failed to mark template usage:", markUsedError);
      }
    }

    router.push(`/create?templateId=${template.id}`);
  }

  return (
    <>
      <ConsoleShell
        crumbs={[
          { label: labels.overview, href: "/dashboard" },
          { label: labels.templates },
        ]}
        title={content.title}
        description={content.description}
        actions={
          permissions.canCreate ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {isEn ? "New Template" : "新建模板"}
            </Button>
          ) : null
        }
      >
        {loading ? (
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isEn ? "Loading templates..." : "正在加载模板..."}
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-red-200 bg-red-50 shadow-sm">
            <CardContent className="p-6 text-sm text-red-700">{error}</CardContent>
          </Card>
        ) : templates.length === 0 ? (
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardContent className="p-6">
              <p className="text-base font-medium">{content.emptyTitle}</p>
              <p className="mt-2 text-sm text-muted-foreground">{content.emptyDescription}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border-border/70 bg-card/95 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{isEn ? "Total Templates" : "模板总数"}</p>
                  <p className="mt-2 text-2xl font-semibold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-card/95 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{isEn ? "Active" : "启用中"}</p>
                  <p className="mt-2 text-2xl font-semibold">{stats.active}</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-card/95 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{isEn ? "Draft Versions" : "草稿版本"}</p>
                  <p className="mt-2 text-2xl font-semibold">{stats.draft}</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-card/95 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{isEn ? "Owned Templates" : "我的模板"}</p>
                  <p className="mt-2 text-2xl font-semibold">{stats.owned}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className="border-border/70 bg-card/95 shadow-sm transition-colors hover:border-primary/50"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-primary/10 p-2">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <CardDescription className="text-xs">
                              {template.category} · {isEn ? "v" : "版本 "} {template.version}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={template.userId ? "secondary" : "outline"}>
                          {template.userId ? (isEn ? "Owned" : "我的") : isEn ? "Shared" : "共享"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4 flex flex-wrap gap-2">
                        <Badge variant="outline">{statusLabel(template.status)}</Badge>
                        <Badge variant="outline">
                          {isEn ? `${template.usageCount} uses` : `使用 ${template.usageCount} 次`}
                        </Badge>
                      </div>
                      <p className="mb-4 text-sm text-muted-foreground">
                        {template.description || (isEn ? "No description yet." : "暂无模板说明。")}
                      </p>
                      <p className="mb-4 text-xs text-muted-foreground">
                        {isEn ? "Last used" : "最近使用"}: {formatDate(template.lastUsedAt)}
                      </p>
                      <div className="grid gap-2">
                        <Button size="sm" className="w-full" onClick={() => void handleUseTemplate(template)}>
                          {content.useTemplate}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => setSelectedTemplateId(template.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {isEn ? "View Details" : "查看详情"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-border/70 bg-card/95 shadow-sm">
                <CardHeader>
                  <CardTitle>{isEn ? "Managed Workflow" : "治理能力"}</CardTitle>
                  <CardDescription>
                    {isEn
                      ? "This library supports details, enable/disable, duplication, and versioned drafts."
                      : "当前模板库已支持详情查看、启停、复制和版本草稿管理。"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                    <p className="font-medium text-foreground">{isEn ? "Shared templates" : "共享模板"}</p>
                    <p className="mt-1">
                      {isEn
                        ? "Shared templates can be used directly or copied into your own managed library."
                        : "共享模板可以直接使用，也可以复制到你的私有模板库继续管理。"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                    <p className="font-medium text-foreground">{isEn ? "Owned templates" : "我的模板"}</p>
                    <p className="mt-1">
                      {isEn
                        ? "Owned templates support edits, status changes, and version branches for governance review."
                        : "自有模板支持编辑、状态切换和版本分支，便于治理与审阅。"}
                    </p>
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/create">{isEn ? "Open Contract Creator" : "打开合同创建器"}</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </ConsoleShell>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEn ? "Create Template" : "新建模板"}</DialogTitle>
            <DialogDescription>
              {isEn
                ? "Save reusable contract content into your managed template library."
                : "将可复用的合同内容保存到模板库，后续可持续复用和版本化。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">{isEn ? "Name" : "模板名称"}</Label>
              <Input
                id="template-name"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">{isEn ? "Description" : "模板说明"}</Label>
              <Textarea
                id="template-description"
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-category">{isEn ? "Category" : "分类"}</Label>
              <Input
                id="template-category"
                value={createForm.category}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, category: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-content">{isEn ? "Content" : "模板正文"}</Label>
              <Textarea
                id="template-content"
                value={createForm.content}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, content: event.target.value }))
                }
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              {isEn ? "Cancel" : "取消"}
            </Button>
            <Button onClick={() => void handleCreateTemplate()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEn ? "Create" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(selectedTemplate)}
        onOpenChange={(open) => !open && setSelectedTemplateId(null)}
      >
        <SheetContent className="w-full sm:max-w-xl">
          {selectedTemplate ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTemplate.name}</SheetTitle>
                <SheetDescription>
                  {isEn
                    ? "Inspect details, manage status, duplicate the template, or create a new version."
                    : "在这里查看模板详情，并执行启停、复制、创建新版本等操作。"}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{statusLabel(selectedTemplate.status)}</Badge>
                  <Badge variant="outline">
                    {isEn ? `Version ${selectedTemplate.version}` : `版本 ${selectedTemplate.version}`}
                  </Badge>
                  <Badge variant={selectedTemplate.userId ? "secondary" : "outline"}>
                    {selectedTemplate.userId ? (isEn ? "Owned" : "我的") : isEn ? "Shared" : "共享"}
                  </Badge>
                </div>

                <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/15 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">{isEn ? "Category" : "分类"}</p>
                    <p className="mt-1 font-medium text-foreground">{selectedTemplate.category}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isEn ? "Usage count" : "使用次数"}</p>
                    <p className="mt-1 font-medium text-foreground">{selectedTemplate.usageCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isEn ? "Created" : "创建时间"}</p>
                    <p className="mt-1 font-medium text-foreground">{formatDate(selectedTemplate.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isEn ? "Last used" : "最近使用"}</p>
                    <p className="mt-1 font-medium text-foreground">{formatDate(selectedTemplate.lastUsedAt)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editor-name">{isEn ? "Template Name" : "模板名称"}</Label>
                  <Input
                    id="editor-name"
                    value={editorForm.name}
                    disabled={!canEditTemplate}
                    onChange={(event) =>
                      setEditorForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editor-description">{isEn ? "Description" : "模板说明"}</Label>
                  <Textarea
                    id="editor-description"
                    value={editorForm.description}
                    disabled={!canEditTemplate}
                    onChange={(event) =>
                      setEditorForm((current) => ({ ...current, description: event.target.value }))
                    }
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editor-category">{isEn ? "Category" : "分类"}</Label>
                  <Input
                    id="editor-category"
                    value={editorForm.category}
                    disabled={!canEditTemplate}
                    onChange={(event) =>
                      setEditorForm((current) => ({ ...current, category: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editor-content">{isEn ? "Content" : "模板正文"}</Label>
                  <Textarea
                    id="editor-content"
                    value={editorForm.content}
                    disabled={!canEditTemplate}
                    onChange={(event) =>
                      setEditorForm((current) => ({ ...current, content: event.target.value }))
                    }
                    rows={12}
                  />
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <p className="font-medium text-foreground">{isEn ? "Version Timeline" : "版本时间线"}</p>
                  </div>
                  <div className="space-y-3">
                    {relatedVersions.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg border border-border/70 bg-background/80 px-3 py-3 text-left transition-colors hover:border-primary/50"
                        onClick={() => setSelectedTemplateId(template.id)}
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {isEn ? "Version" : "版本"} {template.version}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(template.updatedAt)}
                          </p>
                        </div>
                        <Badge variant="outline">{statusLabel(template.status)}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <SheetFooter>
                <div className="grid w-full gap-2 sm:grid-cols-2">
                  <Button variant="outline" onClick={() => void handleUseTemplate(selectedTemplate)}>
                    <PenSquare className="mr-2 h-4 w-4" />
                    {content.useTemplate}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleDuplicateTemplate(selectedTemplate)}
                    disabled={saving || !permissions.canCopy}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {isEn ? "Duplicate" : "复制模板"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateVersion(selectedTemplate)}
                    disabled={saving || !selectedTemplate.userId || !permissions.canCreateVersion}
                  >
                    <History className="mr-2 h-4 w-4" />
                    {isEn ? "New Version" : "创建新版本"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleToggleStatus(selectedTemplate)}
                    disabled={saving || !selectedTemplate.userId}
                  >
                    <Power className="mr-2 h-4 w-4" />
                    {selectedTemplate.status === "archived"
                      ? isEn
                        ? "Enable"
                        : "启用模板"
                      : isEn
                        ? "Archive"
                        : "归档模板"}
                  </Button>
                  <Button
                    className="sm:col-span-2"
                    onClick={() => void handleSaveTemplate()}
                    disabled={saving || !canEditTemplate}
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isEn ? "Save Template" : "保存模板"}
                  </Button>
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
