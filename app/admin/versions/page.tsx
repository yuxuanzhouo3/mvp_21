'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Upload, Download, Trash2, CheckCircle, AlertCircle, Smartphone, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';

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

const mockVersions: Version[] = [
  {
    id: '1',
    platform: 'android',
    version: '1.0.0',
    buildNumber: 1,
    fileUrl: 'https://example.com/ContractHub-v1.0.0.apk',
    fileSize: 52428800,
    changelog: 'Initial release\n- Contract generation\n- User authentication\n- Payment flow',
    forceUpdate: false,
    isActive: true,
    createdAt: '2025-01-01',
  },
];

const platformIcons: Record<Platform, React.ReactNode> = {
  android: <Smartphone className="h-4 w-4" />,
  ios: <Smartphone className="h-4 w-4" />,
  mac: <Monitor className="h-4 w-4" />,
  windows: <Monitor className="h-4 w-4" />,
  harmonyos: <Smartphone className="h-4 w-4" />,
};

export default function VersionsPage() {
  const [versions, setVersions] = useState<Version[]>(mockVersions);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    platform: '' as Platform,
    version: '',
    buildNumber: '',
    file: null as File | null,
    changelog: '',
    forceUpdate: false,
  });
  const { language } = useLanguage();
  const isEn = language === 'en';

  const platformNames: Record<Platform, string> = {
    android: 'Android',
    ios: 'iOS',
    mac: 'Mac',
    windows: 'Windows',
    harmonyos: isEn ? 'HarmonyOS' : '鸿蒙',
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm({ ...uploadForm, file });
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.platform || !uploadForm.version) {
      toast.error(isEn ? 'Please fill in all required fields' : '请填写所有必填项');
      return;
    }

    setIsUploading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const newVersion: Version = {
        id: Date.now().toString(),
        platform: uploadForm.platform,
        version: uploadForm.version,
        buildNumber: parseInt(uploadForm.buildNumber) || 1,
        fileUrl: URL.createObjectURL(uploadForm.file),
        fileSize: uploadForm.file.size,
        changelog: uploadForm.changelog,
        forceUpdate: uploadForm.forceUpdate,
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
      };

      setVersions([newVersion, ...versions]);
      setUploadForm({
        platform: '' as Platform,
        version: '',
        buildNumber: '',
        file: null,
        changelog: '',
        forceUpdate: false,
      });

      toast.success(isEn ? 'Version uploaded successfully' : '版本上传成功！');
    } catch (error) {
      toast.error(isEn ? 'Upload failed. Please retry.' : '上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleActive = (id: string) => {
    setVersions(versions.map((v) => (v.id === id ? { ...v, isActive: !v.isActive } : v)));
    toast.success(isEn ? 'Version status updated' : '版本状态已更新');
  };

  const deleteVersion = (id: string) => {
    const confirmed = confirm(isEn ? 'Delete this version?' : '确定要删除这个版本吗？');
    if (confirmed) {
      setVersions(versions.filter((v) => v.id !== id));
      toast.success(isEn ? 'Version deleted' : '版本已删除');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isEn ? 'Version Management' : '版本管理'}</h1>
        <p className="text-gray-500">{isEn ? 'Upload and manage application versions across platforms' : '上传和管理各平台应用版本'}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEn ? 'Upload New Version' : '上传新版本'}</CardTitle>
          <CardDescription>{isEn ? 'Upload app package and configure version metadata' : '上传应用安装包并配置版本信息'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="platform">{isEn ? 'Platform *' : '平台 *'}</Label>
              <Select
                value={uploadForm.platform}
                onValueChange={(value) => setUploadForm({ ...uploadForm, platform: value as Platform })}
              >
                <SelectTrigger id="platform">
                  <SelectValue placeholder={isEn ? 'Select platform' : '选择平台'} />
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
                placeholder={isEn ? 'e.g. 1.0.0' : '例如: 1.0.0'}
                value={uploadForm.version}
                onChange={(e) => setUploadForm({ ...uploadForm, version: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="buildNumber">{isEn ? 'Build Number' : 'Build号'}</Label>
              <Input
                id="buildNumber"
                type="number"
                placeholder={isEn ? 'e.g. 1' : '例如: 1'}
                value={uploadForm.buildNumber}
                onChange={(e) => setUploadForm({ ...uploadForm, buildNumber: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">{isEn ? 'Install Package *' : '安装包文件 *'}</Label>
              <Input
                id="file"
                type="file"
                accept=".apk,.ipa,.dmg,.exe,.hap"
                onChange={handleFileSelect}
              />
              {uploadForm.file && (
                <p className="text-sm text-gray-500">
                  {isEn ? 'Selected' : '已选择'}: {uploadForm.file.name} ({formatFileSize(uploadForm.file.size)})
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="changelog">{isEn ? 'Release Notes' : '更新日志'}</Label>
            <Textarea
              id="changelog"
              placeholder={isEn ? 'Describe changes in this version...' : '输入本版本的更新内容...'}
              rows={4}
              value={uploadForm.changelog}
              onChange={(e) => setUploadForm({ ...uploadForm, changelog: e.target.value })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="forceUpdate"
              checked={uploadForm.forceUpdate}
              onCheckedChange={(checked) => setUploadForm({ ...uploadForm, forceUpdate: checked })}
            />
            <Label htmlFor="forceUpdate" className="cursor-pointer">
              {isEn ? 'Force update (required to continue using app)' : '强制更新（用户必须更新才能使用）'}
            </Label>
          </div>

          <Button onClick={handleUpload} disabled={isUploading} className="w-full md:w-auto">
            {isUploading ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-spin" />
                {isEn ? 'Uploading...' : '上传中...'}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {isEn ? 'Upload Version' : '上传版本'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isEn ? 'Version List' : '版本列表'}</CardTitle>
          <CardDescription>{isEn ? 'Uploaded application versions' : '已上传的应用版本'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {versions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{isEn ? 'No versions uploaded yet' : '还没有上传任何版本'}</p>
              </div>
            ) : (
              versions.map((version) => (
                <div key={version.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      {platformIcons[version.platform]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{platformNames[version.platform]}</h3>
                        <span className="text-sm text-gray-500">v{version.version}</span>
                        {version.forceUpdate && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                            {isEn ? 'Force Update' : '强制更新'}
                          </span>
                        )}
                        {version.isActive ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-600 rounded-full">
                            <CheckCircle className="h-3 w-3" />
                            {isEn ? 'Active' : '生效中'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                            <AlertCircle className="h-3 w-3" />
                            {isEn ? 'Disabled' : '已停用'}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        Build {version.buildNumber} · {formatFileSize(version.fileSize)} · {version.createdAt}
                      </div>
                      {version.changelog && (
                        <div className="mt-2 text-sm text-gray-600 whitespace-pre-line">{version.changelog}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.open(version.fileUrl, '_blank')}>
                      <Download className="h-4 w-4 mr-1" />
                      {isEn ? 'Download' : '下载'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggleActive(version.id)}>
                      {version.isActive ? (isEn ? 'Disable' : '停用') : isEn ? 'Enable' : '启用'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteVersion(version.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
