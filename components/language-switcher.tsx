"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Globe } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Locale } from "@/lib/i18n"

interface LanguageSwitcherProps {
  currentLocale?: Locale
  onLocaleChange?: (locale: Locale) => void
}

export function LanguageSwitcher({ currentLocale = "en", onLocaleChange }: LanguageSwitcherProps) {
  const [locale, setLocale] = useState<Locale>(currentLocale)

  useEffect(() => {
    setLocale(currentLocale)
  }, [currentLocale])

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale)
    onLocaleChange?.(newLocale)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleLocaleChange("en")} className={locale === "en" ? "bg-accent" : ""}>
          <span className="mr-2">🇺🇸</span>
          English (US)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLocaleChange("zh")} className={locale === "zh" ? "bg-accent" : ""}>
          <span className="mr-2">🇨🇳</span>
          中文 (简体)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
