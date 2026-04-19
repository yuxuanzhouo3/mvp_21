"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createRelease,
  deleteRelease,
  listReleases,
  toggleReleaseStatus,
  updateRelease,
} from "@/actions/admin-releases";
import type { AppRelease, Platform, Variant } from "@/lib/admin/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Apple, Download, Eye, EyeOff, Loader2, Monitor, Pencil, Plus, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

function getRegion(): "CN" | "INTL" {
  const region =
    (process.env.NEXT_PUBLIC_DEPLOYMENT_REGION ||
      process.env.NEXT_PUBLIC_APP_REGION ||
      "CN")
      .trim()
      .toUpperCase();
  return region === "INTL" ? "INTL" : "CN";
}

const isIntlRegion = getRegion() === "INTL";
const tx = (zh: string, en: string) => (isIntlRegion ? en : zh);

const PLATFORMS: Array<{ value: Platform; label: string; icon: React.ReactNode }> = [
  { value: "ios", label: "iOS", icon: <Apple className="h-4 w-4" /> },
  { value: "android", label: "Android", icon: <Smartphone className="h-4 w-4" /> },
  { value: "windows", label: "Windows", icon: <Monitor className="h-4 w-4" /> },
  { value: "macos", label: "macOS", icon: <Apple className="h-4 w-4" /> },
  { value: "linux", label: "Linux", icon: <Monitor className="h-4 w-4" /> },
];

const VARIANTS: Record<Platform, Array<{ value: Variant; label: string }>> = {
  ios: [],
  android: [],
  windows: [
    { value: "x64", label: "x64" },
    { value: "x86", label: "x86" },
    { value: "arm64", label: "ARM64" },
  ],
  macos: [
    { value: "intel", label: "Intel" },
    { value: "m", label: "Apple Silicon" },
  ],
  linux: [
    { value: "deb", label: "DEB" },
    { value: "rpm", label: "RPM" },
    { value: "appimage", label: "AppImage" },
    { value: "snap", label: "Snap" },
    { value: "flatpak", label: "Flatpak" },
    { value: "aur", label: "AUR" },
  ],
};

function getVariantLabel(platform: Platform, variant?: Variant | null) {
  if (!variant) return "";
  return VARIANTS[platform].find((item) => item.value === variant)?.label || variant;
}

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function toDownloadUrl(fileUrl: string) {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("cloud://")) {
    return `/api/files/cn-download?download=true&fileId=${encodeURIComponent(fileUrl)}`;
  }
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }
  return `/api/files/cn-download?download=true&url=${encodeURIComponent(fileUrl)}`;
}

function buildFileName(platform: Platform, variant: Variant | undefined, version: string, source: string) {
  const ext = source.includes(".") ? source.split(".").pop() : "bin";
  return `${platform}${variant ? `-${variant}` : ""}-${version.trim()}-${Date.now()}.${ext}`;
}

