import express from "express"
import { 
    createCollection,
    getAllCollections,
    getCollectionById,
    updateCollection,
    deleteCollection,
    addProductToCollection,
    removeProductFromCollection,
    getCollectionsWithProducts,
    getActiveCollections
} from "../controllers/collectionController.js"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"

const router = express.Router()

// Public routes
router.get('/', getAllCollections)
router.get('/with-products', getCollectionsWithProducts)
router.get('/active', getActiveCollections)
router.get('/:collectionId', getCollectionById)

// Protected routes (require authentication)
router.use(verifyBearerToken)

// Admin-only routes
router.post('/', requireAdmin, createCollection)
router.put('/:collectionId', requireAdmin, updateCollection)
router.delete('/:collectionId', requireAdmin, deleteCollection)
router.post('/:collectionId/products', requireAdmin, addProductToCollection)
router.delete('/:collectionId/products/:productId', requireAdmin, removeProductFromCollection)

export default router 