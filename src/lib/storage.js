import { supabase } from '../supabaseClient'

/**
 * Upload a photo and return its public URL. Accepts a gallery File (has a
 * name) or a captured camera Blob (doesn't), so both photo sources share
 * this one upload path.
 */
export async function uploadDesignPhoto(file) {
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase()
  const path = `design-refs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from('uploads').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw error

  const { data } = supabase.storage.from('uploads').getPublicUrl(path)
  return data.publicUrl
}
