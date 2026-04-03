"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Globe, Bell, Shield, Moon } from "lucide-react"
import { useLanguage } from "@/components/language-provider"
import { useTranslations, type Language } from "@/lib/i18n"
import {
  getDefaultLanguage,
  isChinaDeployment,
} from "@/lib/config/deployment.config"

export function SettingsPanel() {
  const { language } = useLanguage()
  const t = useTranslations(language)
  const content = t.settingsPanel
  const deploymentLanguage = getDefaultLanguage()
  const deploymentRegion = isChinaDeployment() ? "cn" : "us"
  const [locale, setLocale] = useState<Language>(deploymentLanguage)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    setLocale(deploymentLanguage)
  }, [deploymentLanguage])

  return (
    <div className="space-y-6">
      {/* Language & Region */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {content.languageRegionTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">{content.displayLanguage}</Label>
            <Select value={locale} disabled>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">
                  <div className="flex items-center gap-2">
                    <span>🇺🇸</span>
                    {content.languageEnglishUs}
                  </div>
                </SelectItem>
                <SelectItem value="zh">
                  <div className="flex items-center gap-2">
                    <span>🇨🇳</span>
                    {content.languageChineseSimplified}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {content.displayLanguageDesc}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">{content.primaryRegion}</Label>
            <Select value={deploymentRegion} disabled>
              <SelectTrigger id="region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">
                  <div className="flex items-center gap-2">
                    <span>🇺🇸</span>
                    {content.regionUnitedStates}
                  </div>
                </SelectItem>
                <SelectItem value="cn">
                  <div className="flex items-center gap-2">
                    <span>🇨🇳</span>
                    {content.regionChina}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {content.primaryRegionDesc}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">{content.timeZone}</Label>
            <Select defaultValue="utc-8">
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utc-8">{content.timezonePacific}</SelectItem>
                <SelectItem value="utc-5">{content.timezoneEastern}</SelectItem>
                <SelectItem value="utc+8">{content.timezoneChina}</SelectItem>
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
            {content.notificationsTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{content.emailNotifications}</Label>
              <p className="text-sm text-muted-foreground">{content.emailNotificationsDesc}</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{content.wechatNotifications}</Label>
              <p className="text-sm text-muted-foreground">{content.wechatNotificationsDesc}</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{content.signatureReminders}</Label>
              <p className="text-sm text-muted-foreground">{content.signatureRemindersDesc}</p>
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
            {content.securityTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{content.twoFactorAuth}</Label>
              <p className="text-sm text-muted-foreground">{content.twoFactorAuthDesc}</p>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{content.blockchainVerification}</Label>
              <p className="text-sm text-muted-foreground">{content.blockchainVerificationDesc}</p>
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
            {content.appearanceTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{content.darkMode}</Label>
              <p className="text-sm text-muted-foreground">{content.darkModeDesc}</p>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" className="bg-transparent">
          {t.common.cancel}
        </Button>
        <Button>{content.saveChanges}</Button>
      </div>
    </div>
  )
}
