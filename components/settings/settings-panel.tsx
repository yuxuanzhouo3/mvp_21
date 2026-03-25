"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Globe, Bell, Shield, Moon } from "lucide-react"
import type { Language } from "@/lib/i18n"

export function SettingsPanel() {
  const [locale, setLocale] = useState<Language>("en")
  const [darkMode, setDarkMode] = useState(false)

  return (
    <div className="space-y-6">
      {/* Language & Region */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Language & Region
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Display Language</Label>
            <Select value={locale} onValueChange={(value) => setLocale(value as Language)}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">
                  <div className="flex items-center gap-2">
                    <span>🇺🇸</span>
                    English (United States)
                  </div>
                </SelectItem>
                <SelectItem value="zh">
                  <div className="flex items-center gap-2">
                    <span>🇨🇳</span>
                    中文 (简体中文)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {locale === "en" ? "Choose your preferred language for the interface" : "选择您的界面首选语言"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">Primary Region</Label>
            <Select defaultValue="us">
              <SelectTrigger id="region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">
                  <div className="flex items-center gap-2">
                    <span>🇺🇸</span>
                    {locale === "en" ? "United States" : "美国"}
                  </div>
                </SelectItem>
                <SelectItem value="cn">
                  <div className="flex items-center gap-2">
                    <span>🇨🇳</span>
                    {locale === "en" ? "China" : "中国"}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {locale === "en"
                ? "Your primary business region for compliance and legal requirements"
                : "您的主要业务地区，用于合规和法律要求"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Time Zone</Label>
            <Select defaultValue="utc-8">
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utc-8">{locale === "en" ? "(UTC-8) Pacific Time" : "(UTC-8) 太平洋时间"}</SelectItem>
                <SelectItem value="utc-5">{locale === "en" ? "(UTC-5) Eastern Time" : "(UTC-5) 东部时间"}</SelectItem>
                <SelectItem value="utc+8">
                  {locale === "en" ? "(UTC+8) China Standard Time" : "(UTC+8) 中国标准时间"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            {locale === "en" ? "Notifications" : "通知"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{locale === "en" ? "Email Notifications" : "邮件通知"}</Label>
              <p className="text-sm text-muted-foreground">
                {locale === "en" ? "Receive email updates about your contracts" : "接收有关您合同的电子邮件更新"}
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{locale === "en" ? "WeChat Notifications" : "微信通知"}</Label>
              <p className="text-sm text-muted-foreground">
                {locale === "en" ? "Get notifications via WeChat" : "通过微信接收通知"}
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{locale === "en" ? "Signature Reminders" : "签名提醒"}</Label>
              <p className="text-sm text-muted-foreground">
                {locale === "en" ? "Remind parties to sign pending contracts" : "提醒各方签署待处理的合同"}
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {locale === "en" ? "Security" : "安全"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{locale === "en" ? "Two-Factor Authentication" : "双因素认证"}</Label>
              <p className="text-sm text-muted-foreground">
                {locale === "en" ? "Add an extra layer of security to your account" : "为您的账户添加额外的安全层"}
              </p>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{locale === "en" ? "Blockchain Verification" : "区块链验证"}</Label>
              <p className="text-sm text-muted-foreground">
                {locale === "en" ? "Automatically verify all contracts on blockchain" : "自动在区块链上验证所有合同"}
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-primary" />
            {locale === "en" ? "Appearance" : "外观"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{locale === "en" ? "Dark Mode" : "深色模式"}</Label>
              <p className="text-sm text-muted-foreground">
                {locale === "en" ? "Use dark theme for the interface" : "为界面使用深色主题"}
              </p>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" className="bg-transparent">
          {locale === "en" ? "Cancel" : "取消"}
        </Button>
        <Button>{locale === "en" ? "Save Changes" : "保存更改"}</Button>
      </div>
    </div>
  )
}
