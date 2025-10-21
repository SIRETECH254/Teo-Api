/**
 * Generate a URL-friendly slug from a string
 * @param {string} text - The text to convert to slug
 * @returns {string} - The generated slug
 */
export const generateSlug = (text) => {
    if (!text || typeof text !== 'string') {
        return 'untitled-product'
    }
    
    let slug = text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    
    // If the slug is empty after processing, return a default
    if (!slug) {
        return 'untitled-product'
    }
    
    return slug
}

/**
 * Generate a unique slug by appending a number if the slug already exists
 * @param {string} text - The text to convert to slug
 * @param {Function} checkExists - Function to check if slug exists (should return boolean)
 * @returns {Promise<string>} - The unique slug
 */
export const generateUniqueSlug = async (text, checkExists) => {
    let slug = generateSlug(text)
    
    // Ensure we have a valid slug
    if (!slug || slug === 'untitled-product') {
        slug = 'untitled-product'
    }
    
    let counter = 1
    let uniqueSlug = slug
    
    while (await checkExists(uniqueSlug)) {
        uniqueSlug = `${slug}-${counter}`
        counter++
        
        // Prevent infinite loop
        if (counter > 1000) {
            uniqueSlug = `${slug}-${Date.now()}`
            break
        }
    }
    
    // Final safety check
    if (!uniqueSlug) {
        uniqueSlug = `product-${Date.now()}`
    }
    
    return uniqueSlug
} 