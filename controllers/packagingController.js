import PackagingOption from "../models/packagingOptionModel.js"
import { errorHandler } from "../utils/error.js"


export const createPackaging = async (req, res, next) => {
    try {
        const { name, price, isActive = true, isDefault = false } = req.body || {}

        if (!name || typeof name !== 'string') {
            return next(errorHandler(400, 'Name is required'))
        }

        if (price == null || Number(price) < 0) {
            return next(errorHandler(400, 'Price must be a non-negative number'))
        }

        // If making default, unset others
        if (isDefault) {
            await PackagingOption.updateMany({ isDefault: true }, { $set: { isDefault: false } })
        }

        const option = await PackagingOption.create({ name: name.trim(), price: Number(price), isActive: Boolean(isActive), isDefault: Boolean(isDefault && isActive) })

        return res.status(201).json({ success: true, data: { packaging: option } })
    } catch (err) {
        if (err?.code === 11000) {
            return next(errorHandler(409, 'A packaging option with that name already exists'))
        }
        return next(err)
    }
}


export const getPackagingList = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            active,
            isDefault,
            minPrice,
            maxPrice,
            sort = 'createdAt:desc'
        } = req.query || {}

        const filters = {}
        if (search) filters.name = { $regex: search, $options: 'i' }
        if (active !== undefined) filters.isActive = String(active) === 'true'
        if (isDefault !== undefined) filters.isDefault = String(isDefault) === 'true'
        if (minPrice != null || maxPrice != null) {
            filters.price = {}
            if (minPrice != null) filters.price.$gte = Number(minPrice)
            if (maxPrice != null) filters.price.$lte = Number(maxPrice)
        }

        const [sortField, sortDirRaw] = String(sort).split(':')
        const sortDir = String(sortDirRaw).toLowerCase() === 'asc' ? 1 : -1

        const skip = (Number(page) - 1) * Number(limit)

        const [data, total] = await Promise.all([
            PackagingOption.find(filters).collation({ locale: 'en', strength: 2 }).sort({ [sortField || 'createdAt']: sortDir }).skip(skip).limit(Number(limit)),
            PackagingOption.countDocuments(filters)
        ])

        return res.json({
            success: true,
            data: {
                packaging: data,
                pagination: {
                    currentPage: Number(page),
                    pageSize: Number(limit),
                    totalItems: Number(total),
                    totalPages: Math.max(1, Math.ceil(Number(total) / Number(limit)))
                }
            }
        })
    } catch (err) {
        return next(err)
    }
}


export const getPackagingById = async (req, res, next) => {
    try {
        const { id } = req.params
        const option = await PackagingOption.findById(id)
        if (!option) return next(errorHandler(404, 'Packaging option not found'))
        return res.json({ success: true, data: { packaging: option } })
    } catch (err) {
        return next(err)
    }
}


export const updatePackaging = async (req, res, next) => {
    try {
        const { id } = req.params
        const { name, price, isActive, isDefault } = req.body || {}

        const update = {}
        if (name != null) update.name = String(name).trim()
        if (price != null) {
            if (Number(price) < 0) return next(errorHandler(400, 'Price must be a non-negative number'))
            update.price = Number(price)
        }
        if (isActive != null) update.isActive = Boolean(isActive)
        if (isDefault != null) update.isDefault = Boolean(isDefault)

        // Handle default flag transitions
        if (update.isDefault === true) {
            // Unset default on others first
            await PackagingOption.updateMany({ _id: { $ne: id }, isDefault: true }, { $set: { isDefault: false } })
            // Ensure active when default
            update.isActive = true
        }

        if (update.isActive === false) {
            // If deactivating, cannot remain default
            update.isDefault = false
        }

        const option = await PackagingOption.findByIdAndUpdate(id, update, { new: true, runValidators: true, context: 'query' })
        if (!option) return next(errorHandler(404, 'Packaging option not found'))
        return res.json({ success: true, data: { packaging: option } })
    } catch (err) {
        if (err?.code === 11000) {
            return next(errorHandler(409, 'A packaging option with that name already exists'))
        }
        return next(err)
    }
}


export const deletePackaging = async (req, res, next) => {
    try {
        const { id } = req.params
        const option = await PackagingOption.findByIdAndDelete(id)
        if (!option) return next(errorHandler(404, 'Packaging option not found'))

        // If deleted was default, try auto-promote the lowest-priced active option
        if (option.isDefault) {
            const replacement = await PackagingOption.findOne({ isActive: true }).sort({ price: 1, name: 1 })
            if (replacement) {
                replacement.isDefault = true
                await replacement.save()
            }
        }

        return res.json({ success: true })
    } catch (err) {
        return next(err)
    }
}


export const setDefaultPackaging = async (req, res, next) => {
    try {
        const { id } = req.params
        const option = await PackagingOption.findById(id)
        if (!option) return next(errorHandler(404, 'Packaging option not found'))
        if (!option.isActive) return next(errorHandler(400, 'Cannot set an inactive option as default'))

        await PackagingOption.updateMany({ _id: { $ne: id }, isDefault: true }, { $set: { isDefault: false } })
        option.isDefault = true
        await option.save()

        return res.json({ success: true, data: { packaging: option } })
    } catch (err) {
        return next(err)
    }
}


// Public endpoints
export const getActivePackaging = async (req, res, next) => {
    try {
        const options = await PackagingOption.find({ isActive: true }).sort({ isDefault: -1, price: 1, name: 1 })
        return res.json({ success: true, data: { packaging: options } })
    } catch (err) {
        return next(err)
    }
}


export const getDefaultPackaging = async (req, res, next) => {
    try {
        const option = await PackagingOption.findOne({ isActive: true, isDefault: true })
        if (!option) return res.status(404).json({ success: false, message: 'No default packaging configured' })
        return res.json({ success: true, data: { packaging: option } })
    } catch (err) {
        return next(err)
    }
}


