import mongoose from "mongoose"
import Role from "../models/roleModel.js"
import User from "../models/userModel.js"
import "dotenv/config"

const setupRoles = async () => {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGO_URI)
        console.log("Connected to database")

        // Find an admin user to use as creator (optional but good practice)
        let creatorId = null
        const adminUser = await User.findOne({ isAdmin: true })
        if (adminUser) {
            creatorId = adminUser._id
        } else {
            // If no admin user yet, we might need a placeholder or just use null if model allows
            // Role model says createdBy is required, so let's find ANY user or skip creation if none
            const anyUser = await User.findOne()
            if (anyUser) {
                creatorId = anyUser._id
            }
        }

        if (!creatorId) {
            console.warn("No user found in database. Roles will be created without a valid createdBy ID if allowed, or this might fail.")
            // If createdBy is mandatory, we might need to create roles after first user or use a dummy ID
            creatorId = new mongoose.Types.ObjectId() 
        }

        const rolesToSetup = [
            {
                name: 'admin',
                description: 'System Administrator with full access',
                isSystemRole: true,
                isActive: true
            },
            {
                name: 'customer',
                description: 'Default role for all registered customers',
                isSystemRole: true,
                isActive: true
            }
        ]

        for (const roleData of rolesToSetup) {
            const existingRole = await Role.findOne({ name: roleData.name })
            
            if (existingRole) {
                console.log(`Role '${roleData.name}' already exists. Updating to ensure it's a system role.`)
                existingRole.isSystemRole = true
                await existingRole.save()
            } else {
                console.log(`Creating system role: '${roleData.name}'`)
                await Role.create({
                    ...roleData,
                    createdBy: creatorId
                })
            }
        }

        console.log("Role setup completed successfully!")
        process.exit(0)
    } catch (error) {
        console.error("Role setup failed:", error)
        process.exit(1)
    }
}

setupRoles()
