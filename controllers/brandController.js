import Brand from "../models/brandModel.js"
import { errorHandler } from "../utils/error.js"
import { generateUniqueSlug } from "../utils/slugGenerator.js"

// @desc    Create new brand
// @route   POST /api/brands
// @access  Private (Admin)
export const createBrand = async (req, res, next) => {
    try {
        const { name, description, isActive = true } = req.body

        if (!name) {
            return next(errorHandler(400, 'Brand name is required'))
        }

        // Check if brand already exists
        const existingBrand = await Brand.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
        if (existingBrand) {
            return next(errorHandler(400, 'Brand with this name already exists'))
        }

        const slug = await generateUniqueSlug(name, (slug) => Brand.findOne({ slug }))

        const brand = new Brand({
            name,
            slug,
            description,
            isActive,
            createdBy: req.user._id
        })

        await brand.save()

        res.status(201).json({
            success: true,
            message: 'Brand created successfully',
            data: {
                id: brand._id,
                name: brand.name,
                slug: brand.slug,
                description: brand.description,
                isActive: brand.isActive,
                createdAt: brand.createdAt,
                updatedAt: brand.updatedAt
            }
        })

    } catch (error) {
        console.error('Create brand error:', error)
        next(errorHandler(500, 'Server error while creating brand'))
    }
}

// @desc    Get all brands
// @route   GET /api/brands
// @access  Public
export const getAllBrands = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, isActive } = req.query

        const query = {}

        // Search by name
        if (search) {
            query.name = { $regex: search, $options: 'i' }
        }

        // Filter by active status
        if (isActive !== undefined) {
            query.isActive = isActive === 'true'
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { sortOrder: 1, name: 1 }
        }

        const brands = await Brand.find(query)
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit)

        const total = await Brand.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                brands,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalBrands: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        })

    } catch (error) {
        console.error('Get all brands error:', error)
        next(errorHandler(500, "Server error while fetching brands"))
    }
}

// @desc    Get brand by ID
// @route   GET /api/brands/:brandId
// @access  Public
export const getBrandById = async (req, res, next) => {
    try {
        const { brandId } = req.params

        const brand = await Brand.findById(brandId)
            .populate('createdBy', 'name email')

        if (!brand) {
            return next(errorHandler(404, "Brand not found"))
        }

        res.status(200).json({
            success: true,
            data: {
                brand
            }
        })

    } catch (error) {
        console.error('Get brand by ID error:', error)
        next(errorHandler(500, "Server error while fetching brand"))
    }
}

// @desc    Update brand
// @route   PUT /api/brands/:brandId
// @access  Private (Admin)
export const updateBrand = async (req, res, next) => {
    try {
        const { brandId } = req.params
        const { name, description, isActive } = req.body

        const brand = await Brand.findById(brandId)

        if (!brand) {
            return next(errorHandler(404, "Brand not found"))
        }

        // Generate new slug if name changed
        if (name && name !== brand.name) {
            const slug = await generateUniqueSlug(name, async (slug) => {
                const existingBrand = await Brand.findOne({ 
                    slug, 
                    _id: { $ne: brandId } 
                })
                return !!existingBrand
            })
            brand.slug = slug
        }

        // Update fields
        if (name) brand.name = name
        if (description !== undefined) brand.description = description
        if (logo !== undefined) brand.logo = logo
        if (website !== undefined) brand.website = website
        if (features !== undefined) brand.features = features
        if (sortOrder !== undefined) brand.sortOrder = sortOrder
        if (isActive !== undefined) brand.isActive = isActive

        await brand.save()

        res.status(200).json({
            success: true,
            message: "Brand updated successfully",
            data: {
                brand: {
                    id: brand._id,
                    name: brand.name,
                    slug: brand.slug,
                    description: brand.description,
                    logo: brand.logo,
                    website: brand.website,
                    features: brand.features,
                    sortOrder: brand.sortOrder,
                    isActive: brand.isActive,
                    updatedAt: brand.updatedAt
                }
            }
        })

    } catch (error) {
        console.error('Update brand error:', error)
        next(errorHandler(500, "Server error while updating brand"))
    }
}

// @desc    Delete brand
// @route   DELETE /api/brands/:brandId
// @access  Private (Admin)
export const deleteBrand = async (req, res, next) => {
    try {
        const { brandId } = req.params

        const brand = await Brand.findById(brandId)

        if (!brand) {
            return next(errorHandler(404, "Brand not found"))
        }

        await Brand.findByIdAndDelete(brandId)

        res.status(200).json({
            success: true,
            message: "Brand deleted successfully"
        })

    } catch (error) {
        console.error('Delete brand error:', error)
        next(errorHandler(500, "Server error while deleting brand"))
    }
}

// @desc    Get popular brands
// @route   GET /api/brands/popular
// @access  Public
export const getPopularBrands = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query

        const brands = await Brand.getPopular(parseInt(limit))

        res.status(200).json({
            success: true,
            data: {
                brands
            }
        })

    } catch (error) {
        console.error('Get popular brands error:', error)
        next(errorHandler(500, "Server error while fetching popular brands"))
    }
}

// @desc    Get brands with product count
// @route   GET /api/brands/with-products
// @access  Public
export const getBrandsWithProducts = async (req, res, next) => {
    try {
        const brands = await Brand.getWithProductCount()

        res.status(200).json({
            success: true,
            data: {
                brands
            }
        })

    } catch (error) {
        console.error('Get brands with products error:', error)
        next(errorHandler(500, "Server error while fetching brands with products"))
    }
}

// @desc    Get active brands
// @route   GET /api/brands/active
// @access  Public
export const getActiveBrands = async (req, res, next) => {
    try {
        const brands = await Brand.getActive()

        res.status(200).json({
            success: true,
            data: {
                brands
            }
        })

    } catch (error) {
        console.error('Get active brands error:', error)
        next(errorHandler(500, "Server error while fetching active brands"))
    }
} 