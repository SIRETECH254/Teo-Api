import Address from "../models/addressModel.js"
import User from "../models/userModel.js"
import { errorHandler } from "../utils/error.js"


// @desc    Get all user addresses
// @route   GET /api/addresses
// @access  Private
export const getUserAddresses = async (req, res, next) => {

    try {

        const addresses = await Address.find({ 
            userId: req.user._id
        }).sort({ isDefault: -1, createdAt: -1 })

        res.status(200).json({
            success: true,
            data: {
                addresses: addresses,
                count: addresses.length
            }
        })

    } catch (error) {

        console.error('Get user addresses error:', error)

        next(errorHandler(500, "Server error while fetching addresses"))

    }

}


// @desc    Get single address
// @route   GET /api/addresses/:addressId
// @access  Private
export const getAddressById = async (req, res, next) => {

    try {

        const { addressId } = req.params

        const address = await Address.findOne({
            _id: addressId,
            userId: req.user._id
        })

        if (!address) {

            return next(errorHandler(404, "Address not found"))

        }

        res.status(200).json({
            success: true,
            data: {
                address: address
            }
        })

    } catch (error) {

        console.error('Get address by ID error:', error)

        next(errorHandler(500, "Server error while fetching address"))

    }

}


// @desc    Create new address
// @route   POST /api/addresses
// @access  Private
export const createAddress = async (req, res, next) => {

    try {

        const { 
            name,
            coordinates,
            regions,
            address: formatted,
            details,
            isDefault
        } = req.body

        // Validation for new schema
        if (!name) {
            return next(errorHandler(400, "Address name is required"))
        }

        if (!coordinates || coordinates.lat === undefined || coordinates.lng === undefined) {
            return next(errorHandler(400, "Coordinates lat and lng are required"))
        }

        if (!regions || !regions.country) {
            return next(errorHandler(400, "Region country is required"))
        }

        if (!formatted) {
            return next(errorHandler(400, "Full formatted address is required"))
        }

        // Check if user exists
        const user = await User.findById(req.user._id)

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        // Create new address
        const newAddress = new Address({
            userId: req.user._id,
            name: name.trim(),
            coordinates: {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            },
            regions: {
                country: regions.country?.trim(),
                locality: regions.locality?.trim(),
                sublocality: regions.sublocality?.trim(),
                sublocality_level_1: regions.sublocality_level_1?.trim(),
                administrative_area_level_1: regions.administrative_area_level_1?.trim(),
                plus_code: regions.plus_code?.trim(),
                political: regions.political?.trim()
            },
            address: formatted.trim(),
            details: details ?? null,
            isDefault: isDefault || false
        })

        await newAddress.save()

        res.status(201).json({
            success: true,
            message: "Address created successfully",
            data: {
                address: newAddress
            }
        })

    } catch (error) {

        console.error('Create address error:', error)

        if (error.name === 'ValidationError') {

            const message = Object.values(error.errors).map(err => err.message).join(', ')

            return next(errorHandler(400, message))

        }

        next(errorHandler(500, "Server error while creating address"))

    }

}


