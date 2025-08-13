/**
 * Simple migration script to convert image URLs to filenames
 * This script can be run in the browser console on any page of the app
 */

// Copy this function to browser console and run migrateImages()
async function migrateImages() {
  console.log('🔄 Starting image URL migration...')
  
  try {
    // Get current supabase client from the page
    const { supabase } = window
    if (!supabase) {
      console.error('❌ Supabase client not found. Please run this on the application page.')
      return
    }
    
    // Fetch all stores with image URLs
    const { data: stores, error } = await supabase
      .from('stores')
      .select('id, image_url')
      .not('image_url', 'is', null)
    
    if (error) {
      console.error('❌ Error fetching stores:', error)
      return
    }
    
    console.log(`📊 Found ${stores.length} stores with images`)
    
    const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || 'https://ik.imagekit.io/customer69/stores/';
    let updatedCount = 0
    let skippedCount = 0
    
    for (const store of stores) {
      const { id, image_url } = store
      
      // Check if it has the full URL (needs migration)
      if (image_url && image_url.includes(IMAGE_BASE_URL)) {
        // Extract filename from URL
        const marker = '/object/public/stores/'
        const idx = image_url.indexOf(marker)
        let filename = image_url
        
        if (idx !== -1) {
          filename = image_url.substring(idx + marker.length)
        } else {
          // Fallback: get last segment
          try {
            const url = new URL(image_url)
            const parts = url.pathname.split('/')
            filename = parts[parts.length - 1]
          } catch {
            console.warn(`⚠️  Could not parse URL for store ${id}: ${image_url}`)
            skippedCount++
            continue
          }
        }
        
        // Update the record to store only filename
        const { error: updateError } = await supabase
          .from('stores')
          .update({ image_url: filename })
          .eq('id', id)
        
        if (updateError) {
          console.error(`❌ Error updating store ${id}:`, updateError)
        } else {
          console.log(`✅ Updated store ${id}: ${image_url} → ${filename}`)
          updatedCount++
        }
      } else {
        console.log(`⏭️  Skipped store ${id}: already filename or invalid URL`)
        skippedCount++
      }
    }
    
    console.log(`\n🎉 Migration completed:`)
    console.log(`   ✅ Updated: ${updatedCount} records`)
    console.log(`   ⏭️  Skipped: ${skippedCount} records`)
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

console.log('📋 Image URL Migration Script Loaded')
console.log('🔧 Run migrateImages() to start migration')
console.log('⚠️  Make sure you have admin access and backup your data first!')
