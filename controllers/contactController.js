import Contact from "../models/contactModel.js"
import { errorHandler } from "../utils/error.js"
import { sendContactReplyEmail } from "../services/external/emailService.js"

// Create a new contact message
export const createContact = async (req, res, next) => {
    try {
        const { name, email, subject, message } = req.body

        if (!name || !email || !subject || !message) {
            return next(errorHandler(400, "All fields (name, email, subject, message) are required"))
        }

        const contact = new Contact({
            name,
            email,
            subject,
            message,
            // If user is logged in (middleware might have attached req.user), attach userId
            userId: req.user ? req.user._id : undefined
        })

        await contact.save()

        res.status(201).json({
            success: true,
            message: "Your message has been sent successfully. We will get back to you soon!",
            data: contact
        })
    } catch (error) {
        console.error("Create contact error:", error)
        next(errorHandler(500, "Server error while sending message"))
    }
}

// Get all contact messages (Admin only)
export const getAllContacts = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query

        const query = {}

        if (status) {
            query.status = status
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } }
            ]
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { createdAt: -1 },
            populate: [
                { path: 'userId', select: 'name email' },
                { path: 'replies.repliedBy', select: 'name email' }
            ]
        }

        const contacts = await Contact.paginate(query, options)

        res.status(200).json({
            success: true,
            message: "Contacts retrieved successfully",
            data: contacts.docs,
            pagination: {
                page: contacts.page,
                limit: contacts.limit,
                totalDocs: contacts.totalDocs,
                totalPages: contacts.totalPages,
                hasNextPage: contacts.hasNextPage,
                hasPrevPage: contacts.hasPrevPage
            }
        })
    } catch (error) {
        console.error("Get all contacts error:", error)
        next(errorHandler(500, "Server error while retrieving messages"))
    }
}

// Get contact messages for the logged-in user
export const getUserContacts = async (req, res, next) => {
    try {
        const userId = req.user._id
        const { page = 1, limit = 10 } = req.query

        const query = { userId }
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { createdAt: -1 },
            populate: [
                { path: 'replies.repliedBy', select: 'name' }
            ]
        }

        const contacts = await Contact.paginate(query, options)

        res.status(200).json({
            success: true,
            message: "Your messages retrieved successfully",
            data: contacts.docs,
            pagination: {
                page: contacts.page,
                limit: contacts.limit,
                totalDocs: contacts.totalDocs,
                totalPages: contacts.totalPages
            }
        })
    } catch (error) {
        console.error("Get user contacts error:", error)
        next(errorHandler(500, "Server error while retrieving your messages"))
    }
}

// Get contact message by ID (Admin or Owner)
export const getContactById = async (req, res, next) => {
    try {
        const { id } = req.params
        const contact = await Contact.findById(id)
            .populate('userId', 'name email')
            .populate('replies.repliedBy', 'name email')

        if (!contact) {
            return next(errorHandler(404, "Message not found"))
        }

        // Check authorization: Admin or Owner
        const isAdmin = req.user.isAdmin
        const isOwner = contact.userId && contact.userId._id.toString() === req.user._id.toString()

        if (!isAdmin && !isOwner) {
            return next(errorHandler(403, "Access denied"))
        }

        // If Admin is reading a 'New' message, update status to 'Read'
        if (isAdmin && contact.status === 'New') {
            contact.status = 'Read'
            await contact.save()
        }

        res.status(200).json({
            success: true,
            data: contact
        })
    } catch (error) {
        console.error("Get contact by ID error:", error)
        next(errorHandler(500, "Server error while retrieving message"))
    }
}

// Reply to a contact message (Admin only)
export const replyToContact = async (req, res, next) => {
    try {
        const { id } = req.params
        const { replyMessage } = req.body

        if (!replyMessage) {
            return next(errorHandler(400, "Reply message is required"))
        }

        const contact = await Contact.findById(id)

        if (!contact) {
            return next(errorHandler(404, "Message not found"))
        }

        // Add reply to the replies array
        contact.replies.push({
            message: replyMessage,
            repliedBy: req.user._id
        })

        // Update status to 'Replied'
        contact.status = 'Replied'
        await contact.save()

        // Send reply email
        try {
            await sendContactReplyEmail(contact.email, contact.name, contact.message, replyMessage)
        } catch (emailError) {
            console.error("Failed to send reply email:", emailError)
            // We don't fail the request if email fails, but maybe inform the user
        }

        res.status(200).json({
            success: true,
            message: "Reply sent successfully",
            data: contact
        })
    } catch (error) {
        console.error("Reply to contact error:", error)
        next(errorHandler(500, "Server error while replying to message"))
    }
}

// Delete a contact message (Admin only)
export const deleteContact = async (req, res, next) => {
    try {
        const { id } = req.params
        const contact = await Contact.findByIdAndDelete(id)

        if (!contact) {
            return next(errorHandler(404, "Message not found"))
        }

        res.status(200).json({
            success: true,
            message: "Message deleted successfully"
        })
    } catch (error) {
        console.error("Delete contact error:", error)
        next(errorHandler(500, "Server error while deleting message"))
    }
}
