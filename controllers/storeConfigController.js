import StoreConfig from '../models/storeConfigModel.js'
import { errorHandler } from '../utils/error.js'

// @desc    Get store configuration
// @route   GET /api/store-config
// @access  Public (but admin can modify)
export const getStoreConfig = async (req, res, next) => {
  try {
    const config = await StoreConfig.findOne()

    res.status(200).json({
      success: true,
      data: {
        config: config || null
      }
    })
  } catch (error) {
    console.error('Get store config error:', error)
    next(errorHandler(500, 'Failed to fetch store configuration'))
  }
}

// @desc    Create store configuration
// @route   POST /api/store-config
// @access  Private (Admin only)
export const createStoreConfig = async (req, res, next) => {
  try {
    // Check if configuration already exists
    const existingConfig = await StoreConfig.findOne()

    if (existingConfig) {
      return next(errorHandler(400, 'Store configuration already exists. Use PUT to update instead.'))
    }

    // Create new configuration
    const config = new StoreConfig(req.body)
    await config.save()

    res.status(201).json({
      success: true,
      message: 'Store configuration created successfully',
      data: {
        config
      }
    })
  } catch (error) {
    console.error('Create store config error:', error)

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message)
      return next(errorHandler(400, `Validation Error: ${errors.join(', ')}`))
    }

    if (error.statusCode === 400) {
      return next(error)
    }

    next(errorHandler(500, 'Failed to create store configuration'))
  }
}

// @desc    Update store configuration
// @route   PUT /api/store-config
// @access  Private (Admin only)
export const updateStoreConfig = async (req, res, next) => {
  try {
    // Find existing configuration
    const config = await StoreConfig.findOne()

    if (!config) {
      return next(errorHandler(404, 'Store configuration not found. Use POST to create first.'))
    }

    // Update configuration
    Object.assign(config, req.body)
    await config.save()

    res.status(200).json({
      success: true,
      message: 'Store configuration updated successfully',
      data: {
        config
      }
    })
  } catch (error) {
    console.error('Update store config error:', error)

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message)
      return next(errorHandler(400, `Validation Error: ${errors.join(', ')}`))
    }

    next(errorHandler(500, 'Failed to update store configuration'))
  }
}

// @desc    Delete store configuration
// @route   DELETE /api/store-config
// @access  Private (Admin only)
export const deleteStoreConfig = async (req, res, next) => {
  try {
    // Find and delete configuration
    const config = await StoreConfig.findOne()

    if (!config) {
      return next(errorHandler(404, 'Store configuration not found'))
    }

    await config.deleteOne()

    res.status(200).json({
      success: true,
      message: 'Store configuration deleted successfully'
    })
  } catch (error) {
    console.error('Delete store config error:', error)
    next(errorHandler(500, 'Failed to delete store configuration'))
  }
}

// @desc    Initialize default store configuration (for development/setup)
// @route   POST /api/store-config/init
// @access  Private (Admin only)
export const initStoreConfig = async (req, res, next) => {
  try {
    // Check if configuration already exists
    const existingConfig = await StoreConfig.findOne()

    if (existingConfig) {
      return res.status(200).json({
        success: true,
        message: 'Store configuration already exists',
        data: {
          config: existingConfig
        }
      })
    }

    // Create default configuration
    const defaultConfig = {
      storeName: 'TEO KICKS Store',
      storeEmail: 'support@teokicks.com',
      storePhone: '+254700000000',
      storeAddress: {
        street: '123 Main Street',
        city: 'Nairobi',
        country: 'Kenya',
        postalCode: '00100'
      },
      businessHours: [
        { day: 'monday', open: '09:00', close: '18:00', isOpen: true },
        { day: 'tuesday', open: '09:00', close: '18:00', isOpen: true },
        { day: 'wednesday', open: '09:00', close: '18:00', isOpen: true },
        { day: 'thursday', open: '09:00', close: '18:00', isOpen: true },
        { day: 'friday', open: '09:00', close: '18:00', isOpen: true },
        { day: 'saturday', open: '10:00', close: '16:00', isOpen: true },
        { day: 'sunday', open: null, close: null, isOpen: false }
      ],
      paymentMethods: {
        mpesa: { enabled: true, shortcode: '123456' },
        card: { enabled: true, paystackKey: 'pk_test_xxx' },
        cash: { enabled: true, description: 'Pay on delivery' }
      },
      shippingSettings: {
        freeShippingThreshold: 5000,
        baseDeliveryFee: 200,
        feePerKm: 50
      },
      notificationSettings: {
        emailNotifications: true,
        smsNotifications: true,
        orderConfirmations: true,
        stockAlerts: true
      },
      isActive: true
    }

    const config = new StoreConfig(defaultConfig)
    await config.save()

    res.status(201).json({
      success: true,
      message: 'Default store configuration created successfully',
      data: {
        config
      }
    })
  } catch (error) {
    console.error('Init store config error:', error)
    next(errorHandler(500, 'Failed to initialize store configuration'))
  }
}

// @desc    Get store configuration status (exists or not)
// @route   GET /api/store-config/status
// @access  Public
export const getStoreConfigStatus = async (req, res, next) => {
  try {
    const config = await StoreConfig.findOne().select('_id storeName isActive')

    res.status(200).json({
      success: true,
      data: {
        exists: !!config,
        config: config || null
      }
    })
  } catch (error) {
    console.error('Get store config status error:', error)
    next(errorHandler(500, 'Failed to check store configuration status'))
  }
}