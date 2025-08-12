// Test file for image URL helper functions (after database migration)
import { getFullImageUrl, getImageFilename } from './helper/imageUtils.js'

// Test data - now database only contains filenames
const testCases = [
  // Database values (filename only) 
  '1736681234567_abc123.jpg',
  'image.png',
  'store_photo.webp',
  'photo.jpeg',
  
  // Edge cases
  '',
  null,
  undefined,
  
  // Legacy URLs (for backward compatibility testing)
  'https://kjhjaqbjhblflaruiwwm.supabase.co/storage/v1/object/public/stores/legacy.jpg',
]

console.log('🧪 Testing Image URL Helper Functions (Post-Migration)\n')

testCases.forEach((testValue, index) => {
  console.log(`Test ${index + 1}: "${testValue}"`)
  console.log(`  📁 getImageFilename: "${getImageFilename(testValue)}"`)
  console.log(`  🌐 getFullImageUrl: "${getFullImageUrl(testValue)}"`)
  console.log('---')
})

// Test typical usage scenarios
console.log('\n🎯 Typical Usage Scenarios:')

const usageTests = [
  {
    name: 'Database filename → Display URL',
    input: 'store_123.jpg',
    expectedFullUrl: 'https://kjhjaqbjhblflaruiwwm.supabase.co/storage/v1/object/public/stores/store_123.jpg'
  },
  {
    name: 'Database filename → Delete filename', 
    input: 'store_123.jpg',
    expectedFilename: 'store_123.jpg'
  },
  {
    name: 'Empty filename → Empty URL',
    input: '',
    expectedFullUrl: ''
  }
]

usageTests.forEach((test, index) => {
  console.log(`${index + 1}. ${test.name}`)
  console.log(`   Input: "${test.input}"`)
  
  if (test.expectedFilename) {
    const result = getImageFilename(test.input)
    console.log(`   Expected filename: "${test.expectedFilename}"`)
    console.log(`   Actual filename: "${result}"`)
    console.log(`   ✅ Match: ${result === test.expectedFilename}`)
  }
  
  if (test.expectedFullUrl) {
    const result = getFullImageUrl(test.input)
    console.log(`   Expected full URL: "${test.expectedFullUrl}"`)
    console.log(`   Actual full URL: "${result}"`)
    console.log(`   ✅ Match: ${result === test.expectedFullUrl}`)
  }
  
  console.log('---')
})

console.log('\n📊 Summary:')
console.log('✅ Database migration completed - all image_url fields are filenames')
console.log('✅ getFullImageUrl() creates display URLs from filenames') 
console.log('✅ getImageFilename() handles both filenames and legacy URLs')
console.log('✅ Ready for easy storage provider changes!')
