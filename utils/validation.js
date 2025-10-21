import Joi from "joi"





// Validation schema for variant creation/update
export const validateVariant = (data) => {

    const schema = Joi.object({

        name: Joi.string()
            .trim()
            .min(2)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Variant name is required',
                'string.min': 'Variant name must be at least 2 characters',
                'string.max': 'Variant name cannot exceed 50 characters'
            }),

        options: Joi.array()
            .items(Joi.object({
                value: Joi.string().trim().min(1).max(50).required()
            }))
            .min(1)
            .required()
            .messages({
                'array.base': 'Options must be an array',
                'array.min': 'At least one option is required',
                'any.required': 'Options are required'
            })

    })

    return schema.validate(data)

}





// Validation schema for variant option
export const validateVariantOption = (data) => {

    const schema = Joi.object({

        value: Joi.string()
            .trim()
            .min(1)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Option value is required',
                'string.min': 'Option value must be at least 1 character',
                'string.max': 'Option value cannot exceed 50 characters'
            }),

        sortOrder: Joi.number()
            .integer()
            .min(0)
            .optional(),

        isActive: Joi.boolean()
            .optional()

    })

    return schema.validate(data)

}





// Validation schema for product creation/update
export const validateProduct = (data) => {

    const schema = Joi.object({

        title: Joi.string()
            .trim()
            .min(2)
            .max(200)
            .required()
            .messages({
                'string.empty': 'Product title is required',
                'string.min': 'Product title must be at least 2 characters',
                'string.max': 'Product title cannot exceed 200 characters'
            }),

        slug: Joi.string()
            .trim()
            .lowercase()
            .pattern(/^[a-z0-9-]+$/)
            .optional()
            .messages({
                'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens'
            }),

        description: Joi.string()
            .trim()
            .max(2000)
            .optional()
            .messages({
                'string.max': 'Description cannot exceed 2000 characters'
            }),

        shortDescription: Joi.string()
            .trim()
            .max(200)
            .optional()
            .messages({
                'string.max': 'Short description cannot exceed 200 characters'
            }),

        brand: Joi.string()
            .trim()
            .max(100)
            .optional()
            .messages({
                'string.max': 'Brand name cannot exceed 100 characters'
            }),

        basePrice: Joi.number()
            .positive()
            .required()
            .messages({
                'number.base': 'Base price must be a number',
                'number.positive': 'Base price must be positive'
            }),

        comparePrice: Joi.number()
            .positive()
            .greater(Joi.ref('basePrice'))
            .optional()
            .messages({
                'number.base': 'Compare price must be a number',
                'number.positive': 'Compare price must be positive',
                'number.greater': 'Compare price must be greater than base price'
            }),

        variants: Joi.array()
            .items(Joi.string().hex().length(24))
            .optional()
            .messages({
                'array.base': 'Variants must be an array',
                'string.hex': 'Invalid variant ID format',
                'string.length': 'Invalid variant ID length'
            }),

        categories: Joi.array()
            .items(Joi.string().hex().length(24))
            .optional()
            .messages({
                'array.base': 'Categories must be an array',
                'string.hex': 'Invalid category ID format',
                'string.length': 'Invalid category ID length'
            }),

        collections: Joi.array()
            .items(Joi.string().hex().length(24))
            .optional()
            .messages({
                'array.base': 'Collections must be an array',
                'string.hex': 'Invalid collection ID format',
                'string.length': 'Invalid collection ID length'
            }),

        tags: Joi.array()
            .items(Joi.string().trim().min(1).max(50))
            .optional()
            .messages({
                'array.base': 'Tags must be an array',
                'string.empty': 'Tag cannot be empty',
                'string.min': 'Tag must be at least 1 character',
                'string.max': 'Tag cannot exceed 50 characters'
            }),

        status: Joi.string()
            .valid('active', 'draft', 'archived')
            .default('draft')
            .optional(),

        metaTitle: Joi.string()
            .trim()
            .max(60)
            .optional()
            .messages({
                'string.max': 'Meta title cannot exceed 60 characters'
            }),

        metaDescription: Joi.string()
            .trim()
            .max(160)
            .optional()
            .messages({
                'string.max': 'Meta description cannot exceed 160 characters'
            }),

        trackInventory: Joi.boolean()
            .optional(),

        allowBackorders: Joi.boolean()
            .optional(),

        weight: Joi.number()
            .positive()
            .optional()
            .messages({
                'number.base': 'Weight must be a number',
                'number.positive': 'Weight must be positive'
            }),

        dimensions: Joi.object({
            length: Joi.number().positive().optional(),
            width: Joi.number().positive().optional(),
            height: Joi.number().positive().optional()
        }).optional(),

        taxable: Joi.boolean()
            .optional(),

        taxClass: Joi.string()
            .trim()
            .max(50)
            .optional(),

        vendor: Joi.string()
            .trim()
            .max(100)
            .optional(),

        supplierCode: Joi.string()
            .trim()
            .max(50)
            .optional(),

        features: Joi.array()
            .items(Joi.string().trim().min(1).max(200))
            .optional(),

        specifications: Joi.array()
            .items(Joi.object({
                name: Joi.string().trim().min(1).max(100).required(),
                value: Joi.string().trim().min(1).max(500).required()
            }))
            .optional()

    })

    return schema.validate(data)

}





