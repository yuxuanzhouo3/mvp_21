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
    toast.success(isEn ? 'Settings saved' : '设置已保存');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? 'System Settings' : '系统设置'}</h1>
          <p className="text-gray-500">{isEn ? 'Manage platform configuration and system parameters' : '管理平台配置和系统参数'}</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isEn ? 'Save Settings' : '保存设置'}
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{isEn ? 'General' : '基本设置'}</TabsTrigger>
          <TabsTrigger value="quota">{isEn ? 'Quota' : '额度设置'}</TabsTrigger>
          <TabsTrigger value="payment">{isEn ? 'Payment' : '支付设置'}</TabsTrigger>
          <TabsTrigger value="notification">{isEn ? 'Notifications' : '通知设置'}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Platform Info' : '平台信息'}</CardTitle>
              <CardDescription>{isEn ? 'Basic platform profile settings' : '基本平台配置信息'}</CardDescription>
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
                      : 'AI智能合同生成平台，将对话一键转化为规范合同'
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
              <CardDescription>{isEn ? 'Enable or disable product capabilities' : '控制平台功能的启用状态'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'User Registration' : '用户注册'}</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Allow new users to sign up' : '允许新用户注册账号'}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'Ad Display' : '广告展示'}</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Show ads to free users' : '向免费用户展示广告'}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'AI Contract Generation' : 'AI合同生成'}</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Enable AI-powered contract generation' : '启用AI智能合同生成功能'}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'Maintenance Mode' : '维护模式'}</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Block user access while maintenance is active' : '开启后用户无法访问平台'}</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quota" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Free Plan Quotas' : '免费用户额度'}</CardTitle>
              <CardDescription>{isEn ? 'Set usage limits for free users' : '设置免费用户的使用限制'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isEn ? 'Contracts / Month' : '每月合同数'}</Label>
                  <Input type="number" defaultValue="10" />
                  <p className="text-xs text-gray-500">{isEn ? 'How many contracts free users can generate each month' : '免费用户每月可生成的合同数量'}</p>
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Cloud Storage Days' : '云存储天数'}</Label>
                  <Input type="number" defaultValue="7" />
                  <p className="text-xs text-gray-500">{isEn ? 'Days contracts are retained in cloud storage' : '合同在云端保存的天数'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">{isEn ? 'Tip' : '提示'}</p>
                    <p className="text-sm text-yellow-700">
                      {isEn
                        ? 'Increasing free quotas can improve retention but also raises infrastructure cost.'
                        : '增加免费额度可以提升用户留存，但会增加服务器成本'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Pro Plan Quotas' : '专业版额度'}</CardTitle>
              <CardDescription>{isEn ? 'Set limits for Pro users' : '设置专业版用户的使用限制'}</CardDescription>
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
                      <SelectItem value="100">{isEn ? '100' : '100份'}</SelectItem>
                      <SelectItem value="500">{isEn ? '500' : '500份'}</SelectItem>
                      <SelectItem value="unlimited">{isEn ? 'Unlimited' : '无限'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Cloud Storage' : '云存储'}</Label>
                  <Select defaultValue="unlimited">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">{isEn ? '30 days' : '30天'}</SelectItem>
                      <SelectItem value="365">{isEn ? '1 year' : '1年'}</SelectItem>
                      <SelectItem value="unlimited">{isEn ? 'Permanent' : '永久'}</SelectItem>
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
              <CardTitle>{isEn ? 'China Payment Channels' : '国内支付'}</CardTitle>
              <CardDescription>{isEn ? 'Configure payment channels for China' : '配置国内支付渠道'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'WeChat Pay' : '微信支付'}</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Enable WeChat payment' : '启用微信支付'}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'Alipay' : '支付宝'}</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Enable Alipay payment' : '启用支付宝支付'}</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Global Payment Channels' : '国际支付'}</CardTitle>
              <CardDescription>{isEn ? 'Configure global payment channels' : '配置国际支付渠道'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Stripe</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Enable Stripe payment' : '启用Stripe支付'}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">PayPal</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Enable PayPal payment' : '启用PayPal支付'}</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Pricing Settings' : '定价设置'}</CardTitle>
              <CardDescription>{isEn ? 'Set pricing by plan' : '设置各方案的价格'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isEn ? 'Pro Monthly (CNY)' : '专业版月付 (CNY)'}</Label>
                  <Input type="number" defaultValue="29" />
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Pro Yearly (CNY)' : '专业版年付 (CNY)'}</Label>
                  <Input type="number" defaultValue="199" />
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Enterprise Monthly (CNY)' : '企业版月付 (CNY)'}</Label>
                  <Input type="number" defaultValue="99" />
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Enterprise Yearly (CNY)' : '企业版年付 (CNY)'}</Label>
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
              <CardDescription>{isEn ? 'Configure system email notifications' : '配置系统邮件通知'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'New User Signup' : '新用户注册通知'}</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Send email when a new user signs up' : '有新用户注册时发送邮件'}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'Payment Success' : '支付成功通知'}</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Send email when payment succeeds' : '用户付款成功时发送邮件'}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'Subscription Expiry' : '订阅到期提醒'}</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Send reminder before subscription expires' : '订阅即将到期时发送提醒'}</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Admin Notifications' : '管理员通知'}</CardTitle>
              <CardDescription>{isEn ? 'Configure notifications sent to admins' : '配置发送给管理员的通知'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{isEn ? 'Notification Email' : '通知接收邮箱'}</Label>
                <Input defaultValue="admin@contracthub.com" />
                <p className="text-xs text-gray-500">{isEn ? 'Separate multiple emails with commas' : '多个邮箱用逗号分隔'}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'Daily Report' : '每日报告'}</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Send data summary every day' : '每天发送数据摘要报告'}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{isEn ? 'Exception Alerts' : '异常告警'}</p>
                  <p className="text-sm text-gray-500">{isEn ? 'Notify immediately when system errors occur' : '系统异常时立即通知'}</p>
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
