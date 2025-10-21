import express from "express"
import { 
    createBrand,
    getAllBrands,
    getBrandById,
    updateBrand,
    deleteBrand,
    getPopularBrands,
    getBrandsWithProducts,
    getActiveBrands
} from "../controllers/brandController.js"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"

const router = express.Router()

// Public routes
router.get('/', getAllBrands)
router.get('/popular', getPopularBrands)
router.get('/with-products', getBrandsWithProducts)
router.get('/active', getActiveBrands)
router.get('/:brandId', getBrandById)

// Protected routes (require authentication)
router.use(verifyBearerToken)

// Admin-only routes
router.post('/', requireAdmin, createBrand)
router.put('/:brandId', requireAdmin, updateBrand)
router.delete('/:brandId', requireAdmin, deleteBrand)

export default router 