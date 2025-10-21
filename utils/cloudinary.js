import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import multer from 'multer'

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

// Configure storage for different file types
const createStorage = (folder, allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp']) => {
    return new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: folder,
            allowed_formats: allowedFormats,
            transformation: [
                { width: 1000, height: 1000, crop: 'limit' },
                { quality: 'auto' },
                { fetch_format: 'auto' }
            ]
        }
    })
}

// Storage configurations for different purposes
export const productImageStorage = createStorage('teo-kicks/products')
export const brandLogoStorage = createStorage('teo-kicks/brands')
export const categoryImageStorage = createStorage('teo-kicks/categories')
export const userAvatarStorage = createStorage('teo-kicks/avatars')
export const generalFileStorage = createStorage('teo-kicks/files', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'])

// Multer upload configurations
export const uploadProductImage = multer({ 
    storage: productImageStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true)
        } else {
            cb(new Error('Only image files are allowed'), false)
        }
    }
})

export const uploadBrandLogo = multer({ 
    storage: brandLogoStorage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true)
        } else {
            cb(new Error('Only image files are allowed'), false)
        }
    }
})

export const uploadUserAvatar = multer({ 
    storage: userAvatarStorage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true)
        } else {
            cb(new Error('Only image files are allowed'), false)
        }
    }
})

export const uploadGeneralFile = multer({ 
    storage: generalFileStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
})

// Cloudinary utility functions
export const uploadToCloudinary = async (file, folder = 'teo-kicks/general') => {
    try {
        let uploadOptions = {
            folder: folder,
            resource_type: 'auto',
            transformation: [
                { width: 1000, height: 1000, crop: 'limit' },
                { quality: 'auto' },
                { fetch_format: 'auto' }
            ]
        }

        let result
        if (file.path) {
            // File path (traditional upload)
            result = await cloudinary.uploader.upload(file.path, uploadOptions)
        } else if (file.buffer) {
            // File buffer (memory upload)
            result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
                    if (error) reject(error)
                    else resolve(result)
                })
                uploadStream.end(file.buffer)
            })
        } else if (typeof file === 'string') {
            // File path as string
            result = await cloudinary.uploader.upload(file, uploadOptions)
        } else {
            throw new Error('Invalid file format. Expected file path, buffer, or string.')
        }
        
        return {
            url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            size: result.bytes
        }
    } catch (error) {
        throw new Error(`Upload failed: ${error.message}`)
    }
}

export const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId)
        return result
    } catch (error) {
        throw new Error(`Delete failed: ${error.message}`)
    }
}

export const updateCloudinaryImage = async (publicId, newImagePath, folder = 'teo-kicks/general') => {
    try {
        // Delete old image
        if (publicId) {
            await deleteFromCloudinary(publicId)
        }
        
        // Upload new image
        const result = await uploadToCloudinary(newImagePath, folder)
        return result
    } catch (error) {
        throw new Error(`Update failed: ${error.message}`)
    }
}

// Generate optimized image URLs
export const getOptimizedImageUrl = (publicId, options = {}) => {
    const defaultOptions = {
        width: 800,
        height: 800,
        crop: 'fill',
        quality: 'auto',
        format: 'auto'
    }
    
    const finalOptions = { ...defaultOptions, ...options }
    
    return cloudinary.url(publicId, {
        transformation: [
            { width: finalOptions.width, height: finalOptions.height, crop: finalOptions.crop },
            { quality: finalOptions.quality },
            { fetch_format: finalOptions.format }
        ]
    })
}

// Generate thumbnail URL
export const getThumbnailUrl = (publicId, width = 200, height = 200) => {
    return cloudinary.url(publicId, {
        transformation: [
            { width, height, crop: 'fill' },
            { quality: 'auto' }
        ]
    })
}

// Generate responsive image URLs
export const getResponsiveImageUrls = (publicId) => {
    return {
        thumbnail: getThumbnailUrl(publicId, 150, 150),
        small: getOptimizedImageUrl(publicId, { width: 300, height: 300 }),
        medium: getOptimizedImageUrl(publicId, { width: 600, height: 600 }),
        large: getOptimizedImageUrl(publicId, { width: 1000, height: 1000 }),
        original: cloudinary.url(publicId)
    }
}

export default cloudinary 