// Validation schema for SKU update
export const validateSKU = (data) => {

    const schema = Joi.object({

        price: Joi.number()
            .positive()
            .optional()
            .messages({
                'number.base': 'Price must be a number',
                'number.positive': 'Price must be positive'
            }),

        comparePrice: Joi.number()
            .positive()
            .greater(Joi.ref('price'))
            .optional()
            .messages({
                'number.base': 'Compare price must be a number',
                'number.positive': 'Compare price must be positive',
                'number.greater': 'Compare price must be greater than price'
            }),

        stock: Joi.number()
            .integer()
            .min(0)
            .optional()
            .messages({
                'number.base': 'Stock must be a number',
                'number.integer': 'Stock must be an integer',
                'number.min': 'Stock cannot be negative'
            }),

        skuCode: Joi.string()
            .trim()
            .min(1)
            .max(50)
            .optional()
            .messages({
                'string.empty': 'SKU code is required',
                'string.min': 'SKU code must be at least 1 character',
                'string.max': 'SKU code cannot exceed 50 characters'
            }),

        barcode: Joi.string()
            .trim()
            .max(50)
            .optional(),

        weight: Joi.number()
            .positive()
            .optional(),

        dimensions: Joi.object({
            length: Joi.number().positive().optional(),
            width: Joi.number().positive().optional(),
            height: Joi.number().positive().optional()
        }).optional(),

        isActive: Joi.boolean()
            .optional(),

        allowPreOrder: Joi.boolean()
            .optional(),

        preOrderStock: Joi.number()
            .integer()
            .min(0)
            .optional(),

        lowStockThreshold: Joi.number()
            .integer()
            .min(0)
            .optional()

    })

    return schema.validate(data)

}





// Validation schema for variant attachment/detachment
export const validateVariantAttachment = (data) => {

    const schema = Joi.object({

        variantId: Joi.string()
            .hex()
            .length(24)
            .required()
            .messages({
                'string.empty': 'Variant ID is required',
                'string.hex': 'Invalid variant ID format',
                'string.length': 'Invalid variant ID length'
            })

    })

    return schema.validate(data)

}



// Validation schema for category
export const validateCategory = (data) => {

    const schema = Joi.object({

        name: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .required()
            .messages({
                'string.empty': 'Category name is required',
                'string.min': 'Category name must be at least 2 characters',
                'string.max': 'Category name cannot exceed 100 characters'
            }),

        slug: Joi.string()
            .trim()
            .lowercase()
            .pattern(/^[a-z0-9-]+$/)
            .optional()
            .messages({
                'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens'
            }),

        description: Joi.string()
            .trim()
            .max(500)
            .optional()
            .messages({
                'string.max': 'Description cannot exceed 500 characters'
            }),

        status: Joi.string()
            .valid('active', 'inactive')
            .optional(),

        image: Joi.string()
            .uri()
            .optional()
            .messages({
                'string.uri': 'Image must be a valid URL'
            }),

        // parent removed

        isActive: Joi.boolean()
            .optional(),

        // sortOrder removed

        metaTitle: Joi.string()
            .trim()
            .max(60)
            .optional(),

        metaDescription: Joi.string()
            .trim()
            .max(160)
            .optional(),

        features: Joi.array()
            .items(Joi.string().trim().min(1).max(100))
            .optional()

    })

    return schema.validate(data)

}





// Validation schema for collection
export const validateCollection = (data) => {

    const schema = Joi.object({

        name: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .required()
            .messages({
                'string.empty': 'Collection name is required',
                'string.min': 'Collection name must be at least 2 characters',
                'string.max': 'Collection name cannot exceed 100 characters'
            }),

        slug: Joi.string()
            .trim()
            .lowercase()
            .pattern(/^[a-z0-9-]+$/)
            .optional()
            .messages({
                'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens'
            }),

        description: Joi.string()
            .trim()
            .max(500)
            .optional()
            .messages({
                'string.max': 'Description cannot exceed 500 characters'
            }),

        image: Joi.string()
            .uri()
            .optional()
            .messages({
                'string.uri': 'Image must be a valid URL'
            }),

        banner: Joi.string()
            .uri()
            .optional()
            .messages({
                'string.uri': 'Banner must be a valid URL'
            }),

        type: Joi.string()
            .valid('manual', 'automatic')
            .default('manual')
            .optional(),

        conditions: Joi.array()
            .items(Joi.object({
                field: Joi.string().valid('title', 'brand', 'category', 'tag', 'price', 'vendor').required(),
                operator: Joi.string().valid('equals', 'contains', 'starts_with', 'ends_with', 'greater_than', 'less_than').required(),
                value: Joi.string().required()
            }))
            .optional()
            .when('type', {
                is: 'automatic',
                then: Joi.required(),
                otherwise: Joi.forbidden()
            }),

        products: Joi.array()
            .items(Joi.string().hex().length(24))
            .optional()
            .when('type', {
                is: 'manual',
                then: Joi.optional(),
                otherwise: Joi.forbidden()
            }),

        isActive: Joi.boolean()
            .optional(),

        sortOrder: Joi.number()
            .integer()
            .min(0)
            .optional(),

        metaTitle: Joi.string()
            .trim()
            .max(60)
            .optional(),

        metaDescription: Joi.string()
            .trim()
            .max(160)
            .optional(),

        features: Joi.array()
            .items(Joi.string().trim().min(1).max(100))
            .optional(),

        publishedAt: Joi.date()
            .optional()

    })

    return schema.validate(data)

} 