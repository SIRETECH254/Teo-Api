import Collection from "../models/collectionModel.js"
import { errorHandler } from "../utils/error.js"
import { generateUniqueSlug } from "../utils/slugGenerator.js"

// @desc    Create new collection
// @route   POST /api/collections
// @access  Private (Admin)
export const createCollection = async (req, res, next) => {
    try {
        const { name, description, isActive } = req.body

        if (!name) {
            return next(errorHandler(400, "Collection name is required"))
        }

        // Generate unique slug
        const slug = await generateUniqueSlug(name, async (slug) => {
            const existingCollection = await Collection.findOne({ slug })
            return !!existingCollection
        })

        const collection = new Collection({
            name,
            slug,
            description,
            isActive: isActive !== undefined ? isActive : true,
            createdBy: req.user._id
        })

        await collection.save()

        res.status(201).json({
            success: true,
            message: "Collection created successfully",
            data: {
                collection: {
                    id: collection._id,
                    name: collection.name,
                    slug: collection.slug,
                    description: collection.description,
                    isActive: collection.isActive,
                    createdAt: collection.createdAt
                }
            }
        })

    } catch (error) {
        console.error('Create collection error:', error)
        next(errorHandler(500, "Server error while creating collection"))
    }
}

// @desc    Get all collections
// @route   GET /api/collections
// @access  Public
export const getAllCollections = async (req, res, next) => {
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

        const collections = await Collection.find(query)
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit)

        const total = await Collection.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                collections,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalCollections: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        })

    } catch (error) {
        console.error('Get all collections error:', error)
        next(errorHandler(500, "Server error while fetching collections"))
    }
}

// @desc    Get collection by ID
// @route   GET /api/collections/:collectionId
// @access  Public
export const getCollectionById = async (req, res, next) => {
    try {
        const { collectionId } = req.params

        const collection = await Collection.findById(collectionId)
            .populate('products', 'title slug images price comparePrice status')
            .populate('createdBy', 'name email')

        if (!collection) {
            return next(errorHandler(404, "Collection not found"))
        }

        res.status(200).json({
            success: true,
            data: {
                collection
            }
        })

    } catch (error) {
        console.error('Get collection by ID error:', error)
        next(errorHandler(500, "Server error while fetching collection"))
    }
}

// @desc    Update collection
// @route   PUT /api/collections/:collectionId
// @access  Private (Admin)
export const updateCollection = async (req, res, next) => {
    try {
        const { collectionId } = req.params
        const { name, description, isActive } = req.body

        const collection = await Collection.findById(collectionId)

        if (!collection) {
            return next(errorHandler(404, "Collection not found"))
        }

        // Generate new slug if name changed
        if (name && name !== collection.name) {
            const slug = await generateUniqueSlug(name, async (slug) => {
                const existingCollection = await Collection.findOne({ 
                    slug, 
                    _id: { $ne: collectionId } 
                })
                return !!existingCollection
            })
            collection.slug = slug
        }

        // Update fields
        if (name) collection.name = name
        if (description !== undefined) collection.description = description
        if (isActive !== undefined) collection.isActive = isActive

        await collection.save()

        res.status(200).json({
            success: true,
            message: "Collection updated successfully",
            data: {
                collection: {
                    id: collection._id,
                    name: collection.name,
                    slug: collection.slug,
                    description: collection.description,
                    isActive: collection.isActive,
                    updatedAt: collection.updatedAt
                }
            }
        })

    } catch (error) {
        console.error('Update collection error:', error)
        next(errorHandler(500, "Server error while updating collection"))
    }
}

// @desc    Delete collection
// @route   DELETE /api/collections/:collectionId
// @access  Private (Admin)
export const deleteCollection = async (req, res, next) => {
    try {
        const { collectionId } = req.params

        const collection = await Collection.findById(collectionId)

        if (!collection) {
            return next(errorHandler(404, "Collection not found"))
        }

        await Collection.findByIdAndDelete(collectionId)

        res.status(200).json({
            success: true,
            message: "Collection deleted successfully"
        })

    } catch (error) {
        console.error('Delete collection error:', error)
        next(errorHandler(500, "Server error while deleting collection"))
    }
}

// @desc    Add product to collection (DEPRECATED - products field removed)
// @route   POST /api/collections/:collectionId/products
// @access  Private (Admin)
export const addProductToCollection = async (req, res, next) => {
    return next(errorHandler(400, "Adding products to collections is no longer supported - products field has been removed"))
}

// @desc    Remove product from collection (DEPRECATED - products field removed)
// @route   DELETE /api/collections/:collectionId/products/:productId
// @access  Private (Admin)
export const removeProductFromCollection = async (req, res, next) => {
    return next(errorHandler(400, "Removing products from collections is no longer supported - products field has been removed"))
}

// @desc    Get collections with product count
// @route   GET /api/collections/with-products
// @access  Public
export const getCollectionsWithProducts = async (req, res, next) => {
    try {
        const collections = await Collection.getWithProductCount()

        res.status(200).json({
            success: true,
            data: {
                collections
            }
        })

    } catch (error) {
        console.error('Get collections with products error:', error)
        next(errorHandler(500, "Server error while fetching collections with products"))
    }
}

// @desc    Get active collections
// @route   GET /api/collections/active
// @access  Public
export const getActiveCollections = async (req, res, next) => {
    try {
        const collections = await Collection.getActive()

        res.status(200).json({
            success: true,
            data: {
                collections
            }
        })

    } catch (error) {
        console.error('Get active collections error:', error)
        next(errorHandler(500, "Server error while fetching active collections"))
    }
} 