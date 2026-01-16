"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import type { Lang } from "@/types/lesson"
import type { UserSettings, Theme, PdfTemplate, WordTemplate } from "@/types/settings"
import { getTranslation } from "@/lib/translations"
import { loadSettings, saveSettings, resetSettings } from "@/lib/settingsStorage"
import { Header } from "@/components/layout/header"
import { SettingsSection } from "@/components/settings/settings-section"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { status } = useSession()
  const { toast } = useToast()
  const [lang, setLang] = useState<Lang>("en")
  const [settings, setSettings] = useState<UserSettings | null>(null)

  const t = getTranslation(lang)

  useEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
  }, [])

  if (status === "loading" || !settings) {
    return null
  }

  const handleSave = () => {
    saveSettings(settings)
    toast({
      title: t.settings.settingsSaved,
      duration: 2000,
    })
  }

  const handleReset = () => {
    const defaults = resetSettings()
    setSettings(defaults)
    toast({
      title: t.settings.settingsReset,
      duration: 2000,
    })
  }

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  return (
    <div className="min-h-screen bg-background">
      <Header lang={lang} onLangChange={setLang} title={t.settings.title} showBackButton />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* AI Settings */}
          <SettingsSection title={t.settings.aiSettings} description={t.settings.aiOutputLanguageDesc}>
            <div className="space-y-2">
              <Label>{t.settings.aiOutputLanguage}</Label>
              <Select
                value={settings.aiOutputLanguage}
                onValueChange={(value: Lang) => updateSetting("aiOutputLanguage", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SettingsSection>

          {/* Export Preferences */}
          <SettingsSection title={t.settings.exportPrefs} description={t.settings.exportPrefsDesc}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.settings.pdfTemplate}</Label>
                <Select
                  value={settings.exportPdfTemplate}
                  onValueChange={(value: PdfTemplate) => updateSetting("exportPdfTemplate", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">{t.settings.templateStandard}</SelectItem>
                    <SelectItem value="detailed">{t.settings.templateDetailed}</SelectItem>
                    <SelectItem value="minimal">{t.settings.templateMinimal}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t.settings.wordTemplate}</Label>
                <Select
                  value={settings.exportWordTemplate}
                  onValueChange={(value: WordTemplate) => updateSetting("exportWordTemplate", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">{t.settings.templateStandard}</SelectItem>
                    <SelectItem value="detailed">{t.settings.templateDetailed}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
          </SettingsSection>

          {/* Display Preferences */}
          <SettingsSection title={t.settings.displayPrefs} description={t.settings.displayPrefsDesc}>
            <div className="space-y-2">
              <Label>{t.settings.theme}</Label>
              <Select value={settings.theme} onValueChange={(value: Theme) => updateSetting("theme", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t.settings.themeLight}</SelectItem>
                  <SelectItem value="dark">{t.settings.themeDark}</SelectItem>
                  <SelectItem value="system">{t.settings.themeSystem}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SettingsSection>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button onClick={handleSave} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {t.settings.saveSettings}
            </Button>
            <Button onClick={handleReset} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              {t.settings.resetDefaults}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
