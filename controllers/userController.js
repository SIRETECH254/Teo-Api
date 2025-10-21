import User from "../models/userModel.js"
import Role from "../models/roleModel.js"
import bcrypt from "bcryptjs"
import { errorHandler } from "../utils/error.js"


// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res, next) => {

    try {

        const user = await User.findById(req.user._id)
            .select('-password -otpCode -resetPasswordToken')
            .populate('roles', 'name description')

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    avatar: user.avatar,
                    isAdmin: user.isAdmin,
                    roles: user.roles,
                    isVerified: user.isVerified,
                    isActive: user.isActive,
                    notificationPreferences: user.notificationPreferences,
                    country: user.country,
                    timezone: user.timezone,
                    lastLoginAt: user.lastLoginAt,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                }
            }
        })

    } catch (error) {

        console.error('Get user profile error:', error)

        next(errorHandler(500, "Server error while fetching user profile"))

    }

}


// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res, next) => {

    try {

        const { name, phone, avatar, country, timezone } = req.body

        const user = await User.findById(req.user._id)

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        // Update allowed fields
        if (name) user.name = name

        if (phone) user.phone = phone

        if (avatar) user.avatar = avatar

        if (country) user.country = country

        if (timezone) user.timezone = timezone

        await user.save()

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    avatar: user.avatar,
                    country: user.country,
                    timezone: user.timezone
                }
            }
        })

    } catch (error) {

        console.error('Update user profile error:', error)

        next(errorHandler(500, "Server error while updating profile"))

    }

}


// @desc    Change user password
// @route   PUT /api/users/change-password
// @access  Private
export const changePassword = async (req, res, next) => {

    try {

        const { currentPassword, newPassword } = req.body

        if (!currentPassword || !newPassword) {

            return next(errorHandler(400, "Current password and new password are required"))

        }

        const user = await User.findById(req.user._id)

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        // Verify current password
        const isCurrentPasswordValid = bcrypt.compareSync(currentPassword, user.password)

        if (!isCurrentPasswordValid) {

            return next(errorHandler(400, "Current password is incorrect"))

        }

        // Hash new password
        const hashedNewPassword = bcrypt.hashSync(newPassword, 12)

        user.password = hashedNewPassword

        await user.save()

        res.status(200).json({
            success: true,
            message: "Password changed successfully"
        })

    } catch (error) {

        console.error('Change password error:', error)

        next(errorHandler(500, "Server error while changing password"))

    }

}



// @desc    Get notification preferences
// @route   GET /api/users/notifications
// @access  Private
export const getNotificationPreferences = async (req, res, next) => {

    try {

        const user = await User.findById(req.user._id).select('notificationPreferences')

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        res.status(200).json({
            success: true,
            data: {
                notificationPreferences: user.notificationPreferences
            }
        })

    } catch (error) {

        console.error('Get notification preferences error:', error)

        next(errorHandler(500, "Server error while fetching notification preferences"))

    }

}


// @desc    Update notification preferences
// @route   PUT /api/users/notifications
// @access  Private
export const updateNotificationPreferences = async (req, res, next) => {

    try {

        const { email, sms, inApp, orderUpdates, promotions, stockAlerts } = req.body

        const user = await User.findById(req.user._id)

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        // Update notification preferences
        if (email !== undefined) user.notificationPreferences.email = email

        if (sms !== undefined) user.notificationPreferences.sms = sms

        if (inApp !== undefined) user.notificationPreferences.inApp = inApp

        if (orderUpdates !== undefined) user.notificationPreferences.orderUpdates = orderUpdates

        if (promotions !== undefined) user.notificationPreferences.promotions = promotions

        if (stockAlerts !== undefined) user.notificationPreferences.stockAlerts = stockAlerts

        await user.save()

        res.status(200).json({
            success: true,
            message: "Notification preferences updated successfully",
            data: {
                notificationPreferences: user.notificationPreferences
            }
        })

    } catch (error) {

        console.error('Update notification preferences error:', error)

        next(errorHandler(500, "Server error while updating notification preferences"))

    }

}


// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private (Admin)
export const getAllUsers = async (req, res, next) => {

    try {

        const { page = 1, limit = 10, search, role, status } = req.query

        const query = {}

        // Search by name or email
        if (search) {

            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ]

        }

        // Filter by role
        if (role) {

            query.roles = { $in: [role] }

        }

        // Filter by status
        if (status === 'active') {

            query.isActive = true

        } else if (status === 'inactive') {

            query.isActive = false

        }

        if (status === 'verified') {

            query.isVerified = true

        } else if (status === 'unverified') {

            query.isVerified = false

        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            select: '-password -otpCode -resetPasswordToken',
            sort: { createdAt: -1 }
        }

        const users = await User.find(query)
            .select(options.select)
            .populate('roles', 'name description')
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit)

        const total = await User.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                users: users,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalUsers: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        })

    } catch (error) {

        console.error('Get all users error:', error)

        next(errorHandler(500, "Server error while fetching users"))

    }

}


