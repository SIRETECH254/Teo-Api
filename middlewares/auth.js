import jwt from "jsonwebtoken"

import User from "../models/userModel.js"

import { errorHandler } from "../utils/error.js"





// Middleware to authenticate JWT token
export const authenticateToken = async (req, res, next) => {

    try {

        const authHeader = req.headers.authorization

        const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

        if (!token) {

            return next(errorHandler(401, "Access token required"))

        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // Get user with roles populated
        const user = await User.findById(decoded.userId)
            .populate('roles', 'name permissions')

        if (!user) {

            return next(errorHandler(401, "User not found"))

        }

        if (!user.isActive) {

            return next(errorHandler(401, "User account is deactivated"))

        }

        // Add user to request object
        req.user = user

        next()

    } catch (error) {

        if (error.name === 'JsonWebTokenError') {

            return next(errorHandler(401, "Invalid token"))

        } else if (error.name === 'TokenExpiredError') {

            return next(errorHandler(401, "Token expired"))

        }

        return next(errorHandler(500, "Authentication error"))

    }

}





// Middleware to authorize specific roles
export const authorizeRoles = (allowedRoles = []) => {

    return (req, res, next) => {

        try {

            if (!req.user) {

                return next(errorHandler(401, "Authentication required"))

            }

            // Check if user is admin (admin has access to everything)
            if (req.user.isAdmin) {

                return next()

            }

            // Check if user has any of the allowed roles
            const userRoles = req.user.roles || []

            const hasAllowedRole = userRoles.some(role => {

                const roleName = typeof role === 'string' ? role : role.name

                return allowedRoles.includes(roleName)

            })

            if (!hasAllowedRole) {

                return next(errorHandler(403, "Insufficient permissions"))

            }

            next()

        } catch (error) {

            return next(errorHandler(500, "Authorization error"))

        }

    }

}





// Middleware to check if user is admin
export const requireAdmin = (req, res, next) => {

    try {

        if (!req.user) {

            return next(errorHandler(401, "Authentication required"))

        }

        if (!req.user.isAdmin) {

            return next(errorHandler(403, "Admin access required"))

        }

        next()

    } catch (error) {

        return next(errorHandler(500, "Authorization error"))

    }

}





// Middleware to check if user owns the resource or is admin
export const requireOwnershipOrAdmin = (resourceUserIdField = 'userId') => {

    return (req, res, next) => {

        try {

            if (!req.user) {

                return next(errorHandler(401, "Authentication required"))

            }

            // Admin can access everything
            if (req.user.isAdmin) {

                return next()

            }

            // Check if user owns the resource
            const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField]

            if (!resourceUserId) {

                return next(errorHandler(400, "Resource user ID not found"))

            }

            if (req.user._id.toString() !== resourceUserId.toString()) {

                return next(errorHandler(403, "Access denied"))

            }

            next()

        } catch (error) {

            return next(errorHandler(500, "Authorization error"))

        }

    }

}





// Middleware to verify email
export const requireEmailVerification = (req, res, next) => {

    try {

        if (!req.user) {

            return next(errorHandler(401, "Authentication required"))

        }

        if (!req.user.isVerified) {

            return next(errorHandler(403, "Email verification required"))

        }

        next()

    } catch (error) {

        return next(errorHandler(500, "Verification error"))

    }

}





// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {

    try {

        const authHeader = req.headers.authorization

        const token = authHeader && authHeader.split(' ')[1]

        if (!token) {

            return next()

        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // Get user with roles populated
        const user = await User.findById(decoded.userId)
            .populate('roles', 'name permissions')

        if (user && user.isActive) {

            req.user = user

        }

        next()

    } catch (error) {

        // Don't fail on token errors, just continue without user
        next()

    }

} 