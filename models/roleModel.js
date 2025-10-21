import mongoose from "mongoose"


const roleSchema = new mongoose.Schema({

    name: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true
    },

    description: {
        type: String,
        required: true,
        trim: true
    },

    isActive: {
        type: Boolean,
        default: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }

}, {
    timestamps: true
})


// Index for better query performance
// Note: name index is automatically created due to unique: true
roleSchema.index({ isActive: 1 })


// Static method to create default roles
roleSchema.statics.createDefaultRoles = async function(adminUserId) {

    const defaultRoles = [
        {
            name: 'customer',
            description: 'Regular customer with basic shopping permissions',
            createdBy: adminUserId
        },
        {
            name: 'rider',
            description: 'Delivery personnel with order fulfillment permissions',
            createdBy: adminUserId
        },
        {
            name: 'staff',
            description: 'Internal staff with product and order management permissions',
            createdBy: adminUserId
        }
    ]

    for (const roleData of defaultRoles) {

        const existingRole = await this.findOne({ name: roleData.name })

        if (!existingRole) {

            await this.create(roleData)

        }

    }

}


const Role = mongoose.model("Role", roleSchema)


export default Role