import mongoose from "mongoose"
import StoreConfig from "../models/storeConfigModel.js"
import "dotenv/config"


// Script to initialize default store configuration
const setupStoreConfig = async () => {

    try {

        // Connect to database
        await mongoose.connect(process.env.MONGO_URI)

        console.log("Connected to database")

        // Check if store configuration already exists
        const existingConfig = await StoreConfig.findOne()

        if (existingConfig) {

            console.log("Store configuration already exists")
            console.log("\nExisting configuration:")
            console.log(`Store Name: ${existingConfig.storeName}`)
            console.log(`Store Email: ${existingConfig.storeEmail}`)
            console.log(`Store Phone: ${existingConfig.storePhone}`)
            console.log(`Is Active: ${existingConfig.isActive}`)

            process.exit(0)

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

        const config = await StoreConfig.create(defaultConfig)

        console.log("Store configuration created successfully!")
        console.log("\nDefault configuration:")
        console.log(`Store Name: ${config.storeName}`)
        console.log(`Store Email: ${config.storeEmail}`)
        console.log(`Store Phone: ${config.storePhone}`)
        console.log(`Is Active: ${config.isActive}`)
        console.log("\nNote: Store configuration cannot be deleted. Use PUT /api/store-config to update it.")

        process.exit(0)

    } catch (error) {

        console.error("Setup failed:", error)

        if (error.statusCode === 400) {
            console.error("Error: Store configuration already exists. Only one configuration is allowed.")
        } else {
            console.error("Error details:", error.message)
        }

        process.exit(1)

    }

}


// Run setup
setupStoreConfig()
