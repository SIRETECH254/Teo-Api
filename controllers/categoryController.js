import Category from "../models/categoryModel.js"
import { errorHandler } from "../utils/error.js"
import { generateUniqueSlug } from "../utils/slugGenerator.js"

// @desc    Create new category
// @route   POST /api/categories
// @access  Private (Admin)
export const createCategory = async (req, res, next) => {
    try {
        const { name, description, status } = req.body

        if (!name) {
            return next(errorHandler(400, "Category name is required"))
        }

        // Generate unique slug
        const slug = await generateUniqueSlug(name, async (slug) => {
            const existingCategory = await Category.findOne({ slug })
            return !!existingCategory
        })

        const category = new Category({
            name,
            slug,
            description,
            status: status === 'inactive' ? 'inactive' : 'active',
            createdBy: req.user._id
        })

        await category.save()

        res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: {
                category: {
                    id: category._id,
                    name: category.name,
                    slug: category.slug,
                    description: category.description,
                    status: category.status,
                    isActive: category.isActive,
                    createdAt: category.createdAt
                }
            }
        })

    } catch (error) {
        console.error('Create category error:', error)
        next(errorHandler(500, "Server error while creating category"))
    }
}

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getAllCategories = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, isActive, status } = req.query

        const query = {}

        // Search by name
        if (search) {
            query.name = { $regex: search, $options: 'i' }
        }

        // Filter by active status
        if (isActive !== undefined) {
            query.isActive = isActive === 'true'
        }

        // Filter by status string
        if (status) {
            query.status = status
        }

        // Parent filtering removed

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { name: 1 }
        }

        const categories = await Category.find(query)
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit)

        const total = await Category.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                categories,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalCategories: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        })

    } catch (error) {
        console.error('Get all categories error:', error)
        next(errorHandler(500, "Server error while fetching categories"))
    }
}

// @desc    Get category by ID
// @route   GET /api/categories/:categoryId
// @access  Public
export const getCategoryById = async (req, res, next) => {
    try {
        const { categoryId } = req.params

        const category = await Category.findById(categoryId)
            .populate('createdBy', 'name email')

        if (!category) {
            return next(errorHandler(404, "Category not found"))
        }

        res.status(200).json({
            success: true,
            data: {
                category: {
                    id: category._id,
                    name: category.name,
                    slug: category.slug,
                    description: category.description ?? '',
                    status: category.status,
                    isActive: category.isActive,
                    createdAt: category.createdAt,
                    updatedAt: category.updatedAt,
                }
            }
        })

    } catch (error) {
        console.error('Get category by ID error:', error)
        next(errorHandler(500, "Server error while fetching category"))
    }
}

// @desc    Update category
// @route   PUT /api/categories/:categoryId
// @access  Private (Admin)
export const updateCategory = async (req, res, next) => {
    try {
        const { categoryId } = req.params
        const { name, description, isActive, status } = req.body

        const category = await Category.findById(categoryId)

        if (!category) {
            return next(errorHandler(404, "Category not found"))
        }

        // Generate new slug if name changed
        if (name && name !== category.name) {
            const slug = await generateUniqueSlug(name, async (slug) => {
                const existingCategory = await Category.findOne({ 
                    slug, 
                    _id: { $ne: categoryId } 
                })
                return !!existingCategory
            })
            category.slug = slug
        }

        // Update fields
        if (name) category.name = name
        if (description !== undefined) category.description = description
        if (isActive !== undefined) category.isActive = isActive
        if (status !== undefined) category.status = status

        await category.save()

        res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: {
                category: {
                    id: category._id,
                    name: category.name,
                    slug: category.slug,
                    description: category.description,
                    status: category.status,
                    isActive: category.isActive,
                    updatedAt: category.updatedAt
                }
            }
        })

    } catch (error) {
        console.error('Update category error:', error)
        next(errorHandler(500, "Server error while updating category"))
    }
}

// @desc    Delete category
// @route   DELETE /api/categories/:categoryId
// @access  Private (Admin)
export const deleteCategory = async (req, res, next) => {
    try {
        const { categoryId } = req.params

        const category = await Category.findById(categoryId)

        if (!category) {
            return next(errorHandler(404, "Category not found"))
        }

        // Child relationship removed; proceed to delete

        await Category.findByIdAndDelete(categoryId)

        res.status(200).json({
            success: true,
            message: "Category deleted successfully"
        })

    } catch (error) {
        console.error('Delete category error:', error)
        next(errorHandler(500, "Server error while deleting category"))
    }
}

// @desc    Get category tree
// @route   GET /api/categories/tree
// @access  Public
export const getCategoryTree = async (req, res, next) => {
    try {
        const categories = await Category.getCategoryTree()

        res.status(200).json({
            success: true,
            data: {
                categories
            }
        })

    } catch (error) {
        console.error('Get category tree error:', error)
        next(errorHandler(500, "Server error while fetching category tree"))
    }
}

// @desc    Get categories with product count
// @route   GET /api/categories/with-products
// @access  Public
export const getCategoriesWithProducts = async (req, res, next) => {
    try {
        const categories = await Category.getWithProductCount()

        res.status(200).json({
            success: true,
            data: {
                categories
            }
        })

    } catch (error) {
        console.error('Get categories with products error:', error)
        next(errorHandler(500, "Server error while fetching categories with products"))
    }
}

// @desc    Get root categories
// @route   GET /api/categories/root
// @access  Public
export const getRootCategories = async (req, res, next) => {
    try {
        const categories = await Category.getRootCategories()

        res.status(200).json({
            success: true,
            data: {
                categories
            }
        })

    } catch (error) {
        console.error('Get root categories error:', error)
        next(errorHandler(500, "Server error while fetching root categories"))
    }
} 