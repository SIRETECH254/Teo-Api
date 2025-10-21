import express from "express"
import { 
    createTag,
    getAllTags,
    getTagById,
    updateTag,
    deleteTag,
    getTagsByType,
    getPopularTags,
    getTagsWithProducts,
    findOrCreateTag
} from "../controllers/tagController.js"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"

const router = express.Router()

// Public routes
router.get('/', getAllTags)
router.get('/type/:type', getTagsByType)
router.get('/popular', getPopularTags)
router.get('/with-products', getTagsWithProducts)
router.get('/:tagId', getTagById)

// Protected routes (require authentication)
router.use(verifyBearerToken)

// Admin-only routes
router.post('/', requireAdmin, createTag)
router.post('/find-or-create', requireAdmin, findOrCreateTag)
router.put('/:tagId', requireAdmin, updateTag)
router.delete('/:tagId', requireAdmin, deleteTag)

export default router 