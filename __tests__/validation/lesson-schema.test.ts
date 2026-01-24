import { describe, it, expect } from "@jest/globals"
import {
  LessonRequirementsSchema,
  validateLessonRequirements,
  safeValidateLessonRequirements,
  type LessonRequirementsFromSchema,
} from "@/types/lesson.schema"

describe("Lesson Requirements Schema", () => {
  describe("LessonRequirementsSchema", () => {
    const validInput = {
      lessonTopic: "Introduction to Robotics",
      gradeLevel: "Grade 5",
      numberOfSessions: 5,
      durationPerSession: 45,
      classSize: 25,
      steamDomains: ["S", "T", "E"],
      teachingApproach: "Project-based learning",
      difficultyLevel: "intermediate" as const,
      schoolThemes: ["Innovation", "Technology"],
      notes: "Focus on hands-on activities",
    }

    it("should validate valid input", () => {
      const result = LessonRequirementsSchema.safeParse(validInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toMatchObject({
          lessonTopic: "Introduction to Robotics",
          numberOfSessions: 5,
          steamDomains: ["S", "T", "E"],
        })
      }
    })

    it("should trim lessonTopic", () => {
      const input = { ...validInput, lessonTopic: "  Introduction to Robotics  " }
      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.lessonTopic).toBe("Introduction to Robotics")
      }
    })

    it("should reject lessonTopic exceeding max length", () => {
      const input = {
        ...validInput,
        lessonTopic: "a".repeat(201),
      }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("200 characters or less")
      }
    })

    it("should reject numberOfSessions less than 1", () => {
      const input = { ...validInput, numberOfSessions: 0 }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it("should reject numberOfSessions greater than 20", () => {
      const input = { ...validInput, numberOfSessions: 21 }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it("should reject durationPerSession less than 5", () => {
      const input = { ...validInput, durationPerSession: 4 }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it("should reject durationPerSession greater than 300", () => {
      const input = { ...validInput, durationPerSession: 301 }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it("should reject classSize less than 1", () => {
      const input = { ...validInput, classSize: 0 }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it("should reject classSize greater than 100", () => {
      const input = { ...validInput, classSize: 101 }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it("should accept classSize as optional", () => {
      const input = { ...validInput }
      // @ts-expect-error - Testing optional field
      delete input.classSize

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it("should reject empty steamDomains array", () => {
      const input = { ...validInput, steamDomains: [] }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it("should reject invalid STEAM domain values", () => {
      const input = { ...validInput, steamDomains: ["S", "T", "X"] }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it("should accept all valid STEAM domains", () => {
      const input = { ...validInput, steamDomains: ["S", "T", "E", "A", "M"] }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it("should reject teachingApproach exceeding max length", () => {
      const input = {
        ...validInput,
        teachingApproach: "a".repeat(101),
      }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it("should reject invalid difficultyLevel", () => {
      const input = { ...validInput, difficultyLevel: "expert" }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it("should accept valid difficulty levels", () => {
      const levels = ["beginner", "intermediate", "advanced"] as const

      levels.forEach((level) => {
        const input = { ...validInput, difficultyLevel: level }
        const result = LessonRequirementsSchema.safeParse(input)

        expect(result.success).toBe(true)
      })
    })

    it("should reject schoolThemes array exceeding max length", () => {
      const input = {
        ...validInput,
        schoolThemes: Array(11).fill("Theme"),
      }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it("should default schoolThemes to empty array if not provided", () => {
      const input = { ...validInput }
      // @ts-expect-error - Testing default value
      delete input.schoolThemes

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.schoolThemes).toEqual([])
      }
    })

    it("should reject notes exceeding max length", () => {
      const input = {
        ...validInput,
        notes: "a".repeat(1001),
      }

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it("should accept notes as optional", () => {
      const input = { ...validInput }
      // @ts-expect-error - Testing optional field
      delete input.notes

      const result = LessonRequirementsSchema.safeParse(input)

      expect(result.success).toBe(true)
    })
  })

  describe("validateLessonRequirements", () => {
    it("should return validated data", () => {
      const input = {
        lessonTopic: "Test Topic",
        gradeLevel: "Grade 5",
        numberOfSessions: 3,
        durationPerSession: 45,
        steamDomains: ["S", "T"] as const,
        teachingApproach: "Hands-on",
        difficultyLevel: "beginner" as const,
      }

      const result = validateLessonRequirements(input)

      expect(result).toMatchObject({
        lessonTopic: "Test Topic",
        numberOfSessions: 3,
      })
    })

    it("should throw error on invalid input", () => {
      const input = {
        lessonTopic: "Test",
        numberOfSessions: -1, // Invalid
        durationPerSession: 45,
        steamDomains: ["S"] as const,
        teachingApproach: "Test",
        difficultyLevel: "beginner" as const,
        gradeLevel: "Grade 1",
      }

      expect(() => validateLessonRequirements(input)).toThrow()
    })
  })

  describe("safeValidateLessonRequirements", () => {
    it("should return success with data on valid input", () => {
      const input = {
        lessonTopic: "Test Topic",
        gradeLevel: "Grade 5",
        numberOfSessions: 3,
        durationPerSession: 45,
        steamDomains: ["S", "T"] as const,
        teachingApproach: "Hands-on",
        difficultyLevel: "beginner" as const,
      }

      const result = safeValidateLessonRequirements(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toMatchObject({
          lessonTopic: "Test Topic",
        })
      }
    })

    it("should return failure with error details on invalid input", () => {
      const input = {
        lessonTopic: "Test",
        numberOfSessions: -1, // Invalid
        durationPerSession: 45,
        steamDomains: ["S"] as const,
        teachingApproach: "Test",
        difficultyLevel: "beginner" as const,
        gradeLevel: "Grade 1",
      }

      const result = safeValidateLessonRequirements(input)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors).toBeDefined()
        expect(result.error.errors.length).toBeGreaterThan(0)
      }
    })
  })

  describe("Type inference", () => {
    it("should correctly infer TypeScript types", () => {
      const input: LessonRequirementsFromSchema = {
        lessonTopic: "Test",
        gradeLevel: "Grade 5",
        numberOfSessions: 5,
        durationPerSession: 45,
        steamDomains: ["S", "T", "E"],
        teachingApproach: "Test",
        difficultyLevel: "intermediate",
      }

      // Type check - this should compile without errors
      expect(typeof input.lessonTopic).toBe("string")
      expect(typeof input.numberOfSessions).toBe("number")
      expect(Array.isArray(input.steamDomains)).toBe(true)
    })
  })
})
