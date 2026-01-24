import { z } from "zod"

/**
 * Zod schema for validating LessonRequirements
 * Ensures type safety and input validation for lesson generation API
 */
export const LessonRequirementsSchema = z.object({
  lessonTopic: z.string().trim().max(200, "Lesson topic must be 200 characters or less"),
  gradeLevel: z.string().trim().max(50, "Grade level must be 50 characters or less"),
  numberOfSessions: z.number().int().min(1, "Number of sessions must be at least 1").max(20, "Number of sessions must not exceed 20"),
  durationPerSession: z.number().int().min(5, "Duration per session must be at least 5 minutes").max(300, "Duration per session must not exceed 300 minutes"),
  classSize: z.number().int().min(1, "Class size must be at least 1").max(100, "Class size must not exceed 100").optional(),
  steamDomains: z.array(z.enum(["S", "T", "E", "A", "M"])).min(1, "At least one STEAM domain must be selected"),
  teachingApproach: z.string().trim().max(100, "Teaching approach must be 100 characters or less"),
  difficultyLevel: z.enum(["beginner", "intermediate", "advanced"], {
    errorMap: () => ({ message: "Difficulty level must be one of: beginner, intermediate, advanced" })
  }),
  schoolThemes: z.array(z.string()).max(10, "Cannot have more than 10 school themes").optional().default([]),
  notes: z.string().max(1000, "Notes must be 1000 characters or less").optional(),
})

/**
 * Infer TypeScript type from Zod schema
 * Use this type instead of manually defining LessonRequirements
 */
export type LessonRequirementsFromSchema = z.infer<typeof LessonRequirementsSchema>

/**
 * Validate lesson requirements input
 * @param data - Raw input data to validate
 * @returns Validated lesson requirements or throws ZodError
 */
export function validateLessonRequirements(data: unknown): LessonRequirementsFromSchema {
  return LessonRequirementsSchema.parse(data)
}

/**
 * Safely validate lesson requirements input
 * @param data - Raw input data to validate
 * @returns Object with success status and data or error details
 */
export function safeValidateLessonRequirements(data: unknown) {
  return LessonRequirementsSchema.safeParse(data)
}
