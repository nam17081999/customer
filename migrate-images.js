import { supabase } from './lib/supabaseClient.js'
import { getImageFilename, hasImageBaseUrl } from './helper/imageUtils.js'

/**
 * Migration script to convert existing full image URLs to filenames only
 * Run this once to update existing data in the database
 */
async function migrateImageUrls() {
  console.log('Starting image URL migration...')
  
  try {
    // Fetch all stores with image URLs
    const { data: stores, error } = await supabase
      .from('stores')
      .select('id, image_url')
      .not('image_url', 'is', null)
    
    if (error) {
      console.error('Error fetching stores:', error)
      return
    }
    
    console.log(`Found ${stores.length} stores with images`)
    
    let updatedCount = 0
    let skippedCount = 0
    
    for (const store of stores) {
      const { id, image_url } = store
      
      // Check if it already has base URL (needs migration)
      if (hasImageBaseUrl(image_url)) {
        const filename = getImageFilename(image_url)
        
        // Update the record to store only filename
        const { error: updateError } = await supabase
          .from('stores')
          .update({ image_url: filename })
          .eq('id', id)
        
        if (updateError) {
          console.error(`Error updating store ${id}:`, updateError)
        } else {
          console.log(`✓ Updated store ${id}: ${image_url} → ${filename}`)
          updatedCount++
        }
      } else {
        console.log(`- Skipped store ${id}: already migrated or invalid URL`)
        skippedCount++
      }
    }
    
    console.log(`\nMigration completed:`)
    console.log(`- Updated: ${updatedCount} records`)
    console.log(`- Skipped: ${skippedCount} records`)
    
  } catch (error) {
    console.error('Migration failed:', error)
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateImageUrls()
}

export { migrateImageUrls }
