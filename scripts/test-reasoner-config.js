/**
 * Test script to verify REASONER_FOR_LESSON configuration
 */

// Load .env file
require('dotenv').config({ path: '.env' });

const { createLLMClient } = require('../lib/langchain/llm-factory.ts');

console.log('='.repeat(60));
console.log('REASONER_FOR_LESSON Configuration Test');
console.log('='.repeat(60));
console.log('');

// Check environment variable
console.log('Environment Check:');
console.log('  REASONER_FOR_LESSON:', process.env.REASONER_FOR_LESSON);
console.log('  DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '✓ Set' : '✗ Not set');
console.log('  DEEPSEEK_MODEL:', process.env.DEEPSEEK_MODEL);
console.log('');

// Test lessonGeneration preset
console.log('Testing lessonGeneration preset:');
try {
  const client = createLLMClient('lessonGeneration');
  console.log('  ✓ Client created successfully');
  console.log('  Model:', client.lc_model || 'deepseek-chat');

  if (client.lc_model && client.lc_model.includes('reasoner')) {
    console.log('  🎯 REASONER MODEL ENABLED!');
  } else {
    console.log('  ℹ️  Using standard chat model (REASONER_FOR_LESSON may be unset)');
  }
} catch (error) {
  console.error('  ✗ Error:', error.message);
}

console.log('');
console.log('Testing documentEditing preset (should always use chat):');
try {
  const client = createLLMClient('documentEditing');
  console.log('  ✓ Client created successfully');
  console.log('  Model:', client.lc_model || 'deepseek-chat');
} catch (error) {
  console.error('  ✗ Error:', error.message);
}

console.log('');
console.log('='.repeat(60));
console.log('Summary:');
console.log('='.repeat(60));

if (process.env.REASONER_FOR_LESSON === 'true') {
  console.log('✅ REASONER_FOR_LESSON is ENABLED');
  console.log('📝 Lesson generation will use deepseek-reasoner');
  console.log('⏱️  Expected latency: 20-30 seconds');
  console.log('💰 Expected cost: ~¥3.30 per generation');
} else {
  console.log('ℹ️  REASONER_FOR_LESSON is NOT ENABLED');
  console.log('📝 Lesson generation will use deepseek-chat');
  console.log('⏱️  Expected latency: 5-10 seconds');
  console.log('💰 Expected cost: ~¥0.42 per generation');
}

console.log('');
console.log('To disable reasoner: Set REASONER_FOR_LESSON="false" in .env');
console.log('='.repeat(60));
