import Order from "../models/orderModel.js"
import Product from "../models/productModel.js"
import Category from "../models/categoryModel.js"
import Brand from "../models/brandModel.js"
import User from "../models/userModel.js"
import Invoice from "../models/invoiceModel.js"
import Payment from "../models/paymentModel.js"


// Dashboard overview numbers
export const getOverviewStats = async (req, res, next) => {
  try {
    const [
      totalProducts,
      totalCategories,
      totalBrands,
      totalOrders,
      totalCustomers,
      totalPaidOrders,
      totalPendingPayments
    ] = await Promise.all([
      Product.countDocuments({}),
      Category.countDocuments({}),
      Brand.countDocuments({}),
      Order.countDocuments({}),
      User.countDocuments({}),
      Order.countDocuments({ paymentStatus: "PAID" }),
      Order.countDocuments({ paymentStatus: "PENDING" })
    ])

    // Revenue: sum of successful payments
    const revenueAgg = await Payment.aggregate([
      { $match: { status: "SUCCESS" } },
      { $group: { _id: null, amount: { $sum: "$amount" } } }
    ])

    const totalRevenue = revenueAgg[0]?.amount || 0

    // Recent orders (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentOrders = await Order.countDocuments({ createdAt: { $gte: sevenDaysAgo } })

    return res.json({
      success: true,
      data: {
        totalProducts,
        totalCategories,
        totalBrands,
        totalOrders,
        totalCustomers,
        totalRevenue,
        recentOrders,
        totalPaidOrders,
        totalPendingPayments
      }
    })
  } catch (err) {
    return next(err)
  }
}


// Time-series analytics for charts
export const getAnalytics = async (req, res, next) => {
  try {
    const {
      range = "30d" // 7d, 30d, 90d, 12m
    } = req.query || {}

    const now = new Date()
    let start
    let groupFormat
    if (range === "7d") {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      groupFormat = "%Y-%m-%d"
    } else if (range === "90d") {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      groupFormat = "%Y-%m-%d"
    } else if (range === "12m") {
      start = new Date(now)
      start.setMonth(start.getMonth() - 12)
      groupFormat = "%Y-%m"
    } else { // default 30d
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      groupFormat = "%Y-%m-%d"
    }

    // Orders placed per period
    const ordersSeries = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: now } } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])

    // Revenue per period (by successful payments)
    const revenueSeries = await Payment.aggregate([
      { $match: { createdAt: { $gte: start, $lte: now }, status: "SUCCESS" } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$createdAt" } }, amount: { $sum: "$amount" } } },
      { $sort: { _id: 1 } }
    ])

    // Paid orders per period (based on time they became PAID)
    const paidOrdersSeries = await Order.aggregate([
      { $match: { updatedAt: { $gte: start, $lte: now }, paymentStatus: "PAID" } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$updatedAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])

    // Pending payment orders per period (by creation time)
    const pendingOrdersSeries = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: now }, paymentStatus: "PENDING" } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])

    // Top products by quantity in period
    const topProductsAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: now } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", qty: { $sum: "$items.quantity" } } },
      { $sort: { qty: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, productId: "$product._id", title: "$product.title", qty: 1 } }
    ])

    // Conversion: orders count vs customers created in period
    const customersSeries = await User.aggregate([
      { $match: { createdAt: { $gte: start, $lte: now } } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])

    return res.json({
      success: true,
      data: {
        meta: { start, end: now, range },
        ordersSeries,
        revenueSeries,
        paidOrdersSeries,
        pendingOrdersSeries,
        customersSeries,
        topProducts: topProductsAgg
      }
    })
  } catch (err) {
    return next(err)
  }
}


