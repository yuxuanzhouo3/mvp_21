'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Monitor,
  RefreshCw,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/components/language-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { adminFetchJson } from '@/lib/admin/client';

type Platform = 'android' | 'ios' | 'mac' | 'windows' | 'harmonyos';

type Version = {
  id: string;
  platform: Platform;
  version: string;
  buildNumber: number;
  fileUrl: string;
  fileSize: number;
  changelog: string;
  forceUpdate: boolean;
  isActive: boolean;
  createdAt: string;
};

const platformIcons: Record<Platform, ReactNode> = {
  android: <Smartphone className="h-4 w-4" />,
  ios: <Smartphone className="h-4 w-4" />,
  mac: <Monitor className="h-4 w-4" />,
  windows: <Monitor className="h-4 w-4" />,
  harmonyos: <Smartphone className="h-4 w-4" />,
};

const platformNames: Record<Platform, string> = {
  android: 'Android',
  ios: 'iOS',
  mac: 'Mac',
  windows: 'Windows',
  harmonyos: 'HarmonyOS',
};

export default function VersionsPage() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';

  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    platform: '' as Platform | '',
    version: '',
    buildNumber: '1',
    file: null as File | null,
    changelog: '',
    forceUpdate: false,
  });

  const copy = useMemo(
    () => ({
      title: isEn ? 'Version Management' : '版本管理',
      description: isEn
        ? 'Upload release packages, track active builds, and keep each platform release clear.'
        : '统一上传安装包、维护平台版本和启停状态，保证每个平台的发布记录清晰可追踪。',
      uploadTitle: isEn ? 'Upload New Version' : '上传新版本',
      uploadDesc: isEn
        ? 'Upload the package first, then create a structured release record.'
        : '先上传安装包，再生成标准化版本记录，便于后台统一管理。',
      listTitle: isEn ? 'Version List' : '版本列表',
      listDesc: isEn
        ? 'Keep release status, force-update flags, and download links in one place.'
        : '集中查看版本状态、强制更新标记和安装包下载地址。',
      refresh: isEn ? 'Refresh' : '刷新',
      retry: isEn ? 'Retry' : '重新加载',
      loadFailed: isEn ? 'Failed to load versions.' : '加载版本数据失败，请稍后重试。',
      required: isEn ? 'Please complete the required fields and choose a package.' : '请先完善必填项并选择安装包。',
      uploadSuccess: isEn ? 'Version uploaded successfully.' : '版本已上传并创建成功。',
      uploadFailed: isEn ? 'Failed to upload the version.' : '上传版本失败，请稍后重试。',
      updateSuccess: isEn ? 'Version status updated.' : '版本状态已更新。',
      updateFailed: isEn ? 'Failed to update the version.' : '更新版本状态失败，请稍后重试。',
      deleteSuccess: isEn ? 'Version deleted.' : '版本已删除。',
      deleteFailed: isEn ? 'Failed to delete the version.' : '删除版本失败，请稍后重试。',
      delete: isEn ? 'Delete' : '删除',
      deleteConfirm: (version: string) =>
        isEn ? `Delete version ${version}?` : `确认删除版本 ${version} 吗？此操作不可撤销。`,
      noVersions: isEn ? 'No versions yet.' : '暂无版本记录。',
      noVersionsHint: isEn
        ? 'Upload the first install package to start release management.'
        : '上传第一个安装包后，即可开始版本管理。',
      platform: isEn ? 'Platform' : '平台',
      version: isEn ? 'Version' : '版本号',
      buildNumber: isEn ? 'Build Number' : '构建号',
      file: isEn ? 'Install Package' : '安装包',
      changelog: isEn ? 'Release Notes' : '更新说明',
      forceUpdate: isEn ? 'Force update for all users' : '设置为强制更新',
      uploading: isEn ? 'Uploading...' : '上传中...',
      uploadButton: isEn ? 'Upload Version' : '上传版本',
      selected: isEn ? 'Selected file' : '已选择文件',
      selectPlatform: isEn ? 'Select a platform' : '请选择平台',
      versionPlaceholder: isEn ? 'e.g. 2.3.1' : '例如：2.3.1',
      changelogPlaceholder: isEn
        ? 'Summarize this release, fixes, or upgrade notes...'
        : '填写本次更新说明、修复项或升级提示...',
      download: isEn ? 'Download' : '下载',
      enable: isEn ? 'Enable' : '启用',
      disable: isEn ? 'Disable' : '停用',
      active: isEn ? 'Active' : '已启用',
      inactive: isEn ? 'Inactive' : '未启用',
      forceBadge: isEn ? 'Force Update' : '强制更新',
      uploadedAt: isEn ? 'Created at' : '创建时间',
    }),
    [isEn],
  );

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await adminFetchJson<{ success: true; data: Version[] }>('/api/admin/versions');
      setVersions(result.data || []);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : copy.loadFailed;
      setError(message);
      setVersions([]);
      toast.error(copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed]);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions]);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setForm((current) => ({ ...current, file }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const resetForm = () => {
    setForm({
      platform: '',
      version: '',
      buildNumber: '1',
      file: null,
      changelog: '',
      forceUpdate: false,
    });
  };

  const handleSubmit = async () => {
    if (!form.platform || !form.version.trim() || !form.file) {
      toast.error(copy.required);
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const uploadFormData = new FormData();
      uploadFormData.append('file', form.file);
      uploadFormData.append('folder', 'app-releases');

      const uploadResult = await adminFetchJson<{
        success: true;
        data: { url: string; size: number };
      }>('/api/admin/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      await adminFetchJson('/api/admin/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: form.platform,
          version: form.version.trim(),
          buildNumber: Number(form.buildNumber || 1),
          fileUrl: uploadResult.data.url,
          fileSize: uploadResult.data.size,
          changelog: form.changelog.trim(),
          forceUpdate: form.forceUpdate,
        }),
      });

      toast.success(copy.uploadSuccess);
      resetForm();
      await fetchVersions();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : copy.uploadFailed;
      setError(message);
      toast.error(copy.uploadFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (version: Version) => {
    try {
      setError('');
      await adminFetchJson(`/api/admin/versions/${version.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !version.isActive,
          forceUpdate: version.forceUpdate,
        }),
      });

      toast.success(copy.updateSuccess);
      await fetchVersions();
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : copy.updateFailed;
      setError(message);
      toast.error(copy.updateFailed);
    }
  };

  const handleDelete = async (version: Version) => {
    const confirmed = window.confirm(copy.deleteConfirm(version.version));
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await adminFetchJson(`/api/admin/versions/${version.id}`, {
        method: 'DELETE',
      });
      toast.success(copy.deleteSuccess);
      await fetchVersions();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : copy.deleteFailed;
      setError(message);
      toast.error(copy.deleteFailed);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.description}</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{copy.uploadTitle}</CardTitle>
          <CardDescription>{copy.uploadDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="platform">{copy.platform}</Label>
              <Select
                value={form.platform}
                onValueChange={(value) => setForm((current) => ({ ...current, platform: value as Platform }))}
              >
                <SelectTrigger id="platform">
                  <SelectValue placeholder={copy.selectPlatform} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(platformNames).map(([key, name]) => (
                    <SelectItem key={key} value={key}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="version">{copy.version}</Label>
              <Input
                id="version"
                placeholder={copy.versionPlaceholder}
                value={form.version}
                onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="buildNumber">{copy.buildNumber}</Label>
              <Input
                id="buildNumber"
                type="number"
                min={1}
                value={form.buildNumber}
                onChange={(event) => setForm((current) => ({ ...current, buildNumber: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">{copy.file}</Label>
              <Input
                id="file"
                type="file"
                accept=".apk,.ipa,.dmg,.exe,.hap,.zip,.msi"
                onChange={handleFileSelect}
              />
              {form.file ? (
                <p className="text-sm text-muted-foreground">
                  {copy.selected}: {form.file.name} ({formatFileSize(form.file.size)})
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="changelog">{copy.changelog}</Label>
            <Textarea
              id="changelog"
              rows={4}
              placeholder={copy.changelogPlaceholder}
              value={form.changelog}
              onChange={(event) => setForm((current) => ({ ...current, changelog: event.target.value }))}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="forceUpdate"
              checked={form.forceUpdate}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, forceUpdate: checked }))}
            />
            <Label htmlFor="forceUpdate" className="cursor-pointer">
              {copy.forceUpdate}
            </Label>
          </div>

          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {copy.uploading}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {copy.uploadButton}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>{copy.listTitle}</CardTitle>
            <CardDescription>{copy.listDesc}</CardDescription>
          </div>
          <Button variant="outline" onClick={() => void fetchVersions()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {copy.refresh}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : versions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground/60" />
              <p className="font-medium">{copy.noVersions}</p>
              <p className="mt-2 text-sm text-muted-foreground">{copy.noVersionsHint}</p>
              <Button variant="outline" className="mt-4" onClick={() => void fetchVersions()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {copy.retry}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="flex flex-col gap-4 rounded-xl border p-4 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="flex flex-1 items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {platformIcons[version.platform]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{platformNames[version.platform]}</h3>
                        <span className="text-sm text-muted-foreground">v{version.version}</span>
                        {version.forceUpdate ? <Badge variant="destructive">{copy.forceBadge}</Badge> : null}
                        <Badge variant={version.isActive ? 'default' : 'secondary'}>
                          {version.isActive ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {copy.active}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {copy.inactive}
                            </span>
                          )}
                        </Badge>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        Build {version.buildNumber} · {formatFileSize(version.fileSize)} · {copy.uploadedAt}:{' '}
                        {new Date(version.createdAt).toLocaleString(locale)}
                      </div>

                      {version.changelog ? (
                        <div className="mt-3 whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm">
                          {version.changelog}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(version.fileUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {copy.download}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleToggle(version)}>
                      {version.isActive ? copy.disable : copy.enable}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleDelete(version)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {copy.delete}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
