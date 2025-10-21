import mongoose from 'mongoose'

const businessHoursSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  open: {
    type: String,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    required: function() { return this.isOpen }
  },
  close: {
    type: String,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    required: function() { return this.isOpen }
  },
  isOpen: {
    type: Boolean,
    default: true
  }
}, { _id: false })

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  postalCode: { type: String, required: true }
}, { _id: false })

const paymentMethodsSchema = new mongoose.Schema({
  mpesa: {
    enabled: { type: Boolean, default: false },
    shortcode: { type: String, required: function() { return this.enabled } }
  },
  card: {
    enabled: { type: Boolean, default: false },
    paystackKey: { type: String, required: function() { return this.enabled } }
  },
  cash: {
    enabled: { type: Boolean, default: false },
    description: { type: String, default: 'Pay on delivery' }
  }
}, { _id: false })

const shippingSettingsSchema = new mongoose.Schema({
  freeShippingThreshold: { type: Number, default: 0 },
  baseDeliveryFee: { type: Number, default: 0 },
  feePerKm: { type: Number, default: 0 }
}, { _id: false })

const notificationSettingsSchema = new mongoose.Schema({
  emailNotifications: { type: Boolean, default: true },
  smsNotifications: { type: Boolean, default: true },
  orderConfirmations: { type: Boolean, default: true },
  stockAlerts: { type: Boolean, default: true }
}, { _id: false })

const storeConfigSchema = new mongoose.Schema({
  // Basic Store Information
  storeName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  storeEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  storePhone: {
    type: String,
    required: true,
    trim: true
  },
  storeAddress: addressSchema,

  // Business Hours
  businessHours: [businessHoursSchema],

  // Payment Methods
  paymentMethods: paymentMethodsSchema,

  // Shipping Settings
  shippingSettings: shippingSettingsSchema,

  // Notification Settings
  notificationSettings: notificationSettingsSchema,

  // Store Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// Ensure only one store configuration can exist
storeConfigSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existingConfig = await this.constructor.findOne()
    if (existingConfig) {
      const error = new Error('Store configuration already exists. Only one configuration is allowed.')
      error.statusCode = 400
      return next(error)
    }
  }
  next()
})

// Update the updatedAt field on save
storeConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now()
  next()
})

const StoreConfig = mongoose.model('StoreConfig', storeConfigSchema)

export default StoreConfig