'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { adminFetchJson } from '@/lib/admin/client';
import { DEFAULT_ADMIN_SETTINGS, type AdminSettings } from '@/lib/admin/settings-schema';

function updateNestedSettings<T extends keyof AdminSettings>(
  current: AdminSettings,
  section: T,
  value: AdminSettings[T],
) {
  return {
    ...current,
    [section]: value,
  };
}

export default function SettingsPage() {
  const { language } = useLanguage();
  const isEn = language === 'en';

  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const copy = useMemo(
    () => ({
      title: isEn ? 'System Settings' : '系统设置',
      description: isEn
        ? 'Manage platform configuration, contact channels, quotas, payment switches, and notification policies.'
        : '统一管理平台配置、联系渠道、额度、支付开关和通知策略。',
      save: isEn ? 'Save Settings' : '保存设置',
      reset: isEn ? 'Reset to Defaults' : '恢复默认值',
      retry: isEn ? 'Retry' : '重新加载',
      loadFailed: isEn ? 'Failed to load settings.' : '加载系统设置失败。',
      saveFailed: isEn ? 'Failed to save settings.' : '保存系统设置失败。',
      saveSuccess: isEn ? 'Settings saved.' : '系统设置已保存。',
      resetSuccess: isEn ? 'Default settings restored locally.' : '已在当前页面恢复默认设置。',
      general: isEn ? 'General' : '基础设置',
      quota: isEn ? 'Quota' : '额度设置',
      payment: isEn ? 'Payment' : '支付设置',
      notification: isEn ? 'Notifications' : '通知设置',
      updatedAt: isEn ? 'Last updated' : '最近更新',
    }),
    [isEn],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        setLoading(true);
        setError('');
        const result = await adminFetchJson<{ success: true; data: AdminSettings }>('/api/admin/settings');
        if (!cancelled) {
          setSettings(result.data || DEFAULT_ADMIN_SETTINGS);
        }
      } catch (loadError) {
        console.error('[AdminSettings] Failed to load settings:', loadError);
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : copy.loadFailed;
          setError(message);
          toast.error(copy.loadFailed);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [copy.loadFailed]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const result = await adminFetchJson<{ success: true; data: AdminSettings }>('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSettings(result.data || settings);
      toast.success(copy.saveSuccess);
    } catch (saveError) {
      console.error('[AdminSettings] Failed to save settings:', saveError);
      toast.error(copy.saveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const restoreDefaults = () => {
    setSettings(DEFAULT_ADMIN_SETTINGS);
    toast.success(copy.resetSuccess);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex min-h-[300px] flex-col items-center justify-center gap-4 py-12 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {copy.retry}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const featureToggles = [
    {
      key: 'userRegistration' as const,
      title: isEn ? 'User Registration' : '用户注册',
      description: isEn ? 'Allow new users to sign up.' : '允许新用户注册平台账户。',
    },
    {
      key: 'adDisplay' as const,
      title: isEn ? 'Ad Display' : '广告展示',
      description: isEn ? 'Show ads to free users.' : '向免费用户展示广告。',
    },
    {
      key: 'aiContractGeneration' as const,
      title: isEn ? 'AI Contract Generation' : 'AI 合同生成',
      description: isEn ? 'Enable AI-powered drafting.' : '启用 AI 自动起草能力。',
    },
    {
      key: 'maintenanceMode' as const,
      title: isEn ? 'Maintenance Mode' : '维护模式',
      description: isEn ? 'Temporarily block regular user access.' : '开启后临时阻止普通用户访问。',
    },
  ];

  const emailNotificationToggles = [
    {
      key: 'newUserSignup' as const,
      title: isEn ? 'New User Signup' : '新用户注册通知',
      description: isEn ? 'Notify when a new user signs up.' : '当有新用户注册时触发通知。',
    },
    {
      key: 'paymentSuccess' as const,
      title: isEn ? 'Payment Success' : '支付成功通知',
      description: isEn ? 'Notify after successful payment.' : '支付成功后触发通知。',
    },
    {
      key: 'paymentFailure' as const,
      title: isEn ? 'Payment Failure' : '支付失败通知',
      description: isEn
        ? 'Queue failure notifications when recurring payment collection fails.'
        : '当续费扣款失败时，进入失败通知与补偿队列。',
    },
    {
      key: 'subscriptionExpiry' as const,
      title: isEn ? 'Subscription Expiry' : '订阅到期提醒',
      description: isEn ? 'Notify before membership expires.' : '在会员到期前发送提醒。',
    },
  ];

  const adminNotificationToggles = [
    {
      key: 'dailyReport' as const,
      title: isEn ? 'Daily Report' : '每日报告',
      description: isEn ? 'Send a daily operations summary.' : '每日汇总运营数据与异常情况。',
    },
    {
      key: 'exceptionAlerts' as const,
      title: isEn ? 'Exception Alerts' : '异常告警',
      description: isEn
        ? 'Alert admins immediately for important payment and system failures.'
        : '重要支付失败和系统异常时即时通知管理员。',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-muted-foreground">{copy.description}</p>
          {settings.updatedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.updatedAt}: {new Date(settings.updatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={restoreDefaults}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {copy.reset}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {copy.save}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{copy.general}</TabsTrigger>
          <TabsTrigger value="quota">{copy.quota}</TabsTrigger>
          <TabsTrigger value="payment">{copy.payment}</TabsTrigger>
          <TabsTrigger value="notification">{copy.notification}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Platform Info' : '平台信息'}</CardTitle>
              <CardDescription>
                {isEn ? 'Basic platform profile and public contact info.' : '平台基础资料和对外联系信息。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label={isEn ? 'Platform Name' : '平台名称'}
                  value={settings.general.platformName}
                  onChange={(value) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'general', { ...current.general, platformName: value }),
                    )
                  }
                />
                <InputField
                  label={isEn ? 'Domain' : '平台域名'}
                  value={settings.general.domain}
                  onChange={(value) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'general', { ...current.general, domain: value }),
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{isEn ? 'Description' : '平台描述'}</Label>
                <Textarea
                  rows={3}
                  value={settings.general.description}
                  onChange={(event) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'general', { ...current.general, description: event.target.value }),
                    )
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <InputField
                  label={isEn ? 'Support Email' : '客服邮箱'}
                  value={settings.general.supportEmail}
                  onChange={(value) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'general', { ...current.general, supportEmail: value }),
                    )
                  }
                />
                <InputField
                  label={isEn ? 'Sales Email' : '销售邮箱'}
                  value={settings.general.salesEmail}
                  onChange={(value) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'general', { ...current.general, salesEmail: value }),
                    )
                  }
                />
                <InputField
                  label={isEn ? 'Hotline' : '服务热线'}
                  value={settings.general.hotline}
                  onChange={(value) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'general', { ...current.general, hotline: value }),
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Feature Toggles' : '功能开关'}</CardTitle>
              <CardDescription>
                {isEn ? 'Enable or disable key product capabilities.' : '统一控制核心产品能力开关。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {featureToggles.map((item) => (
                <ToggleRow
                  key={item.key}
                  title={item.title}
                  description={item.description}
                  checked={settings.features[item.key]}
                  onCheckedChange={(checked) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'features', { ...current.features, [item.key]: checked }),
                    )
                  }
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quota" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Free Plan Quotas' : '免费版额度'}</CardTitle>
              <CardDescription>
                {isEn ? 'Set usage limits for free users.' : '配置免费用户的使用额度。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label={isEn ? 'Contracts / Month' : '每月合同数'}
                  type="number"
                  value={String(settings.quota.freeContractsPerMonth)}
                  onChange={(value) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'quota', {
                        ...current.quota,
                        freeContractsPerMonth: Number(value || 0),
                      }),
                    )
                  }
                />
                <InputField
                  label={isEn ? 'Cloud Storage Days' : '云存储天数'}
                  type="number"
                  value={String(settings.quota.freeStorageDays)}
                  onChange={(value) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'quota', {
                        ...current.quota,
                        freeStorageDays: Number(value || 0),
                      }),
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-yellow-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">{isEn ? 'Tip' : '提示'}</p>
                    <p className="text-sm text-yellow-700">
                      {isEn
                        ? 'Higher free quotas usually improve retention, but they also increase infrastructure cost.'
                        : '提高免费额度通常有利于留存，但也会提升基础设施成本。'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Pro Plan Quotas' : 'Pro 额度'}</CardTitle>
              <CardDescription>
                {isEn ? 'Configure limits for paid members.' : '配置付费会员的容量上限。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField
                label={isEn ? 'Contracts / Month' : '每月合同数'}
                value={settings.quota.proContractsPerMonth}
                options={[
                  { value: '100', label: '100' },
                  { value: '500', label: '500' },
                  { value: 'unlimited', label: isEn ? 'Unlimited' : '不限' },
                ]}
                onValueChange={(value) =>
                  setSettings((current) =>
                    updateNestedSettings(current, 'quota', { ...current.quota, proContractsPerMonth: value }),
                  )
                }
              />
              <SelectField
                label={isEn ? 'Cloud Storage' : '云存储时长'}
                value={settings.quota.proStorageDays}
                options={[
                  { value: '30', label: isEn ? '30 days' : '30 天' },
                  { value: '365', label: isEn ? '1 year' : '1 年' },
                  { value: 'unlimited', label: isEn ? 'Permanent' : '长期' },
                ]}
                onValueChange={(value) =>
                  setSettings((current) =>
                    updateNestedSettings(current, 'quota', { ...current.quota, proStorageDays: value }),
                  )
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Payment Channels' : '支付渠道'}</CardTitle>
              <CardDescription>
                {isEn ? 'Configure enabled channels across regions.' : '统一管理各区域可用的支付渠道。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'wechat' as const, label: isEn ? 'WeChat Pay' : '微信支付' },
                { key: 'alipay' as const, label: 'Alipay' },
                { key: 'stripe' as const, label: 'Stripe' },
                { key: 'paypal' as const, label: 'PayPal' },
              ].map((item) => (
                <ToggleRow
                  key={item.key}
                  title={item.label}
                  description={isEn ? 'Available in supported regions.' : '在支持的区域内启用该支付方式。'}
                  checked={settings.payment.channels[item.key]}
                  onCheckedChange={(checked) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'payment', {
                        ...current.payment,
                        channels: { ...current.payment.channels, [item.key]: checked },
                      }),
                    )
                  }
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Pricing Settings' : '定价设置'}</CardTitle>
              <CardDescription>
                {isEn ? 'Set benchmark prices for plan configuration.' : '设置会员方案的基准价格。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                { key: 'proMonthlyCny' as const, label: isEn ? 'Pro Monthly (CNY)' : 'Pro 月付 (CNY)' },
                { key: 'proYearlyCny' as const, label: isEn ? 'Pro Yearly (CNY)' : 'Pro 年付 (CNY)' },
                { key: 'enterpriseMonthlyCny' as const, label: isEn ? 'Enterprise Monthly (CNY)' : '企业版月付 (CNY)' },
                { key: 'enterpriseYearlyCny' as const, label: isEn ? 'Enterprise Yearly (CNY)' : '企业版年付 (CNY)' },
              ].map((item) => (
                <InputField
                  key={item.key}
                  label={item.label}
                  type="number"
                  value={String(settings.payment.pricing[item.key])}
                  onChange={(value) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'payment', {
                        ...current.payment,
                        pricing: { ...current.payment.pricing, [item.key]: Number(value || 0) },
                      }),
                    )
                  }
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notification" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Email Notifications' : '邮件通知'}</CardTitle>
              <CardDescription>
                {isEn ? 'Configure user-facing lifecycle emails.' : '统一配置面向用户的生命周期通知。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {emailNotificationToggles.map((item) => (
                <ToggleRow
                  key={item.key}
                  title={item.title}
                  description={item.description}
                  checked={settings.notification.email[item.key]}
                  onCheckedChange={(checked) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'notification', {
                        ...current.notification,
                        email: { ...current.notification.email, [item.key]: checked },
                      }),
                    )
                  }
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Admin Notifications' : '管理员通知'}</CardTitle>
              <CardDescription>
                {isEn ? 'Set recipients and ops alert switches.' : '设置运维通知接收人和告警策略。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <InputField
                label={isEn ? 'Notification Emails' : '通知接收邮箱'}
                value={settings.notification.admin.notificationEmails}
                onChange={(value) =>
                  setSettings((current) =>
                    updateNestedSettings(current, 'notification', {
                      ...current.notification,
                      admin: { ...current.notification.admin, notificationEmails: value },
                    }),
                  )
                }
                hint={isEn ? 'Separate multiple addresses with commas.' : '多个邮箱请使用英文逗号分隔。'}
              />

              {adminNotificationToggles.map((item) => (
                <ToggleRow
                  key={item.key}
                  title={item.title}
                  description={item.description}
                  checked={settings.notification.admin[item.key]}
                  onCheckedChange={(checked) =>
                    setSettings((current) =>
                      updateNestedSettings(current, 'notification', {
                        ...current.notification,
                        admin: { ...current.notification.admin, [item.key]: checked },
                      }),
                    )
                  }
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