// @desc    Update address
// @route   PUT /api/addresses/:addressId
// @access  Private
export const updateAddress = async (req, res, next) => {

    try {

        const { addressId } = req.params

        const { 
            name,
            coordinates,
            regions,
            address: formatted,
            details,
            isDefault
        } = req.body

        const address = await Address.findOne({
            _id: addressId,
            userId: req.user._id
        })

        if (!address) {

            return next(errorHandler(404, "Address not found"))

        }

        // Update fields if provided (new schema)
        if (name !== undefined) address.name = name?.trim() || address.name

        if (coordinates && coordinates.lat !== undefined && coordinates.lng !== undefined) {
            address.coordinates = {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            }
        }

        if (regions) {
            address.regions = {
                ...address.regions?.toObject?.() || address.regions || {},
                country: regions.country?.trim() ?? address.regions?.country,
                locality: regions.locality?.trim() ?? address.regions?.locality,
                sublocality: regions.sublocality?.trim() ?? address.regions?.sublocality,
                sublocality_level_1: regions.sublocality_level_1?.trim() ?? address.regions?.sublocality_level_1,
                administrative_area_level_1: regions.administrative_area_level_1?.trim() ?? address.regions?.administrative_area_level_1,
                plus_code: regions.plus_code?.trim() ?? address.regions?.plus_code,
                political: regions.political?.trim() ?? address.regions?.political
            }
        }

        if (formatted !== undefined) address.address = formatted?.trim() || address.address

        if (details !== undefined) address.details = details ?? address.details

        if (isDefault !== undefined) address.isDefault = isDefault

        await address.save()

        res.status(200).json({
            success: true,
            message: "Address updated successfully",
            data: {
                address: address
            }
        })

    } catch (error) {

        console.error('Update address error:', error)

        if (error.name === 'ValidationError') {

            const message = Object.values(error.errors).map(err => err.message).join(', ')

            return next(errorHandler(400, message))

        }

        next(errorHandler(500, "Server error while updating address"))

    }

}


// @desc    Delete address (soft delete)
// @route   DELETE /api/addresses/:addressId
// @access  Private
export const deleteAddress = async (req, res, next) => {

    try {

        const { addressId } = req.params

        const address = await Address.findOne({
            _id: addressId,
            userId: req.user._id
        })

        if (!address) {

            return next(errorHandler(404, "Address not found"))

        }

        // Hard delete
        await Address.deleteOne({ _id: address._id })

        res.status(200).json({
            success: true,
            message: "Address deleted successfully"
        })

    } catch (error) {

        console.error('Delete address error:', error)

        next(errorHandler(500, "Server error while deleting address"))

    }

}


// @desc    Set default address
// @route   PUT /api/addresses/:addressId/default
// @access  Private
export const setDefaultAddress = async (req, res, next) => {

    try {

        const { addressId } = req.params

        const address = await Address.findOne({
            _id: addressId,
            userId: req.user._id
        })

        if (!address) {

            return next(errorHandler(404, "Address not found"))

        }

        // Set as default (pre-save hook will handle unsetting others)
        address.isDefault = true

        await address.save()

        res.status(200).json({
            success: true,
            message: "Default address updated successfully",
            data: {
                address: address
            }
        })

    } catch (error) {

        console.error('Set default address error:', error)

        next(errorHandler(500, "Server error while setting default address"))

    }

}


// @desc    Get default address
// @route   GET /api/addresses/default
// @access  Private
export const getDefaultAddress = async (req, res, next) => {

    try {

        const defaultAddress = await Address.findOne({
            userId: req.user._id,
            isDefault: true
        })

        if (!defaultAddress) {

            return next(errorHandler(404, "No default address found"))

        }

        res.status(200).json({
            success: true,
            data: {
                address: defaultAddress
            }
        })

    } catch (error) {

        console.error('Get default address error:', error)

        next(errorHandler(500, "Server error while fetching default address"))

    }

}


// @desc    Get all addresses for all users (Admin only)
// @route   GET /api/addresses/admin/all
// @access  Private (Admin)
export const getAllAddresses = async (req, res, next) => {

    try {

        const { page = 1, limit = 10, userId, locality, country, administrativeArea } = req.query

        const query = {}

        if (userId) query.userId = userId

        if (locality) query["regions.locality"] = { $regex: locality, $options: 'i' }

        if (country) query["regions.country"] = { $regex: country, $options: 'i' }

        if (administrativeArea) query["regions.administrative_area_level_1"] = { $regex: administrativeArea, $options: 'i' }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { createdAt: -1 }
        }

        const addresses = await Address.find(query)
            .populate('userId', 'name email phone')
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit)

        const total = await Address.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                addresses: addresses,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalAddresses: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        })

    } catch (error) {

        console.error('Get all addresses error:', error)

        next(errorHandler(500, "Server error while fetching all addresses"))

    }

}