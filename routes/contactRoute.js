import express from "express"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"
import { optionalAuth } from "../middlewares/auth.js"
import {
    createContact,
    getAllContacts,
    getUserContacts,
    getContactById,
    replyToContact,
    deleteContact
} from "../controllers/contactController.js"

const router = express.Router()

// Public route to send a contact message
// Using optionalAuth to capture user info if logged in, but not required
router.post("/", optionalAuth, createContact)

// Protected routes (require authentication)
router.use(verifyBearerToken)

// User routes
router.get("/my-messages", getUserContacts)
router.get("/:id", getContactById)

// Admin-only routes
router.get("/", requireAdmin, getAllContacts)
router.post("/:id/reply", requireAdmin, replyToContact)
router.delete("/:id", requireAdmin, deleteContact)

export default router
