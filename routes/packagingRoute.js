import express from "express"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"
import {
    createPackaging,
    getPackagingList,
    getPackagingById,
    updatePackaging,
    deletePackaging,
    setDefaultPackaging,
    getActivePackaging,
    getDefaultPackaging
} from "../controllers/packagingController.js"


const router = express.Router()


// Public (checkout) endpoints
router.get('/public', getActivePackaging)
router.get('/public/default', getDefaultPackaging)


// Admin-list/read
router.get('/', getPackagingList)
router.get('/:id', getPackagingById)


// Protected mutations
router.use(verifyBearerToken)
router.post('/', requireAdmin, createPackaging)
router.patch('/:id', requireAdmin, updatePackaging)
router.delete('/:id', requireAdmin, deletePackaging)
router.patch('/:id/default', requireAdmin, setDefaultPackaging)


export default router


