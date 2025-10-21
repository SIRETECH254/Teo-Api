import express from "express"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"
import { uploadProductImage } from "../utils/cloudinary.js"
import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    generateSKUs,
    updateSKU,
    deleteSKU,
    uploadProductImages,
    deleteProductImage,
    setPrimaryImage,
    getOptimizedImages,
    attachVariant,
    detachVariant
} from "../controllers/productController.js"





const router = express.Router()

// Public routes
router.get("/", getAllProducts)
router.get("/:id", getProductById)
router.get("/:productId/optimized-images", getOptimizedImages)

// Protected routes (require authentication)
router.use(verifyBearerToken)

// Admin-only routes
router.post("/", requireAdmin, uploadProductImage.array('images', 10), createProduct)
router.put("/:productId", requireAdmin, uploadProductImage.array('images', 10), updateProduct)
router.delete("/:productId", requireAdmin, deleteProduct)

// Image management routes
router.post("/:productId/images", requireAdmin, uploadProductImage.array('images', 10), uploadProductImages)
router.delete("/:productId/images/:imageId", requireAdmin, deleteProductImage)
router.put("/:productId/images/:imageId/primary", requireAdmin, setPrimaryImage)

// SKU management routes
router.post("/:productId/generate-skus", requireAdmin, generateSKUs)
router.patch("/:productId/skus/:skuId", requireAdmin, updateSKU)
router.delete("/:productId/skus/:skuId", requireAdmin, deleteSKU)

// Variant management routes
router.post("/:productId/attach-variant", requireAdmin, attachVariant)
router.post("/:productId/detach-variant", requireAdmin, detachVariant)

export default router 