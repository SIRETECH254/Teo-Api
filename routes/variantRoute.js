import express from "express"

import { authenticateToken, authorizeRoles } from "../middlewares/auth.js"

import {

    createVariant,

    getAllVariants,

    getVariantById,

    updateVariant,

    deleteVariant,

    addOption,

    updateOption,

    removeOption,

    getActiveVariants

} from "../controllers/variantController.js"




const router = express.Router()



router.get("/active", getActiveVariants)

router.get("/:id", getVariantById)



// Protected routes (admin only)
router.use(authenticateToken)


router.use(authorizeRoles(["admin", "manager"]))


router.get("/", getAllVariants)

router.post("/", createVariant)

router.put("/:id", updateVariant)


router.post("/:id/options", addOption)


router.put("/:id/options/:optionId", updateOption)


router.delete("/:id/options/:optionId", removeOption)





export default router 