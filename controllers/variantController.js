import Variant from "../models/variantModel.js"

import { validateVariant, validateVariantOption } from "../utils/validation.js"





// Create a new variant
export const createVariant = async (req, res) => {

    try {

        const { error } = validateVariant(req.body)

        if (error) {

            return res.status(400).json({

                success: false,

                message: "Validation error",

                errors: error.details.map(detail => detail.message)

            })

        }

        const { name, options } = req.body

        // Check if variant with same name already exists
        const existingVariant = await Variant.findOne({ name })

        if (existingVariant) {

            return res.status(400).json({

                success: false,

                message: "Variant with this name already exists"

            })

        }

        const variant = new Variant({

            name,

            options: options || []

        })

        await variant.save()

        res.status(201).json({

            success: true,

            message: "Variant created successfully",

            data: variant

        })

    } catch (error) {

        console.error("Create variant error:", error)

        res.status(500).json({

            success: false,

            message: "Internal server error",

            error: error.message

        })

    }

}





// Get all variants
export const getAllVariants = async (req, res) => {

    try {

        const { page = 1, limit = 10, search, isActive } = req.query

        const query = {}

        if (search) {

            query.name = { $regex: search, $options: 'i' }

        }

        if (isActive !== undefined) {

            query.isActive = isActive === 'true'

        }

        const options = {

            page: parseInt(page),

            limit: parseInt(limit),

            sort: { sortOrder: 1, name: 1 }

        }

        const variants = await Variant.find(query)
            .skip((options.page - 1) * options.limit)
            .limit(options.limit)
            .sort(options.sort)

        const total = await Variant.countDocuments(query)

        res.json({

            success: true,

            data: variants,

            pagination: {

                page: options.page,

                limit: options.limit,

                total,

                pages: Math.ceil(total / options.limit)

            }

        })

    } catch (error) {

        console.error("Get variants error:", error)

        res.status(500).json({

            success: false,

            message: "Internal server error",

            error: error.message

        })

    }

}





// Get variant by ID
export const getVariantById = async (req, res) => {

    try {

        const { id } = req.params

        const variant = await Variant.findById(id)

        if (!variant) {

            return res.status(404).json({

                success: false,

                message: "Variant not found"

            })

        }

        res.json({

            success: true,

            data: variant

        })

    } catch (error) {

        console.error("Get variant by ID error:", error)

        res.status(500).json({

            success: false,

            message: "Internal server error",

            error: error.message

        })

    }

}





// Update variant
export const updateVariant = async (req, res) => {

    try {

        const { id } = req.params

        const { error } = validateVariant(req.body)

        if (error) {

            return res.status(400).json({

                success: false,

                message: "Validation error",

                errors: error.details.map(detail => detail.message)

            })

        }

        const { name, description, displayType, colorHex, measurement, isActive, sortOrder } = req.body

        // Check if name is being changed and if it conflicts
        if (name) {

            const existingVariant = await Variant.findOne({ name, _id: { $ne: id } })

            if (existingVariant) {

                return res.status(400).json({

                    success: false,

                    message: "Variant with this name already exists"

                })

            }

        }

        const variant = await Variant.findByIdAndUpdate(

            id,

            {

                name,

                description,

                displayType,

                colorHex,

                measurement,

                isActive,

                sortOrder

            },

            { new: true, runValidators: true }

        )

        if (!variant) {

            return res.status(404).json({

                success: false,

                message: "Variant not found"

            })

        }

        res.json({

            success: true,

            message: "Variant updated successfully",

            data: variant

        })

    } catch (error) {

        console.error("Update variant error:", error)

        res.status(500).json({

            success: false,

            message: "Internal server error",

            error: error.message

        })

    }

}





// Delete variant
export const deleteVariant = async (req, res) => {

    try {

        const { id } = req.params

        const variant = await Variant.findByIdAndDelete(id)

        if (!variant) {

            return res.status(404).json({

                success: false,

                message: "Variant not found"

            })

        }

        res.json({

            success: true,

            message: "Variant deleted successfully"

        })

    } catch (error) {

        console.error("Delete variant error:", error)

        res.status(500).json({

            success: false,

            message: "Internal server error",

            error: error.message

        })

    }

}





// Add option to variant
export const addOption = async (req, res) => {

    try {

        const { id } = req.params

        const { error } = validateVariantOption(req.body)

        if (error) {

            return res.status(400).json({

                success: false,

                message: "Validation error",

                errors: error.details.map(detail => detail.message)

            })

        }

        const { value, sortOrder } = req.body

        const variant = await Variant.findById(id)

        if (!variant) {

            return res.status(404).json({

                success: false,

                message: "Variant not found"

            })

        }

        await variant.addOption({ value, sortOrder })

        res.json({

            success: true,

            message: "Option added successfully",

            data: variant

        })

    } catch (error) {

        console.error("Add option error:", error)

        res.status(500).json({

            success: false,

            message: "Internal server error",

            error: error.message

        })

    }

}





// Update option in variant
export const updateOption = async (req, res) => {

    try {

        const { id, optionId } = req.params

        const { error } = validateVariantOption(req.body)

        if (error) {

            return res.status(400).json({

                success: false,

                message: "Validation error",

                errors: error.details.map(detail => detail.message)

            })

        }

        const { value, isActive, sortOrder } = req.body

        const variant = await Variant.findById(id)

        if (!variant) {

            return res.status(404).json({

                success: false,

                message: "Variant not found"

            })

        }

        await variant.updateOption(optionId, { value, isActive, sortOrder })

        res.json({

            success: true,

            message: "Option updated successfully",

            data: variant

        })

    } catch (error) {

        console.error("Update option error:", error)

        res.status(500).json({

            success: false,

            message: "Internal server error",

            error: error.message

        })

    }

}





// Remove option from variant
export const removeOption = async (req, res) => {

    try {

        const { id, optionId } = req.params

        const variant = await Variant.findById(id)

        if (!variant) {

            return res.status(404).json({

                success: false,

                message: "Variant not found"

            })

        }

        // Check if option exists before deletion
        const option = variant.options.id(optionId)
        if (!option) {
            return res.status(404).json({
                success: false,
                message: "Option not found"
            })
        }

        // Perform cascade deletion (removes related SKUs)
        await variant.removeOption(optionId)

        res.json({

            success: true,

            message: "Option and related SKUs removed successfully",

            data: variant

        })

    } catch (error) {

        console.error("Remove option error:", error)

        res.status(500).json({

            success: false,

            message: "Internal server error",

            error: error.message

        })

    }

}





// Get active variants
export const getActiveVariants = async (req, res) => {

    try {

        const variants = await Variant.getActive()

        res.json({

            success: true,

            data: variants

        })

    } catch (error) {

        console.error("Get active variants error:", error)

        res.status(500).json({

            success: false,

            message: "Internal server error",

            error: error.message

        })

    }

} 