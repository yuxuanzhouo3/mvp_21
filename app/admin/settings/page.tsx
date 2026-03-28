'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const { language } = useLanguage();
  const isEn = language === 'en';

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    toast.success(isEn ? 'Settings saved.' : '设置已保存。');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isEn ? 'System Settings' : '系统设置'}
          </h1>
          <p className="text-gray-500">
            {isEn
              ? 'Manage platform configuration and system parameters.'
              : '管理平台配置和系统参数。'}
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isEn ? 'Save Settings' : '保存设置'}
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{isEn ? 'General' : '基础设置'}</TabsTrigger>
          <TabsTrigger value="quota">{isEn ? 'Quota' : '配额设置'}</TabsTrigger>
          <TabsTrigger value="payment">{isEn ? 'Payment' : '支付设置'}</TabsTrigger>
          <TabsTrigger value="notification">
            {isEn ? 'Notifications' : '通知设置'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Platform Info' : '平台信息'}</CardTitle>
              <CardDescription>
                {isEn ? 'Basic platform profile settings.' : '基础平台信息配置。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isEn ? 'Platform Name' : '平台名称'}</Label>
                  <Input defaultValue="ContractHub" />
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Domain' : '平台域名'}</Label>
                  <Input defaultValue="contracthub.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{isEn ? 'Description' : '平台描述'}</Label>
                <Textarea
                  defaultValue={
                    isEn
                      ? 'AI-powered contract generation platform that turns conversations into compliant contracts.'
                      : 'AI 驱动的合同生成平台，可将对话内容快速转为合规合同。'
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>{isEn ? 'Support Email' : '客服邮箱'}</Label>
                <Input defaultValue="support@contracthub.com" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Feature Toggles' : '功能开关'}</CardTitle>
              <CardDescription>
                {isEn ? 'Enable or disable product capabilities.' : '开启或关闭平台功能。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {isEn ? 'User Registration' : '用户注册'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isEn ? 'Allow new users to sign up.' : '允许新用户注册平台账号。'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'Ad Display' : '广告展示'}</p>
                  <p className="text-sm text-gray-500">
                    {isEn ? 'Show ads to free users.' : '向免费用户展示广告。'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {isEn ? 'AI Contract Generation' : 'AI 合同生成'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isEn
                      ? 'Enable AI-powered contract generation.'
                      : '启用 AI 自动生成合同能力。'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {isEn ? 'Maintenance Mode' : '维护模式'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isEn
                      ? 'Block user access while maintenance is active.'
                      : '开启后，普通用户暂时无法访问平台。'}
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quota" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Free Plan Quotas' : '免费版配额'}</CardTitle>
              <CardDescription>
                {isEn ? 'Set usage limits for free users.' : '设置免费用户的使用限制。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isEn ? 'Contracts / Month' : '每月合同数'}</Label>
                  <Input type="number" defaultValue="10" />
                  <p className="text-xs text-gray-500">
                    {isEn
                      ? 'Maximum contracts generated per month.'
                      : '免费用户每月可生成的合同上限。'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Cloud Storage Days' : '云存储天数'}</Label>
                  <Input type="number" defaultValue="7" />
                  <p className="text-xs text-gray-500">
                    {isEn
                      ? 'Retention days for cloud documents.'
                      : '合同与文件在云端保留的天数。'}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-yellow-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">
                      {isEn ? 'Tip' : '提示'}
                    </p>
                    <p className="text-sm text-yellow-700">
                      {isEn
                        ? 'Higher free quotas may improve retention, but also increase infrastructure cost.'
                        : '提高免费额度有助于留存，但也会增加整体基础设施成本。'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Pro Plan Quotas' : 'Pro 配额'}</CardTitle>
              <CardDescription>
                {isEn ? 'Set limits for Pro users.' : '设置 Pro 用户的使用上限。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isEn ? 'Contracts / Month' : '每月合同数'}</Label>
                  <Select defaultValue="unlimited">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                      <SelectItem value="unlimited">
                        {isEn ? 'Unlimited' : '不限'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Cloud Storage' : '云存储时长'}</Label>
                  <Select defaultValue="unlimited">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">
                        {isEn ? '30 days' : '30 天'}
                      </SelectItem>
                      <SelectItem value="365">
                        {isEn ? '1 year' : '1 年'}
                      </SelectItem>
                      <SelectItem value="unlimited">
                        {isEn ? 'Permanent' : '长期'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'China Payment Channels' : '国内支付通道'}</CardTitle>
              <CardDescription>
                {isEn ? 'Configure payment channels for China.' : '配置国内支付渠道。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'WeChat Pay' : '微信支付'}</p>
                  <p className="text-sm text-gray-500">
                    {isEn ? 'Enable WeChat payment.' : '启用微信支付渠道。'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Alipay</p>
                  <p className="text-sm text-gray-500">
                    {isEn ? 'Enable Alipay payment.' : '启用支付宝支付渠道。'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Global Payment Channels' : '国际支付通道'}</CardTitle>
              <CardDescription>
                {isEn ? 'Configure global payment channels.' : '配置国际支付渠道。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Stripe</p>
                  <p className="text-sm text-gray-500">
                    {isEn ? 'Enable Stripe payment.' : '启用 Stripe 支付。'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">PayPal</p>
                  <p className="text-sm text-gray-500">
                    {isEn ? 'Enable PayPal payment.' : '启用 PayPal 支付。'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Pricing Settings' : '定价设置'}</CardTitle>
              <CardDescription>
                {isEn ? 'Set pricing by subscription plan.' : '按方案配置价格。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isEn ? 'Pro Monthly (CNY)' : 'Pro 月付 (CNY)'}</Label>
                  <Input type="number" defaultValue="29" />
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Pro Yearly (CNY)' : 'Pro 年付 (CNY)'}</Label>
                  <Input type="number" defaultValue="199" />
                </div>
                <div className="space-y-2">
                  <Label>
                    {isEn ? 'Enterprise Monthly (CNY)' : '企业版月付 (CNY)'}
                  </Label>
                  <Input type="number" defaultValue="99" />
                </div>
                <div className="space-y-2">
                  <Label>
                    {isEn ? 'Enterprise Yearly (CNY)' : '企业版年付 (CNY)'}
                  </Label>
                  <Input type="number" defaultValue="799" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notification" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Email Notifications' : '邮件通知'}</CardTitle>
              <CardDescription>
                {isEn ? 'Configure system email notifications.' : '配置系统邮件通知。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {isEn ? 'New User Signup' : '新用户注册通知'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isEn
                      ? 'Send email when a new user signs up.'
                      : '有新用户注册时发送邮件提醒。'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {isEn ? 'Payment Success' : '支付成功通知'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isEn
                      ? 'Send email when payment succeeds.'
                      : '用户付款成功后发送通知。'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {isEn ? 'Subscription Expiry' : '订阅到期提醒'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isEn
                      ? 'Send reminders before subscription expires.'
                      : '订阅即将到期时发送提醒。'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Admin Notifications' : '管理员通知'}</CardTitle>
              <CardDescription>
                {isEn ? 'Notifications sent to admins.' : '发给管理员的系统通知。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{isEn ? 'Notification Email' : '通知接收邮箱'}</Label>
                <Input defaultValue="admin@contracthub.com" />
                <p className="text-xs text-gray-500">
                  {isEn
                    ? 'Separate multiple email addresses with commas.'
                    : '多个邮箱请用逗号分隔。'}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'Daily Report' : '每日报告'}</p>
                  <p className="text-sm text-gray-500">
                    {isEn ? 'Send a daily summary email.' : '每天发送一次数据摘要。'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {isEn ? 'Exception Alerts' : '异常告警'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isEn
                      ? 'Notify immediately when system errors occur.'
                      : '系统异常时立即通知管理员。'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