export default function ReleasesManagementPage() {
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AppRelease | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const [version, setVersion] = useState("");
  const [platform, setPlatform] = useState<Platform>("android");
  const [variant, setVariant] = useState<Variant | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isMandatory, setIsMandatory] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [editNotes, setEditNotes] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editMandatory, setEditMandatory] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");

  const filtered = useMemo(() => {
    return releases.filter((item) => {
      const matchKeyword = keyword.trim()
        ? `${item.version} ${item.file_name || ""} ${item.release_notes || ""}`
            .toLowerCase()
            .includes(keyword.toLowerCase())
        : true;
      const matchPlatform = platformFilter === "all" ? true : item.platform === platformFilter;
      return matchKeyword && matchPlatform;
    });
  }, [releases, keyword, platformFilter]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const result = await listReleases();
      if (result.success && result.data) {
        setReleases(result.data);
      } else {
        const message = result.error || tx("加载发布版本失败", "Failed to load releases");
        setError(message);
        toast.error(message);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : tx("加载发布版本失败", "Failed to load releases");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const options = VARIANTS[platform] || [];
    if (variant && !options.some((item) => item.value === variant)) {
      setVariant(undefined);
    }
  }, [platform, variant]);

  function resetCreateForm() {
    setVersion("");
    setPlatform("android");
    setVariant(undefined);
    setNotes("");
    setIsActive(true);
    setIsMandatory(false);
    setFileInputKey((v) => v + 1);
  }

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const form = new FormData(event.currentTarget);
      const file = form.get("file");
      if (!version.trim()) {
        const message = tx("请输入版本号", "Please enter a version number");
        setError(message);
        toast.error(message);
        return;
      }
      if (!file || !(file instanceof File) || file.size <= 0) {
        const message = tx("请选择安装包文件", "Please choose an installer file");
        setError(message);
        toast.error(message);
        return;
      }

      const fileName = buildFileName(platform, variant, version, file.name);
      const upload = new FormData();
      upload.append("file", file);
      upload.append("fileName", fileName);

      const uploadRes = await fetch("/api/upload/release", { method: "POST", body: upload });
      if (!uploadRes.ok) {
        const payload = await uploadRes.json().catch(() => null);
        const message = payload?.error || tx("上传安装包失败", "Failed to upload installer");
        setError(message);
        toast.error(message);
        return;
      }

      const uploadPayload = (await uploadRes.json()) as { fileID?: string; fileUrl?: string };
      const fileRef = uploadPayload.fileID || uploadPayload.fileUrl;
      if (!fileRef) {
        const message = tx("上传成功但未返回文件地址", "Upload succeeded but no file URL was returned");
        setError(message);
        toast.error(message);
        return;
      }

      const payload = new FormData();
      payload.append("version", version.trim());
      payload.append("platform", platform);
      if (variant) payload.append("variant", variant);
      payload.append("fileName", fileName);
      payload.append("fileSize", String(file.size));
      payload.append("cloudbaseFileId", fileRef);
      payload.append("releaseNotes", notes.trim());
      payload.append("isActive", String(isActive));
      payload.append("isMandatory", String(isMandatory));

      const result = await createRelease(payload);
      if (!result.success) {
        const message = result.error || tx("创建版本失败", "Failed to create release");
        setError(message);
        toast.error(message);
        return;
      }

      setDialogOpen(false);
      resetCreateForm();
      await loadData();
      toast.success(tx("版本已创建", "Release created"));
    } catch (e) {
      const message = e instanceof Error ? e.message : tx("创建版本失败", "Failed to create release");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item: AppRelease) {
    setEditing(item);
    setEditNotes(item.release_notes || "");
    setEditActive(item.is_active);
    setEditMandatory(item.is_mandatory);
    setEditOpen(true);
  }

  async function onSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    setSaving(true);
    setError(null);
    try {
      const payload = new FormData();
      payload.append("releaseNotes", editNotes.trim());
      payload.append("isActive", String(editActive));
      payload.append("isMandatory", String(editMandatory));

      const result = await updateRelease(editing.id, payload);
      if (!result.success) {
        const message = result.error || tx("更新失败", "Update failed");
        setError(message);
        toast.error(message);
        return;
      }

      setEditOpen(false);
      setEditing(null);
      await loadData();
      toast.success(tx("版本已更新", "Release updated"));
    } catch (e) {
      const message = e instanceof Error ? e.message : tx("更新失败", "Update failed");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setDeleting(id);
    setError(null);
    try {
      const result = await deleteRelease(id);
      if (!result.success) {
        const message = result.error || tx("删除失败", "Delete failed");
        setError(message);
        toast.error(message);
        return;
      }
      await loadData();
      toast.success(tx("版本已删除", "Release deleted"));
    } catch (e) {
      const message = e instanceof Error ? e.message : tx("删除失败", "Delete failed");
      setError(message);
      toast.error(message);
    } finally {
      setDeleting(null);
    }
  }

  async function onToggle(item: AppRelease) {
    setToggling(item.id);
    setError(null);
    try {
      const result = await toggleReleaseStatus(item.id, !item.is_active);
      if (!result.success) {
        const message = result.error || tx("切换状态失败", "Failed to toggle status");
        setError(message);
        toast.error(message);
        return;
      }
      await loadData();
      toast.success(item.is_active ? tx("版本已停用", "Release disabled") : tx("版本已启用", "Release enabled"));
    } catch (e) {
      const message = e instanceof Error ? e.message : tx("切换状态失败", "Failed to toggle status");
      setError(message);
      toast.error(message);
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tx("发布管理", "Release Management")}</h1>
          <p className="text-sm text-muted-foreground">{tx("管理多平台安装包发布，支持平台变体与启用状态切换。", "Manage multi-platform release packages with variant and status controls.")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {tx("刷新", "Refresh")}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />{tx("新建版本", "New Release")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{tx("新建发布版本", "Create Release")}</DialogTitle>
                <DialogDescription>{tx("上传安装包并创建发布记录。", "Upload an installer and create a release record.")}</DialogDescription>
              </DialogHeader>
              <form onSubmit={onCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>{tx("版本号", "Version")} *</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder={tx("例如 1.2.3", "e.g. 1.2.3")} /></div>
                  <div className="space-y-1">
                    <Label>{tx("平台", "Platform")} *</Label>
                    <Select value={platform} onValueChange={(value) => setPlatform(value as Platform)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PLATFORMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {VARIANTS[platform].length > 0 ? (
                  <div className="space-y-1">
                    <Label>{tx("变体", "Variant")}</Label>
                    <Select value={variant || "none"} onValueChange={(value) => setVariant(value === "none" ? undefined : (value as Variant))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tx("默认", "Default")}</SelectItem>
                        {VARIANTS[platform].map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-1"><Label>{tx("安装包文件", "Installer File")} *</Label><Input key={fileInputKey} name="file" type="file" required /></div>
                <div className="space-y-1"><Label>{tx("更新说明", "Release Notes")}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
                <div className="flex items-center justify-between rounded-md border p-2"><span className="text-sm">{tx("立即启用", "Enable Immediately")}</span><Switch checked={isActive} onCheckedChange={setIsActive} /></div>
                <div className="flex items-center justify-between rounded-md border p-2"><span className="text-sm">{tx("强制更新", "Force Update")}</span><Switch checked={isMandatory} onCheckedChange={setIsMandatory} /></div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{tx("取消", "Cancel")}</Button>
                  <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tx("创建", "Create")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

      <Card>
        <CardHeader><CardTitle>{tx("筛选", "Filters")}</CardTitle></CardHeader>
        <CardContent className="flex gap-3">
          <Input placeholder={tx("搜索版本/文件/说明", "Search version/file/notes")} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder={tx("平台", "Platform")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("全部平台", "All Platforms")}</SelectItem>
              {PLATFORMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{tx("版本列表", "Release List")} ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="inline h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>版本</TableHead>
                  <TableHead>{tx("平台", "Platform")}</TableHead>
                  <TableHead>{tx("大小", "Size")}</TableHead>
                  <TableHead>{tx("说明", "Notes")}</TableHead>
                  <TableHead>{tx("状态", "Status")}</TableHead>
                  <TableHead className="w-44">{tx("操作", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">v{item.version}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {PLATFORMS.find((p) => p.value === item.platform)?.icon}
                        {PLATFORMS.find((p) => p.value === item.platform)?.label}
                        {item.variant ? <span className="text-xs text-muted-foreground">({getVariantLabel(item.platform, item.variant)})</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>{formatSize(item.file_size)}</TableCell>
                    <TableCell className="max-w-[280px] truncate" title={item.release_notes || ""}>{item.release_notes || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant={item.is_active ? "default" : "outline"}>{item.is_active ? tx("启用", "Enabled") : tx("停用", "Disabled")}</Badge>
                        {item.is_mandatory ? <Badge variant="destructive">{tx("强制", "Forced")}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => window.open(toDownloadUrl(item.file_url), "_blank")}><Download className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" disabled={toggling === item.id} onClick={() => void onToggle(item)}>
                          {toggling === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : item.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-600"
                          disabled={deleting === item.id}
                          onClick={() => {
                            if (window.confirm(`确认删除版本 v${item.version} 吗？`)) {
                              void onDelete(item.id);
                            }
                          }}
                        >
                          {deleting === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tx("编辑版本", "Edit Release")}</DialogTitle>
            <DialogDescription>{tx("修改更新说明、启用状态和强制更新。", "Update notes, status, and force-update flag.")}</DialogDescription>
          </DialogHeader>
          {editing ? (
            <form onSubmit={onSaveEdit} className="space-y-3">
              <div className="space-y-1"><Label>{tx("版本", "Version")}</Label><Input value={`v${editing.version}`} disabled /></div>
              <div className="space-y-1"><Label>{tx("更新说明", "Release Notes")}</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} /></div>
              <div className="flex items-center justify-between rounded-md border p-2"><span className="text-sm">{tx("启用", "Enabled")}</span><Switch checked={editActive} onCheckedChange={setEditActive} /></div>
              <div className="flex items-center justify-between rounded-md border p-2"><span className="text-sm">{tx("强制更新", "Force Update")}</span><Switch checked={editMandatory} onCheckedChange={setEditMandatory} /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>{tx("取消", "Cancel")}</Button>
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tx("保存", "Save")}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