// @desc    Get user by ID (Admin only)
// @route   GET /api/users/:userId
// @access  Private (Admin)
export const getUserById = async (req, res, next) => {

    try {

        const { userId } = req.params

        const user = await User.findById(userId).select('-password -otpCode -resetPasswordToken')

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        res.status(200).json({
            success: true,
            data: {
                user: user
            }
        })

    } catch (error) {

        console.error('Get user by ID error:', error)

        next(errorHandler(500, "Server error while fetching user"))

    }

}


// @desc    Update user status (Admin only)
// @route   PUT /api/users/:userId/status
// @access  Private (Admin)
export const updateUserStatus = async (req, res, next) => {

    try {

        const { userId } = req.params

        const { isActive, roles } = req.body

        const user = await User.findById(userId)

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        // Update status
        if (isActive !== undefined) user.isActive = isActive

        if (roles && Array.isArray(roles)) user.roles = roles

        await user.save()

        res.status(200).json({
            success: true,
            message: "User status updated successfully",
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    isActive: user.isActive,
                    roles: user.roles
                }
            }
        })

    } catch (error) {

        console.error('Update user status error:', error)

        next(errorHandler(500, "Server error while updating user status"))

    }

}


// @desc    Set user as admin
// @route   PUT /api/users/:userId/admin
// @access  Private (Admin)
export const setUserAdmin = async (req, res, next) => {

    try {

        const { userId } = req.params

        const { isAdmin } = req.body

        const user = await User.findById(userId)
            .populate('roles', 'name description')

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        user.isAdmin = isAdmin

        await user.save()

        res.status(200).json({
            success: true,
            message: `User ${isAdmin ? 'promoted to' : 'removed from'} admin successfully`,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    roles: user.roles
                }
            }
        })

    } catch (error) {

        console.error('Set user admin error:', error)

        next(errorHandler(500, "Server error while updating user admin status"))

    }

}


// @desc    Assign default customer role to new users
// @route   Helper function
// @access  Internal
export const assignDefaultRole = async (userId) => {

    try {

        const customerRole = await Role.findOne({ name: 'customer' })

        if (customerRole) {

            const user = await User.findById(userId)

            if (user && user.roles.length === 0) {

                user.addRole(customerRole._id)

                await user.save()

            }

        }

    } catch (error) {

        console.error('Assign default role error:', error)

    }

}


// @desc    Get user roles
// @route   GET /api/users/:userId/roles
// @access  Private (Admin)
export const getUserRoles = async (req, res, next) => {

    try {

        const { userId } = req.params

        const user = await User.findById(userId)
            .populate('roles', 'name description')

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    roles: user.roles
                }
            }
        })

    } catch (error) {

        console.error('Get user roles error:', error)

        next(errorHandler(500, "Server error while fetching user roles"))

    }

}


// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:userId
// @access  Private (Admin)
export const deleteUser = async (req, res, next) => {

    try {

        const { userId } = req.params

        // Prevent deleting self
        if (req.user && String(req.user._id) === String(userId)) {
            return next(errorHandler(400, "You cannot delete your own account"))
        }

        const user = await User.findById(userId)

        if (!user) {
            return next(errorHandler(404, "User not found"))
        }

        await User.findByIdAndDelete(userId)

        res.status(200).json({
            success: true,
            message: "User deleted successfully",
        })

    } catch (error) {

        console.error('Delete user error:', error)

        next(errorHandler(500, "Server error while deleting user"))

    }

}


// @desc    Admin onboard customer (password set to phone)
// @route   POST /api/users/admin-create
// @access  Private (Admin)
export const adminCreateCustomer = async (req, res, next) => {

    try {

        // Expect: { name, email, phone, roles?[] }
        const { name, email, phone, roles } = req.body

        if (!name || !email || !phone) {
            return next(errorHandler(400, "name, email and phone are required"))
        }

        // Check duplicates (email/phone)
        const existing = await User.findOne({ $or: [ { email }, { phone } ] })
        if (existing) {
            const field = existing.email === email ? 'email' : 'phone'
            return next(errorHandler(400, `A user with this ${field} already exists`))
        }

        // Derive password from phone and hash
        const passwordHash = bcrypt.hashSync(String(phone), 12)

        // Determine roles: provided or default 'customer'
        let roleIds = []
        if (Array.isArray(roles) && roles.length > 0) {
            roleIds = roles
        } else {
            const customerRole = await Role.findOne({ name: 'customer' })
            if (customerRole) {
                roleIds = [customerRole._id]
            }
        }

        // Create user
        const user = await User.create({
            name,
            email,
            phone,
            password: passwordHash,
            roles: roleIds,
            isActive: true,
            isVerified: false,
        })

        await user.populate('roles', 'name description')

        res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    roles: user.roles,
                    isActive: user.isActive,
                    isVerified: user.isVerified,
                    avatar: user.avatar,
                    createdAt: user.createdAt,
                }
            }
        })

    } catch (error) {

        console.error('Admin create customer error:', error)

        next(errorHandler(500, "Server error while creating customer"))

    }

}