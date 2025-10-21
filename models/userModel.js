import mongoose from "mongoose"





const oauthProviderSchema = new mongoose.Schema({

    provider: { type: String, enum: ["google", "apple", "instagram"], required: true },

    providerUserId: { type: String, required: true },

    email: { type: String, required: true },

    linkedAt: { type: Date, default: Date.now }

})



const notificationPreferencesSchema = new mongoose.Schema({

    email: { type: Boolean, default: true },

    sms: { type: Boolean, default: true },

    inApp: { type: Boolean, default: true },

    orderUpdates: { type: Boolean, default: true },

    promotions: { type: Boolean, default: false },

    stockAlerts: { type: Boolean, default: false }

})



const userSchema = new mongoose.Schema({
    
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true },

    phone: { type: String, required: true },

    password: { type: String, required: true },

    avatar: { 
        type: String, 
        default: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png" 
    },

    // Authentication & Verification
    isVerified: { type: Boolean, default: false },

    otpCode: { type: String },

    otpExpiry: { type: Date },

    resetPasswordToken: { type: String },

    resetPasswordExpiry: { type: Date },

    // Admin flag - admins have access to all role permissions
    isAdmin: { 
        type: Boolean, 
        default: false 
    },

    // Role-based access control - references to Role model
    roles: [{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    }],

    // OAuth providers for social login
    oauthProviders: [oauthProviderSchema],


    // Notification preferences
    notificationPreferences: {
        type: notificationPreferencesSchema,
        default: () => ({})
    },

    // Location & timezone
    country: { type: String, default: "Kenya" },

    timezone: { type: String, default: "Africa/Nairobi" },

    // Account status
    isActive: { type: Boolean, default: true },

    lastLoginAt: { type: Date }

}, {
    timestamps: true
})





// Index for better query performance
// Note: email index is automatically created by unique: true
userSchema.index({ phone: 1 })

userSchema.index({ roles: 1 })

userSchema.index({ 'oauthProviders.provider': 1, 'oauthProviders.providerUserId': 1 })



// Method to check if user has specific role (by role name or ObjectId)
userSchema.methods.hasRole = function(roleName) {

    if (this.isAdmin) return true // Admins have access to all roles

    // If roles are populated
    if (this.roles.length > 0 && this.roles[0].name) {

        return this.roles.some(role => role.name === roleName)

    }

    // If roles are not populated, we need to populate them first
    return false

}



// Method to check if user has admin privileges
userSchema.methods.hasAdminAccess = function() {

    return this.isAdmin

}



// Method to add role to user
userSchema.methods.addRole = function(roleId) {

    if (!this.roles.includes(roleId)) {

        this.roles.push(roleId)

    }

}



// Method to remove role from user
userSchema.methods.removeRole = function(roleId) {

    this.roles = this.roles.filter(role => !role.equals(roleId))

}






// Method to add OAuth provider
userSchema.methods.addOAuthProvider = function(provider, providerUserId, email) {
    const existingProvider = this.oauthProviders.find(p => 
        p.provider === provider && p.providerUserId === providerUserId
    )
    
    if (!existingProvider) {
        this.oauthProviders.push({
            provider,
            providerUserId,
            email,
            linkedAt: new Date()
        })
    }
}



const User = mongoose.model("User", userSchema)



export default User