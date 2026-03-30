'use client';

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Download,
  Loader2,
  Monitor,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/components/language-provider';
import { adminFetchJson } from '@/lib/admin/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

type Platform = 'android' | 'ios' | 'mac' | 'windows' | 'harmonyos';

interface Version {
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
}

const platformIcons: Record<Platform, ReactNode> = {
  android: <Smartphone className="h-4 w-4" />,
  ios: <Smartphone className="h-4 w-4" />,
  mac: <Monitor className="h-4 w-4" />,
  windows: <Monitor className="h-4 w-4" />,
  harmonyos: <Smartphone className="h-4 w-4" />,
};

export default function VersionsPage() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    platform: '' as Platform | '',
    version: '',
    buildNumber: '1',
    file: null as File | null,
    changelog: '',
    forceUpdate: false,
  });

  const platformNames: Record<Platform, string> = {
    android: 'Android',
    ios: 'iOS',
    mac: 'Mac',
    windows: 'Windows',
    harmonyos: 'HarmonyOS',
  };

  useEffect(() => {
    void fetchVersions();
  }, []);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const result = await adminFetchJson<{
        success: true;
        data: Version[];
      }>('/api/admin/versions');
      setVersions(result.data || []);
    } catch (error) {
      console.error('Failed to fetch versions:', error);
      toast.error(isEn ? 'Failed to load versions.' : '加载版本列表失败。');
    } finally {
      setLoading(false);
    }
  };

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
    if (!form.platform || !form.version || !form.file) {
      toast.error(isEn ? 'Please complete all required fields.' : '请先填写必填项并选择安装包。');
      return;
    }

    setSubmitting(true);
    try {
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: form.platform,
          version: form.version,
          buildNumber: Number(form.buildNumber || 1),
          fileUrl: uploadResult.data.url,
          fileSize: uploadResult.data.size,
          changelog: form.changelog,
          forceUpdate: form.forceUpdate,
        }),
      });

      toast.success(isEn ? 'Version uploaded successfully.' : '版本上传成功。');
      resetForm();
      await fetchVersions();
    } catch (error) {
      console.error('Failed to upload version:', error);
      toast.error(isEn ? 'Upload failed. Please try again.' : '上传失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (version: Version) => {
    try {
      await adminFetchJson(`/api/admin/versions/${version.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !version.isActive,
          forceUpdate: version.forceUpdate,
        }),
      });

      toast.success(isEn ? 'Version status updated.' : '版本状态已更新。');
      await fetchVersions();
    } catch (error) {
      console.error('Failed to update version:', error);
      toast.error(isEn ? 'Failed to update version.' : '更新版本状态失败。');
    }
  };

  const handleDelete = async (version: Version) => {
    const confirmed = window.confirm(
      isEn ? `Delete version ${version.version}?` : `确定删除版本 ${version.version} 吗？`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await adminFetchJson(`/api/admin/versions/${version.id}`, {
        method: 'DELETE',
      });

      toast.success(isEn ? 'Version deleted.' : '版本已删除。');
      await fetchVersions();
    } catch (error) {
      console.error('Failed to delete version:', error);
      toast.error(isEn ? 'Failed to delete version.' : '删除版本失败。');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isEn ? 'Version Management' : '版本管理'}</h1>
        <p className="text-gray-500">
          {isEn
            ? 'Upload release packages and manage active versions across platforms.'
            : '上传安装包并统一管理各平台的生效版本。'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEn ? 'Upload New Version' : '上传新版本'}</CardTitle>
          <CardDescription>
            {isEn
              ? 'Create a release record after the package upload succeeds.'
              : '安装包上传完成后，立即生成统一的版本记录。'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="platform">{isEn ? 'Platform *' : '平台 *'}</Label>
              <Select
                value={form.platform}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, platform: value as Platform }))
                }
              >
                <SelectTrigger id="platform">
                  <SelectValue placeholder={isEn ? 'Select platform' : '请选择平台'} />
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
              <Label htmlFor="version">{isEn ? 'Version *' : '版本号 *'}</Label>
              <Input
                id="version"
                placeholder={isEn ? 'e.g. 1.0.0' : '例如 1.0.0'}
                value={form.version}
                onChange={(event) =>
                  setForm((current) => ({ ...current, version: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="buildNumber">{isEn ? 'Build Number' : '构建号'}</Label>
              <Input
                id="buildNumber"
                type="number"
                min={1}
                value={form.buildNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, buildNumber: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">{isEn ? 'Install Package *' : '安装包 *'}</Label>
              <Input
                id="file"
                type="file"
                accept=".apk,.ipa,.dmg,.exe,.hap,.zip,.msi"
                onChange={handleFileSelect}
              />
              {form.file ? (
                <p className="text-sm text-gray-500">
                  {(isEn ? 'Selected' : '已选择')} {form.file.name} ({formatFileSize(form.file.size)})
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="changelog">{isEn ? 'Release Notes' : '更新说明'}</Label>
            <Textarea
              id="changelog"
              rows={4}
              placeholder={isEn ? 'Describe this release...' : '简要说明本次更新内容...'}
              value={form.changelog}
              onChange={(event) =>
                setForm((current) => ({ ...current, changelog: event.target.value }))
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="forceUpdate"
              checked={form.forceUpdate}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, forceUpdate: checked }))
              }
            />
            <Label htmlFor="forceUpdate" className="cursor-pointer">
              {isEn ? 'Force update for all users' : '设为强制更新，用户需升级后继续使用'}
            </Label>
          </div>

          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEn ? 'Uploading...' : '上传中...'}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {isEn ? 'Upload Version' : '上传版本'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isEn ? 'Version List' : '版本列表'}</CardTitle>
          <CardDescription>
            {isEn
              ? 'Keep at most one active version per platform.'
              : '建议每个平台始终只保留一个启用版本。'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : versions.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Upload className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>{isEn ? 'No versions yet.' : '暂无版本记录。'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex flex-1 items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      {platformIcons[version.platform]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{platformNames[version.platform]}</h3>
                        <span className="text-sm text-gray-500">v{version.version}</span>
                        {version.forceUpdate ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
                            {isEn ? 'Force Update' : '强制更新'}
                          </span>
                        ) : null}
                        {version.isActive ? (
                          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            {isEn ? 'Active' : '已启用'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            <AlertCircle className="h-3 w-3" />
                            {isEn ? 'Inactive' : '未启用'}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {`Build ${version.buildNumber} · ${formatFileSize(version.fileSize)} · ${new Date(
                          version.createdAt,
                        ).toLocaleDateString(locale)}`}
                      </div>
                      {version.changelog ? (
                        <div className="mt-2 whitespace-pre-line text-sm text-gray-600">
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
                      <Download className="mr-1 h-4 w-4" />
                      {isEn ? 'Download' : '下载'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleToggle(version)}>
                      {version.isActive
                        ? isEn
                          ? 'Disable'
                          : '停用'
                        : isEn
                          ? 'Enable'
                          : '启用'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(version)}>
                      <Trash2 className="h-4 w-4" />
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
