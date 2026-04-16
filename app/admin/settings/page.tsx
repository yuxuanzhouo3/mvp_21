'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Save, Send } from 'lucide-react';
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
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState('');

  const copy = useMemo(
    () => ({
      title: isEn ? 'System Settings' : '系统设置',
      description: isEn
        ? 'Manage platform profile, quotas, payment switches, and notification policies.'
        : '统一管理平台资料、配额、支付开关和通知策略。',
      save: isEn ? 'Save Settings' : '保存设置',
      reset: isEn ? 'Reset to Defaults' : '恢复默认',
      retry: isEn ? 'Retry' : '重新加载',
      loadFailed: isEn ? 'Failed to load settings.' : '加载系统设置失败。',
      saveFailed: isEn ? 'Failed to save settings.' : '保存系统设置失败。',
      saveSuccess: isEn ? 'Settings saved.' : '系统设置已保存。',
      resetSuccess: isEn ? 'Default settings restored locally.' : '当前页面已恢复默认设置。',
      general: isEn ? 'General' : '基础设置',
      quota: isEn ? 'Quota' : '配额设置',
      payment: isEn ? 'Payment' : '支付设置',
      notification: isEn ? 'Notifications' : '通知设置',
      updatedAt: isEn ? 'Last updated' : '最近更新',
      dispatchTitle: isEn ? 'Failure Notification Dispatch' : '失败通知补偿发送',
      dispatchDescription: isEn
        ? 'Queued payment-failure notifications are retried automatically. Use this action to trigger an immediate manual sweep.'
        : '支付失败通知会按重试策略留在队列中。你也可以在这里手动触发一次立即补偿发送。',
      dispatchAction: isEn ? 'Run Dispatch Now' : '立即执行补偿发送',
      dispatchRunning: isEn ? 'Dispatching...' : '正在补偿发送...',
      dispatchSuccess: isEn ? 'Queued notifications processed.' : '队列通知已处理。',
      dispatchFailed: isEn ? 'Failed to dispatch queued notifications.' : '执行补偿发送失败。',
      dispatchSummary: (processed: number, sent: number, partial: number, failed: number, suppressed: number) =>
        isEn
          ? `Processed ${processed}, sent ${sent}, partial ${partial}, failed ${failed}, suppressed ${suppressed}.`
          : `本次处理 ${processed} 条，发送成功 ${sent} 条，部分成功 ${partial} 条，失败 ${failed} 条，抑制 ${suppressed} 条。`,
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

  const handleDispatchNotifications = async () => {
    try {
      setIsDispatching(true);
      const result = await adminFetchJson<{
        success: true;
        data: {
          processed: number;
          sent: number;
          partial: number;
          failed: number;
          suppressed: number;
        };
      }>('/api/admin/notifications/payment-failures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10 }),
      });

      toast.success(copy.dispatchSuccess, {
        description: copy.dispatchSummary(
          result.data.processed,
          result.data.sent,
          result.data.partial,
          result.data.failed,
          result.data.suppressed,
        ),
      });
    } catch (dispatchError) {
      console.error('[AdminSettings] Failed to dispatch queued notifications:', dispatchError);
      toast.error(copy.dispatchFailed);
    } finally {
      setIsDispatching(false);
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
      description: isEn ? 'Allow new users to create accounts.' : '允许新用户注册平台账号。',
    },
    {
      key: 'adDisplay' as const,
      title: isEn ? 'Ad Display' : '广告展示',
      description: isEn ? 'Display marketing slots for free users.' : '向免费用户展示广告位内容。',
    },
    {
      key: 'aiContractGeneration' as const,
      title: isEn ? 'AI Contract Generation' : 'AI 合同生成',
      description: isEn ? 'Enable AI-assisted drafting workflows.' : '启用 AI 辅助起草与分析能力。',
    },
    {
      key: 'maintenanceMode' as const,
      title: isEn ? 'Maintenance Mode' : '维护模式',
      description: isEn ? 'Temporarily block normal user access.' : '临时限制普通用户访问平台。',
    },
  ];

  const emailNotificationToggles = [
    {
      key: 'newUserSignup' as const,
      title: isEn ? 'New User Signup' : '新用户注册通知',
      description: isEn ? 'Send an alert when a new account is created.' : '有新用户注册时发送提醒。',
    },
    {
      key: 'paymentSuccess' as const,
      title: isEn ? 'Payment Success' : '支付成功通知',
      description: isEn ? 'Send a message after successful payment collection.' : '支付成功后发送确认通知。',
    },
    {
      key: 'paymentFailure' as const,
      title: isEn ? 'Payment Failure' : '支付失败通知',
      description: isEn
        ? 'Queue user-facing follow-up emails when recurring payment collection fails.'
        : '续费扣款失败时，将面向用户的后续通知加入队列。',
    },
    {
      key: 'subscriptionExpiry' as const,
      title: isEn ? 'Subscription Expiry' : '订阅到期提醒',
      description: isEn ? 'Notify users before their plan expires.' : '在会员到期前发送提醒。',
    },
  ];

  const adminNotificationToggles = [
    {
      key: 'dailyReport' as const,
      title: isEn ? 'Daily Report' : '每日汇总',
      description: isEn ? 'Send a daily operations summary to admins.' : '向管理员发送每日运营摘要。',
    },
    {
      key: 'exceptionAlerts' as const,
      title: isEn ? 'Exception Alerts' : '异常告警',
      description: isEn
        ? 'Alert admins when payment collection or platform operations fail.'
        : '支付与系统操作出现异常时，立即提醒管理员。',
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
              <CardTitle>{isEn ? 'Platform Profile' : '平台信息'}</CardTitle>
              <CardDescription>
                {isEn ? 'Edit the public-facing platform profile and support channels.' : '维护平台对外资料与联系渠道。'}
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
                  label={isEn ? 'Support Email' : '支持邮箱'}
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
                {isEn ? 'Turn key product capabilities on or off.' : '统一控制平台核心能力的开关状态。'}
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
              <CardTitle>{isEn ? 'Free Plan Quotas' : '免费版配额'}</CardTitle>
              <CardDescription>
                {isEn ? 'Set usage limits for free accounts.' : '配置免费账户的使用限制。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label={isEn ? 'Contracts / Month' : '每月可创建合同数'}
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
                  label={isEn ? 'Storage Retention (Days)' : '存储保留天数'}
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
                        ? 'Higher free quotas improve activation, but they also increase storage and AI cost.'
                        : '提高免费额度有助于提升转化前体验，但也会增加存储与 AI 成本。'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Paid Plan Quotas' : '付费版配额'}</CardTitle>
              <CardDescription>
                {isEn ? 'Configure limits for paid members.' : '配置付费会员的容量上限。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField
                label={isEn ? 'Contracts / Month' : '每月可创建合同数'}
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
                label={isEn ? 'Storage Retention' : '存储保留时长'}
                value={settings.quota.proStorageDays}
                options={[
                  { value: '30', label: isEn ? '30 days' : '30 天' },
                  { value: '365', label: isEn ? '1 year' : '1 年' },
                  { value: 'unlimited', label: isEn ? 'Permanent' : '长期保留' },
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
                {isEn ? 'Enable supported channels by deployment region.' : '按部署区域控制可用支付方式。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'wechat' as const, label: isEn ? 'WeChat Pay' : '微信支付' },
                { key: 'alipay' as const, label: 'Alipay' },
                { key: 'stripe' as const, label: 'Stripe' },
              ].map((item) => (
                <ToggleRow
                  key={item.key}
                  title={item.label}
                  description={isEn ? 'Available when the active deployment region supports it.' : '在当前部署区域支持时开放给用户使用。'}
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
              <CardTitle>{isEn ? 'Pricing Benchmarks' : '定价基线'}</CardTitle>
              <CardDescription>
                {isEn ? 'Set benchmark prices for operational configuration.' : '设置运营侧使用的套餐价格基线。'}
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
              <CardTitle>{isEn ? 'Email Notifications' : '用户通知'}</CardTitle>
              <CardDescription>
                {isEn ? 'Manage user-facing lifecycle and billing notifications.' : '统一管理面向用户的生命周期与支付通知。'}
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
                {isEn ? 'Set recipients and escalation switches for operations alerts.' : '配置运维通知接收人和告警策略。'}
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

          <Card>
            <CardHeader>
              <CardTitle>{copy.dispatchTitle}</CardTitle>
              <CardDescription>{copy.dispatchDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  {isEn
                    ? 'When the payment provider fails to collect a subscription renewal, the system queues a notification record and retries delivery with backoff.'
                    : '当支付渠道扣款失败时，系统会先记录通知队列，并按退避策略自动重试发送。'}
                </p>
                <p>
                  {isEn
                    ? 'Use the manual action after updating the notification recipient list or email provider configuration.'
                    : '如果你刚更新了接收邮箱或邮件通道配置，可以手动执行一次补偿发送。'}
                </p>
              </div>
              <Button onClick={handleDispatchNotifications} disabled={isDispatching}>
                {isDispatching ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {isDispatching ? copy.dispatchRunning : copy.dispatchAction}
              </Button>
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
