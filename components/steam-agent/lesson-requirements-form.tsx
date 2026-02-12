"use client"

import { useState, useEffect } from "react"
import type {
  Lang,
  LessonRequirements,
  GradeLevel,
  STEAMDomain,
  TeachingApproach,
  DifficultyLevel,
} from "@/types/lesson"
import { getTranslation } from "@/lib/translations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react"

interface LessonRequirementsFormProps {
  lang: Lang
  onGenerate: (requirements: LessonRequirements) => void
  isGenerating: boolean
  initialRequirements?: LessonRequirements | null
  hasExistingLesson?: boolean
  onSwitchToChat?: () => void
}

const domainColors: Record<STEAMDomain, string> = {
  S: "data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 border-blue-400",
  T: "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 border-green-400",
  E: "data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 border-orange-400",
  A: "data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500 border-pink-400",
  M: "data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500 border-purple-400",
}

export function LessonRequirementsForm({
  lang,
  onGenerate,
  isGenerating,
  initialRequirements,
  hasExistingLesson,
  onSwitchToChat,
}: LessonRequirementsFormProps) {
  const t = getTranslation(lang)

  const [gradeLevel, setGradeLevel] = useState<GradeLevel>("p4-6")
  const [numberOfSessions, setNumberOfSessions] = useState<number>(3)
  const [durationPerSession, setDurationPerSession] = useState<number>(45)
  const [classSize, setClassSize] = useState<string>("")
  const [steamDomains, setSteamDomains] = useState<STEAMDomain[]>(["S", "T", "E"])
  const [lessonTopic, setLessonTopic] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [schoolThemes, setSchoolThemes] = useState<string[]>([])
  const [teachingApproach, setTeachingApproach] = useState<TeachingApproach>("project")
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>("intermediate")

  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 3

  useEffect(() => {
    if (initialRequirements) {
      setGradeLevel(initialRequirements.gradeLevel as GradeLevel)
      setNumberOfSessions(initialRequirements.numberOfSessions)
      setDurationPerSession(initialRequirements.durationPerSession)
      setClassSize(initialRequirements.classSize?.toString() || "")
      setSteamDomains(initialRequirements.steamDomains)
      setLessonTopic(initialRequirements.lessonTopic)
      setNotes(initialRequirements.notes || "")
      setSchoolThemes(initialRequirements.schoolThemes)
      setTeachingApproach(initialRequirements.teachingApproach as TeachingApproach)
      setDifficultyLevel(initialRequirements.difficultyLevel)
    }
  }, [initialRequirements])

  const toggleDomain = (domain: STEAMDomain) => {
    setSteamDomains((prev) => (prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]))
  }

  const toggleTheme = (theme: string) => {
    setSchoolThemes((prev) => (prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]))
  }

  const handleGenerate = () => {
    const requirements: LessonRequirements = {
      gradeLevel,
      numberOfSessions,
      durationPerSession,
      classSize: classSize ? Number.parseInt(classSize) : undefined,
      steamDomains,
      lessonTopic,
      schoolThemes,
      teachingApproach,
      difficultyLevel,
      notes: notes || undefined,
    }
    onGenerate(requirements)
  }

  const handleReset = () => {
    setCurrentStep(1)
    setGradeLevel("p4-6")
    setNumberOfSessions(3)
    setDurationPerSession(45)
    setClassSize("")
    setSteamDomains(["S", "T", "E"])
    setLessonTopic("")
    setNotes("")
    setSchoolThemes([])
    setTeachingApproach("project")
    setDifficultyLevel("intermediate")
  }

  const handleFillExample = () => {
    setGradeLevel("p4-6")
    setNumberOfSessions(4)
    setDurationPerSession(60)
    setClassSize("24")
    setSteamDomains(["S", "T", "E", "M"])
    setLessonTopic("Solar-Powered Car Design")
    setNotes("Focus on hands-on activities and teamwork")
    setSchoolThemes(["Sustainability", "Innovation"])
    setTeachingApproach("project")
    setDifficultyLevel("intermediate")
  }

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const inputClassName = "border-purple-200 focus:border-purple-500 focus:ring-purple-500 rounded-lg"
  const selectTriggerClassName = "border-purple-200 focus:border-purple-500 focus:ring-purple-500 rounded-lg"

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Grade Level */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-purple-900">{t.gradeLevel}</Label>
              <Select value={gradeLevel} onValueChange={(value) => setGradeLevel(value as GradeLevel)}>
                <SelectTrigger className={selectTriggerClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p1-3">{t.gradeLevels["p1-3"]}</SelectItem>
                  <SelectItem value="p4-6">{t.gradeLevels["p4-6"]}</SelectItem>
                  <SelectItem value="s1-3">{t.gradeLevels["s1-3"]}</SelectItem>
                  <SelectItem value="s4-6">{t.gradeLevels["s4-6"]}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Number of Sessions */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-purple-900">{t.numberOfSessions}</Label>
              <Input
                type="number"
                min="1"
                value={numberOfSessions || ''}
                onChange={(e) => setNumberOfSessions(e.target.value ? Number.parseInt(e.target.value) : 0)}
                onBlur={(e) => !e.target.value && setNumberOfSessions(3)}
                className={inputClassName}
              />
            </div>

            {/* Duration per Session */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-purple-900">{t.durationPerSession}</Label>
              <Input
                type="number"
                min="15"
                step="15"
                value={durationPerSession || ''}
                onChange={(e) => setDurationPerSession(e.target.value ? Number.parseInt(e.target.value) : 0)}
                onBlur={(e) => !e.target.value && setDurationPerSession(45)}
                className={inputClassName}
              />
            </div>

            {/* Class Size */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-purple-900">{t.classSize}</Label>
              <Input
                type="number"
                min="1"
                value={classSize}
                onChange={(e) => setClassSize(e.target.value)}
                placeholder="20-30"
                className={inputClassName}
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            {/* STEAM Domains */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-purple-900">{t.steamDomains}</Label>
              <div className="flex flex-wrap gap-4">
                {(["S", "T", "E", "A", "M"] as STEAMDomain[]).map((domain) => (
                  <div key={domain} className="flex items-center space-x-2">
                    <Checkbox
                      id={`domain-${domain}`}
                      checked={steamDomains.includes(domain)}
                      onCheckedChange={() => toggleDomain(domain)}
                      className={`rounded ${domainColors[domain]}`}
                    />
                    <label htmlFor={`domain-${domain}`} className="text-sm cursor-pointer font-medium text-gray-700">
                      {t.domains[domain]}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Lesson Topic */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-purple-900">{t.lessonTopic}</Label>
              <Input
                value={lessonTopic}
                onChange={(e) => setLessonTopic(e.target.value)}
                placeholder={t.topicPlaceholder}
                className={inputClassName}
              />
            </div>

            {/* Notes for AI */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-purple-900">{t.notes}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.notesPlaceholder}
                className="min-h-[80px] resize-none border-purple-200 focus:border-purple-500 focus:ring-purple-500 rounded-lg"
              />
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            {/* School Themes */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-purple-900">{t.schoolThemes}</Label>
              <div className="space-y-2">
                {t.themesList.map((theme) => (
                  <div key={theme} className="flex items-center space-x-2">
                    <Checkbox
                      id={`theme-${theme}`}
                      checked={schoolThemes.includes(theme)}
                      onCheckedChange={() => toggleTheme(theme)}
                      className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500 border-purple-400 rounded"
                    />
                    <label htmlFor={`theme-${theme}`} className="text-sm cursor-pointer font-medium text-gray-700">
                      {theme}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Teaching Approach */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-purple-900">{t.teachingApproach}</Label>
              <Select
                value={teachingApproach}
                onValueChange={(value) => setTeachingApproach(value as TeachingApproach)}
              >
                <SelectTrigger className="bg-purple-100 text-purple-700 rounded-full px-4 border-purple-200 focus:ring-purple-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inquiry">{t.teachingApproaches.inquiry}</SelectItem>
                  <SelectItem value="project">{t.teachingApproaches.project}</SelectItem>
                  <SelectItem value="direct">{t.teachingApproaches.direct}</SelectItem>
                  <SelectItem value="collaborative">{t.teachingApproaches.collaborative}</SelectItem>
                  <SelectItem value="flipped">{t.teachingApproaches.flipped}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty Level */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-purple-900">{t.difficultyLevel}</Label>
              <Select value={difficultyLevel} onValueChange={(value) => setDifficultyLevel(value as DifficultyLevel)}>
                <SelectTrigger className="bg-purple-100 text-purple-700 rounded-full px-4 border-purple-200 focus:ring-purple-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">{t.difficultyLevels.beginner}</SelectItem>
                  <SelectItem value="intermediate">{t.difficultyLevels.intermediate}</SelectItem>
                  <SelectItem value="advanced">{t.difficultyLevels.advanced}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className="h-full flex flex-col rounded-2xl shadow-lg shadow-purple-100/50 border-purple-100 bg-white">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-purple-900">{t.formTitle}</CardTitle>
          <div className="text-sm font-medium text-purple-500">
            {t.step} {currentStep} {t.of} {totalSteps}
          </div>
        </div>
        <p className="text-sm text-purple-400 mt-1">
          {currentStep === 1 && t.stepTitles.basic}
          {currentStep === 2 && t.stepTitles.topic}
          {currentStep === 3 && t.stepTitles.settings}
        </p>
        {currentStep === 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleFillExample}
            className="mt-2 w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0 rounded-lg hover:from-pink-600 hover:to-purple-600 hover:text-white"
          >
            {t.fillExample}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div key={currentStep} className="space-y-6 pr-2 animate-in fade-in slide-in-from-right-4 duration-300">
            {renderStepContent()}
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-purple-100 flex-shrink-0 space-y-3">
          {hasExistingLesson && onSwitchToChat && (
            <Button
              variant="secondary"
              onClick={onSwitchToChat}
              className="w-full bg-purple-50 text-purple-700 hover:bg-purple-100"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {t.continueEditing || "Continue Editing"}
            </Button>
          )}
          {currentStep < totalSteps ? (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="flex-1 rounded-full border-pink-300 text-purple-700 bg-transparent hover:bg-purple-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t.previous}
              </Button>
              <Button
                onClick={handleNext}
                className="flex-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 border-0"
              >
                {t.next}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                onClick={handlePrevious}
                className="rounded-full border-pink-300 text-purple-700 bg-transparent hover:bg-purple-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t.previous}
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !lessonTopic}
                className="w-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 border-0 disabled:opacity-50"
              >
                {isGenerating ? t.generating : t.generateLesson}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
