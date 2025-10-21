import express from "express"
import { 
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
    getCategoryTree,
    getCategoriesWithProducts,
    getRootCategories
} from "../controllers/categoryController.js"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"

const router = express.Router()

// Public routes
router.get('/', getAllCategories)
router.get('/tree', getCategoryTree)
router.get('/with-products', getCategoriesWithProducts)
router.get('/root', getRootCategories)
router.get('/:categoryId', getCategoryById)

// Protected routes (require authentication)
router.use(verifyBearerToken)

// Admin-only routes
router.post('/', requireAdmin, createCategory)
router.put('/:categoryId', requireAdmin, updateCategory)
router.delete('/:categoryId', requireAdmin, deleteCategory)

export default router 