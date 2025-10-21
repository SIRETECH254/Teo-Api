import express from "express"
import { 
    getUserAddresses, 
    getAddressById, 
    createAddress, 
    updateAddress, 
    deleteAddress,
    setDefaultAddress, 
    getDefaultAddress, 
    getAllAddresses 
} from "../controllers/addressController.js"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"


const router = express.Router()


// Protected routes - require authentication
router.use(verifyBearerToken)



router.get('/', getUserAddresses)

router.get('/default', getDefaultAddress)

router.get('/:addressId', getAddressById)

router.post('/', createAddress)

router.put('/:addressId', updateAddress)

router.put('/:addressId/default', setDefaultAddress)

router.delete('/:addressId', deleteAddress)


// Admin routes
router.get('/admin/all', requireAdmin, getAllAddresses)


export default router