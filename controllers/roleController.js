import Role from "../models/roleModel.js"
import User from "../models/userModel.js"
import { errorHandler } from "../utils/error.js"


// @desc    Create a new role
// @route   POST /api/roles
// @access  Private/Admin
export const createRole = async (req, res, next) => {

    try {

        const { name, description } = req.body

        // Check if user is admin
        if (!req.user.isAdmin) {

            return next(errorHandler(403, "Access denied. Admin privileges required."))

        }

        // Check if role already exists
        const existingRole = await Role.findOne({ name: name.toLowerCase() })

        if (existingRole) {

            return next(errorHandler(400, "Role with this name already exists"))

        }

        // Create new role
        const role = await Role.create({
            name: name.toLowerCase(),
            description,
            createdBy: req.user._id
        })

        await role.populate('createdBy', 'name email')

        res.status(201).json({
            success: true,
            message: "Role created successfully",
            data: { role }
        })

    } catch (error) {

        console.error('Create role error:', error)

        next(errorHandler(500, "Server error while creating role"))

    }

}


// @desc    Get all roles
// @route   GET /api/roles
// @access  Private/Admin
export const getAllRoles = async (req, res, next) => {

    try {

        // Check if user is admin
        if (!req.user.isAdmin) {

            return next(errorHandler(403, "Access denied. Admin privileges required."))

        }

        const { page = 1, limit = 10, search, isActive } = req.query

        const query = {}

        if (search) {

            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ]

        }

        if (isActive !== undefined) {

            query.isActive = isActive === 'true'

        }

        const pageNum = parseInt(page)
        const limitNum = parseInt(limit)

        const total = await Role.countDocuments(query)

        const roles = await Role.find(query)
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)

        res.status(200).json({
            success: true,
            data: {
                roles,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.max(1, Math.ceil(total / (limitNum || 1))),
                    total,
                    hasNextPage: pageNum < Math.ceil(total / (limitNum || 1)),
                    hasPrevPage: pageNum > 1
                }
            }
        })

    } catch (error) {

        console.error('Get all roles error:', error)

        next(errorHandler(500, "Server error while fetching roles"))

    }

}


// @desc    Get role by ID
// @route   GET /api/roles/:id
// @access  Private/Admin
export const getRoleById = async (req, res, next) => {

    try {

        // Check if user is admin
        if (!req.user.isAdmin) {

            return next(errorHandler(403, "Access denied. Admin privileges required."))

        }

        const role = await Role.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email')

        if (!role) {

            return next(errorHandler(404, "Role not found"))

        }

        res.status(200).json({
            success: true,
            data: { role }
        })

    } catch (error) {

        console.error('Get role by ID error:', error)

        next(errorHandler(500, "Server error while fetching role"))

    }

}


// @desc    Update role
// @route   PUT /api/roles/:id
// @access  Private/Admin
export const updateRole = async (req, res, next) => {

    try {

        // Check if user is admin
        if (!req.user.isAdmin) {

            return next(errorHandler(403, "Access denied. Admin privileges required."))

        }

        const { name, description, isActive } = req.body

        const role = await Role.findById(req.params.id)

        if (!role) {

            return next(errorHandler(404, "Role not found"))

        }

        // Check if new name conflicts with existing role
        if (name && name.toLowerCase() !== role.name) {

            const existingRole = await Role.findOne({ 
                name: name.toLowerCase(),
                _id: { $ne: req.params.id }
            })

            if (existingRole) {

                return next(errorHandler(400, "Role with this name already exists"))

            }

        }

        // Update role fields
        if (name) role.name = name.toLowerCase()

        if (description) role.description = description

        if (isActive !== undefined) role.isActive = isActive

        role.updatedBy = req.user._id

        await role.save()

        await role.populate([
            { path: 'createdBy', select: 'name email' },
            { path: 'updatedBy', select: 'name email' }
        ])

        res.status(200).json({
            success: true,
            message: "Role updated successfully",
            data: { role }
        })

    } catch (error) {

        console.error('Update role error:', error)

        next(errorHandler(500, "Server error while updating role"))

    }

}


