import mongoose from "mongoose"
import Role from "../models/roleModel.js"
import User from "../models/userModel.js"
import bcrypt from "bcryptjs"
import "dotenv/config"


// Script to set up default roles and admin user
const setupRolesAndAdmin = async () => {

    try {

        // Connect to database
        await mongoose.connect(process.env.MONGO_URI)

        console.log("Connected to database")

        // Create admin user if it doesn't exist
        let adminUser = await User.findOne({ email: "admin@teokicks.com" })

        if (!adminUser) {

            const hashedPassword = await bcrypt.hash("admin123", 10)

            adminUser = await User.create({
                name: "Admin User",
                email: "admin@teokicks.com",
                phone: "+254700000000",
                password: hashedPassword,
                isAdmin: true,
                isVerified: true,
                isActive: true
            })

            console.log("Admin user created successfully")

        } else {

            console.log("Admin user already exists")

        }

        // Create default roles
        await Role.createDefaultRoles(adminUser._id)

        console.log("Default roles created successfully")

        // Assign customer role to admin user if no roles assigned
        if (adminUser.roles.length === 0) {

            const customerRole = await Role.findOne({ name: 'customer' })

            if (customerRole) {

                adminUser.addRole(customerRole._id)

                await adminUser.save()

                console.log("Customer role assigned to admin user")

            }

        }

        console.log("Setup completed successfully!")

        console.log("\nAdmin credentials:")
        console.log("Email: admin@teokicks.com")
        console.log("Password: admin123")
        console.log("IsAdmin: true")

        process.exit(0)

    } catch (error) {

        console.error("Setup failed:", error)

        process.exit(1)

    }

}


// Run setup
setupRolesAndAdmin()