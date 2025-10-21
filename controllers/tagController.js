import Tag from "../models/tagModel.js"
import { errorHandler } from "../utils/error.js"
import { generateUniqueSlug } from "../utils/slugGenerator.js"

// @desc    Create new tag
// @route   POST /api/tags
// @access  Private (Admin)
export const createTag = async (req, res, next) => {
    try {
        const { name, description, isActive = true } = req.body

        if (!name) {
            return next(errorHandler(400, 'Tag name is required'))
        }

        // Check if tag already exists
        const existingTag = await Tag.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
        if (existingTag) {
            return next(errorHandler(400, 'Tag with this name already exists'))
        }

        const slug = await generateUniqueSlug(name, (slug) => Tag.findOne({ slug }))

        const tag = new Tag({
            name,
            slug,
            description,
            isActive,
            createdBy: req.user._id
        })

        await tag.save()

        res.status(201).json({
            success: true,
            message: 'Tag created successfully',
            data: {
                id: tag._id,
                name: tag.name,
                slug: tag.slug,
                description: tag.description,
                isActive: tag.isActive,
                createdAt: tag.createdAt,
                updatedAt: tag.updatedAt
            }
        })
    } catch (error) {
        next(error)
    }
}

// @desc    Get all tags
// @route   GET /api/tags
// @access  Public
export const getAllTags = async (req, res, next) => {
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
            sort: { name: 1 }
        }

        const tags = await Tag.find(query)
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit)

        const total = await Tag.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                tags,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalTags: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        })

    } catch (error) {
        console.error('Get all tags error:', error)
        next(errorHandler(500, "Server error while fetching tags"))
    }
}

// @desc    Get tag by ID
// @route   GET /api/tags/:tagId
// @access  Public
export const getTagById = async (req, res, next) => {
    try {
        const { tagId } = req.params

        const tag = await Tag.findById(tagId)
            .populate('createdBy', 'name email')

        if (!tag) {
            return next(errorHandler(404, "Tag not found"))
        }

        res.status(200).json({
            success: true,
            data: {
                tag
            }
        })

    } catch (error) {
        console.error('Get tag by ID error:', error)
        next(errorHandler(500, "Server error while fetching tag"))
    }
}

// @desc    Update tag
// @route   PUT /api/tags/:tagId
// @access  Private (Admin)
export const updateTag = async (req, res, next) => {
    try {
        const { tagId } = req.params
        const { name, description, isActive } = req.body

        const tag = await Tag.findById(tagId)

        if (!tag) {
            return next(errorHandler(404, "Tag not found"))
        }

        // Generate new slug if name changed
        if (name && name !== tag.name) {
            const slug = await generateUniqueSlug(name, async (slug) => {
                const existingTag = await Tag.findOne({ 
                    slug, 
                    _id: { $ne: tagId } 
                })
                return !!existingTag
            })
            tag.slug = slug
        }

        // Update fields
        if (name) tag.name = name
        if (description !== undefined) tag.description = description

        if (isActive !== undefined) tag.isActive = isActive

        await tag.save()

        res.status(200).json({
            success: true,
            message: "Tag updated successfully",
            data: {
                tag: {
                    id: tag._id,
                    name: tag.name,
                    slug: tag.slug,
                    description: tag.description,



                    isActive: tag.isActive,
                    updatedAt: tag.updatedAt
                }
            }
        })

    } catch (error) {
        console.error('Update tag error:', error)
        next(errorHandler(500, "Server error while updating tag"))
    }
}

// @desc    Delete tag
// @route   DELETE /api/tags/:tagId
// @access  Private (Admin)
export const deleteTag = async (req, res, next) => {
    try {
        const { tagId } = req.params

        const tag = await Tag.findById(tagId)

        if (!tag) {
            return next(errorHandler(404, "Tag not found"))
        }

        await Tag.findByIdAndDelete(tagId)

        res.status(200).json({
            success: true,
            message: "Tag deleted successfully"
        })

    } catch (error) {
        console.error('Delete tag error:', error)
        next(errorHandler(500, "Server error while deleting tag"))
    }
}

// @desc    Get tags by type (DEPRECATED - type field removed)
// @route   GET /api/tags/type/:type
// @access  Public
export const getTagsByType = async (req, res, next) => {
    return next(errorHandler(400, "Tags by type is no longer supported - type field has been removed"))
}

// @desc    Get popular tags
// @route   GET /api/tags/popular
// @access  Public
export const getPopularTags = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query

        const tags = await Tag.getPopular(parseInt(limit))

        res.status(200).json({
            success: true,
            data: {
                tags
            }
        })

    } catch (error) {
        console.error('Get popular tags error:', error)
        next(errorHandler(500, "Server error while fetching popular tags"))
    }
}

// @desc    Get tags with product count
// @route   GET /api/tags/with-products
// @access  Public
export const getTagsWithProducts = async (req, res, next) => {
    try {
        const tags = await Tag.getWithProductCount()

        res.status(200).json({
            success: true,
            data: {
                tags
            }
        })

    } catch (error) {
        console.error('Get tags with products error:', error)
        next(errorHandler(500, "Server error while fetching tags with products"))
    }
}

// @desc    Find or create tag
// @route   POST /api/tags/find-or-create
// @access  Private (Admin)
export const findOrCreateTag = async (req, res, next) => {
    try {
        const { name, description } = req.body

        if (!name) {
            return next(errorHandler(400, "Tag name is required"))
        }

        const tagData = {
            name,
            description,
            createdBy: req.user._id
        }

        const tag = await Tag.findOrCreate(tagData)

        res.status(200).json({
            success: true,
            message: tag.isNew ? "Tag created successfully" : "Tag found",
            data: {
                tag: {
                    id: tag._id,
                    name: tag.name,
                    slug: tag.slug,
                    description: tag.description,
                    isActive: tag.isActive,
                    isNew: tag.isNew
                }
            }
        })

    } catch (error) {
        console.error('Find or create tag error:', error)
        next(errorHandler(500, "Server error while finding or creating tag"))
    }
} 