// @desc    Delete role
// @route   DELETE /api/roles/:id
// @access  Private/Admin
export const deleteRole = async (req, res, next) => {

    try {

        // Check if user is admin
        if (!req.user.isAdmin) {

            return next(errorHandler(403, "Access denied. Admin privileges required."))

        }

        const role = await Role.findById(req.params.id)

        if (!role) {

            return next(errorHandler(404, "Role not found"))

        }

        // Check if role is assigned to any users
        const usersWithRole = await User.countDocuments({ roles: req.params.id })

        if (usersWithRole > 0) {

            return next(errorHandler(400, `Cannot delete role. It is assigned to ${usersWithRole} user(s). Please reassign users before deleting.`))

        }

        await Role.findByIdAndDelete(req.params.id)

        res.status(200).json({
            success: true,
            message: "Role deleted successfully"
        })

    } catch (error) {

        console.error('Delete role error:', error)

        next(errorHandler(500, "Server error while deleting role"))

    }

}


// @desc    Assign role to user
// @route   POST /api/roles/:roleId/assign/:userId
// @access  Private/Admin
export const assignRoleToUser = async (req, res, next) => {

    try {

        // Check if user is admin
        if (!req.user.isAdmin) {

            return next(errorHandler(403, "Access denied. Admin privileges required."))

        }

        const { roleId, userId } = req.params

        // Verify role exists
        const role = await Role.findById(roleId)

        if (!role) {

            return next(errorHandler(404, "Role not found"))

        }

        // Verify user exists
        const user = await User.findById(userId)

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        // Check if user already has this role
        if (user.roles.includes(roleId)) {

            return next(errorHandler(400, "User already has this role"))

        }

        // Add role to user
        user.addRole(roleId)

        await user.save()

        await user.populate('roles', 'name description')

        res.status(200).json({
            success: true,
            message: "Role assigned successfully",
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

        console.error('Assign role error:', error)

        next(errorHandler(500, "Server error while assigning role"))

    }

}


// @desc    Remove role from user
// @route   DELETE /api/roles/:roleId/remove/:userId
// @access  Private/Admin
export const removeRoleFromUser = async (req, res, next) => {

    try {

        // Check if user is admin
        if (!req.user.isAdmin) {

            return next(errorHandler(403, "Access denied. Admin privileges required."))

        }

        const { roleId, userId } = req.params

        // Verify user exists
        const user = await User.findById(userId)

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        // Check if user has this role
        if (!user.roles.includes(roleId)) {

            return next(errorHandler(400, "User does not have this role"))

        }

        // Remove role from user
        user.removeRole(roleId)

        await user.save()

        await user.populate('roles', 'name description')

        res.status(200).json({
            success: true,
            message: "Role removed successfully",
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

        console.error('Remove role error:', error)

        next(errorHandler(500, "Server error while removing role"))

    }

}


// @desc    Get users by role
// @route   GET /api/roles/:id/users
// @access  Private/Admin
export const getUsersByRole = async (req, res, next) => {

    try {

        // Check if user is admin
        if (!req.user.isAdmin) {

            return next(errorHandler(403, "Access denied. Admin privileges required."))

        }

        const { page = 1, limit = 10 } = req.query

        const role = await Role.findById(req.params.id)

        if (!role) {

            return next(errorHandler(404, "Role not found"))

        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            select: 'name email phone isAdmin isActive createdAt',
            populate: {
                path: 'roles',
                select: 'name displayName'
            },
            sort: { createdAt: -1 }
        }

        const users = await User.paginate({ roles: req.params.id }, options)

        res.status(200).json({
            success: true,
            data: { 
                role: {
                    id: role._id,
                    name: role.name,
                    displayName: role.displayName
                },
                users 
            }
        })

    } catch (error) {

        console.error('Get users by role error:', error)

        next(errorHandler(500, "Server error while fetching users by role"))

    }

}