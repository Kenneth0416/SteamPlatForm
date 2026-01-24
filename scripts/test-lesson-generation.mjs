/**
 * End-to-end test for lesson generation with deepseek-reasoner
 */

// Import using ESM syntax
import { generateLesson } from '../lib/langchain/index.ts'

const testRequirements = {
  lessonTopic: "Introduction to Photosynthesis",
  gradeLevel: "Grade 5-6",
  numberOfSessions: 3,
  durationPerSession: 45,
  classSize: 25,
  steamDomains: ["Science", "Technology"],
  teachingApproach: "Hands-on learning",
  difficultyLevel: "Beginner",
  schoolThemes: ["Nature", "Plants"],
  notes: "Keep it simple and engaging",
}

console.log('='.repeat(70))
console.log('Lesson Generation E2E Test with DeepSeek-Reasoner')
console.log('='.repeat(70))
console.log('')
console.log('Test Requirements:')
console.log('  Topic:', testRequirements.lessonTopic)
console.log('  Grade:', testRequirements.gradeLevel)
console.log('  Sessions:', testRequirements.numberOfSessions)
console.log('  Duration:', testRequirements.durationPerSession, 'min')
console.log('')
console.log('Starting generation...')
console.log('⏱️  This may take 20-30 seconds (reasoner model)...')
console.log('')

const startTime = Date.now()

generateLesson(testRequirements, "en")
  .then((result) => {
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(1)

    console.log('')
    console.log('✅ Generation completed!')
    console.log('⏱️  Duration:', duration, 'seconds')
    console.log('📏 Output length:', result.length, 'characters')
    console.log('')
    console.log('Generated Lesson (Preview):')
    console.log('─'.repeat(70))
    console.log(result.slice(0, 500) + '...')
    console.log('─'.repeat(70))
    console.log('')

    // Basic quality checks
    const hasTitle = /^#.+/.test(result)
    const hasObjectives = /## Learning Objectives/.test(result)
    const hasActivities = /## Activities/.test(result)
    const hasAssessment = /## Assessment/.test(result)

    console.log('Quality Checks:')
    console.log('  ✓ Has Title:', hasTitle)
    console.log('  ✓ Has Objectives:', hasObjectives)
    console.log('  ✓ Has Activities:', hasActivities)
    console.log('  ✓ Has Assessment:', hasAssessment)
    console.log('')

    if (hasTitle && hasObjectives && hasActivities && hasAssessment) {
      console.log('🎉 All quality checks passed!')
      console.log('')
      console.log('Summary:')
      console.log('  ✅ Reasoner model is working correctly')
      console.log('  ✅ Generated structured lesson plan')
      console.log('  ⏱️  Latency:', duration, 's', duration > 60 ? '(slower than expected)' : '(acceptable)')
    } else {
      console.log('⚠️  Some quality checks failed')
      console.log('  This may indicate an issue with the prompt or model')
    }
  })
  .catch((error) => {
    console.error('')
    console.error('❌ Generation failed:', error.message)
    console.error('')
    console.error('Possible causes:')
    console.error('  1. API key invalid or expired')
    console.error('  2. Network connection issue')
    console.error('  3. Model not available')
    console.error('')
    console.error('Check DEEPSEEK_API_KEY in .env')
  })
