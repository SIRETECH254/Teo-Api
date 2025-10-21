import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'


const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TEO KICKS API',
      version: '1.0.0',
      description: 'A comprehensive e-commerce API for TEO KICKS shoe store in Kenya',
      contact: {
        name: 'TEO KICKS Support',
        email: 'support@teokicks.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.teokicks.com' 
          : `http://localhost:${process.env.PORT || 3000}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Bearer token in the format: Bearer <token>'
        }
      },
      schemas: {
        Order: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            customerId: { type: 'string' },
            createdBy: { type: 'string' },
            location: { type: 'string', enum: ['in_shop', 'away'] },
            type: { type: 'string', enum: ['pickup', 'delivery'] },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  skuId: { type: 'string' },
                  productId: { type: 'string' },
                  title: { type: 'string' },
                  variantOptions: { type: 'object', additionalProperties: { type: 'string' } },
                  quantity: { type: 'integer' },
                  unitPrice: { type: 'number' },
                  packagingChoice: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      fee: { type: 'number' }
                    }
                  }
                }
              }
            },
            pricing: {
              type: 'object',
              properties: {
                subtotal: { type: 'number' },
                discounts: { type: 'number' },
                packagingFee: { type: 'number' },
                schedulingFee: { type: 'number' },
                deliveryFee: { type: 'number' },
                tax: { type: 'number' },
                total: { type: 'number' }
              }
            },
            timing: { type: 'object', properties: { isScheduled: { type: 'boolean' }, scheduledAt: { type: 'string', nullable: true } } },
            addressId: { type: 'string', nullable: true },
            paymentPreference: {
              type: 'object',
              properties: {
                mode: { type: 'string', enum: ['post_to_bill', 'pay_now', 'cash', 'cod'] },
                method: { type: 'string', nullable: true }
              }
            },
            status: { type: 'string' },
            paymentStatus: { type: 'string', enum: ['UNPAID', 'PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
            invoiceId: { type: 'string', nullable: true },
            receiptId: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Invoice: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            orderId: { type: 'string' },
            number: { type: 'string' },
            lineItems: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, amount: { type: 'number' } } } },
            subtotal: { type: 'number' },
            fees: { type: 'number' },
            tax: { type: 'number' },
            total: { type: 'number' },
            balanceDue: { type: 'number' },
            paymentStatus: { type: 'string', enum: ['PENDING', 'PAID', 'CANCELLED'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            invoiceId: { type: 'string' },
            method: { type: 'string', enum: ['mpesa_stk', 'paystack_card', 'cash', 'post_to_bill', 'cod'] },
            amount: { type: 'number' },
            currency: { type: 'string' },
            status: { type: 'string', enum: ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'] },
            processorRefs: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Receipt: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            orderId: { type: 'string' },
            invoiceId: { type: 'string' },
            receiptNumber: { type: 'string' },
            amountPaid: { type: 'number' },
            paymentMethod: { type: 'string', enum: ['mpesa_stk', 'paystack_card', 'cash'] },
            issuedAt: { type: 'string', format: 'date-time' },
            pdfUrl: { type: 'string' }
          }
        },
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'User ID'
            },
            name: {
              type: 'string',
              description: 'User full name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            phone: {
              type: 'string',
              description: 'User phone number'
            },
            avatar: {
              type: 'string',
              description: 'User avatar URL'
            },
            isAdmin: {
              type: 'boolean',
              description: 'Whether user has admin privileges'
            },
            roles: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Role'
              },
              description: 'User assigned roles'
            },
            isVerified: {
              type: 'boolean',
              description: 'Whether user is verified'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether user account is active'
            },
            country: {
              type: 'string',
              description: 'User country'
            },
            timezone: {
              type: 'string',
              description: 'User timezone'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Role: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Role ID'
            },
            name: {
              type: 'string',
              description: 'Role name (unique, lowercase)'
            },
            description: {
              type: 'string',
              description: 'Role description'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether role is active'
            },
            createdBy: {
              type: 'string',
              description: 'ID of user who created this role'
            },
            updatedBy: {
              type: 'string',
              description: 'ID of user who last updated this role'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Role creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Address: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Address ID'
            },
            userId: {
              type: 'string',
              description: 'User ID who owns this address'
            },
            label: {
              type: 'string',
              description: 'Address label (Home, Office, etc.)'
            },
            street: {
              type: 'string',
              description: 'Street address'
            },
            city: {
              type: 'string',
              description: 'City name'
            },
            region: {
              type: 'string',
              description: 'Region/County'
            },
            country: {
              type: 'string',
              description: 'Country name'
            },
            postal: {
              type: 'string',
              description: 'Postal code'
            },
            googlePlaceId: {
              type: 'string',
              description: 'Google Places API place ID'
            },
            coordinates: {
              type: 'object',
              properties: {
                latitude: {
                  type: 'number',
                  description: 'Latitude coordinate'
                },
                longitude: {
                  type: 'number',
                  description: 'Longitude coordinate'
                }
              }
            },
            formattedAddress: {
              type: 'string',
              description: 'Formatted address from Google Places'
            },
            locationDetails: {
              type: 'object',
              properties: {
                neighborhood: {
                  type: 'string',
                  description: 'Neighborhood name'
                },
                sublocality: {
                  type: 'string',
                  description: 'Sublocality name'
                },
                administrativeArea: {
                  type: 'string',
                  description: 'Administrative area'
                },
                route: {
                  type: 'string',
                  description: 'Route/street name'
                },
                streetNumber: {
                  type: 'string',
                  description: 'Street number'
                }
              }
            },
            isDefault: {
              type: 'boolean',
              description: 'Whether this is the default address'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether this address is active'
            },
            fullAddress: {
              type: 'string',
              description: 'Full formatted address (virtual field)'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Address creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            message: {
              type: 'string'
            },
            data: {
              type: 'object',
              properties: {
                user: {
                  $ref: '#/components/schemas/User'
                },
                accessToken: {
                  type: 'string',
                  description: 'JWT access token'
                },
                refreshToken: {
                  type: 'string',
                  description: 'JWT refresh token'
                }
              }
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            statusCode: {
              type: 'number',
              description: 'HTTP status code'
            }
          }
        },
        PaginationResponse: {
          type: 'object',
          properties: {
            currentPage: {
              type: 'number',
              description: 'Current page number'
            },
            totalPages: {
              type: 'number',
              description: 'Total number of pages'
            },
            totalItems: {
              type: 'number',
              description: 'Total number of items'
            },
            hasNextPage: {
              type: 'boolean',
              description: 'Whether there is a next page'
            },
            hasPrevPage: {
              type: 'boolean',
              description: 'Whether there is a previous page'
            }
          }
        },
        Variant: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Variant ID'
            },
            name: {
              type: 'string',
              description: 'Variant name (e.g., Size, Color)'
            },
            description: {
              type: 'string',
              description: 'Variant description'
            },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  _id: {
                    type: 'string',
                    description: 'Option ID'
                  },
                  value: {
                    type: 'string',
                    description: 'Option value'
                  },
                  sortOrder: {
                    type: 'integer',
                    description: 'Sort order'
                  },
                  isActive: {
                    type: 'boolean',
                    description: 'Whether option is active'
                  }
                }
              }
            },
            displayType: {
              type: 'string',
              enum: ['dropdown', 'radio', 'checkbox', 'swatch'],
              description: 'Display type for the variant'
            },
            colorHex: {
              type: 'string',
              description: 'Color hex code (for color variants)'
            },
            measurement: {
              type: 'string',
              description: 'Measurement unit'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether variant is active'
            },
            sortOrder: {
              type: 'integer',
              description: 'Sort order'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Product: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Product ID'
            },
            title: {
              type: 'string',
              description: 'Product title'
            },
            slug: {
              type: 'string',
              description: 'Product slug'
            },
            description: {
              type: 'string',
              description: 'Product description'
            },
            basePrice: {
              type: 'number',
              description: 'Base price'
            },
            status: {
              type: 'string',
              enum: ['active', 'draft', 'archived'],
              description: 'Product status'
            },
            variants: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Variant'
              }
            },
            skus: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  _id: {
                    type: 'string',
                    description: 'SKU ID'
                  },
                  price: {
                    type: 'number',
                    description: 'SKU price'
                  },
                  stock: {
                    type: 'integer',
                    description: 'Stock quantity'
                  },
                  skuCode: {
                    type: 'string',
                    description: 'SKU code'
                  },
                  isActive: {
                    type: 'boolean',
                    description: 'Whether SKU is active'
                  }
                }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        CartItem: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Cart item ID'
            },
            product: {
              $ref: '#/components/schemas/Product',
              description: 'Product information'
            },
            skuId: {
              type: 'string',
              description: 'SKU ID'
            },
            quantity: {
              type: 'integer',
              description: 'Quantity in cart'
            },
            price: {
              type: 'number',
              description: 'Price per item'
            },
            totalPrice: {
              type: 'number',
              description: 'Total price for this item'
            },
            selectedOptions: {
              type: 'object',
              description: 'Selected variant options'
            }
          }
        },
        Cart: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Cart ID'
            },
            userId: {
              type: 'string',
              description: 'User ID who owns the cart'
            },
            items: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/CartItem'
              }
            },
            subtotal: {
              type: 'number',
              description: 'Cart subtotal'
            },
            totalItems: {
              type: 'integer',
              description: 'Total number of items'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether cart is active'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Cart creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Coupon: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Coupon ID'
            },
            code: {
              type: 'string',
              description: 'Coupon code'
            },
            name: {
              type: 'string',
              description: 'Coupon name'
            },
            description: {
              type: 'string',
              description: 'Coupon description'
            },
            discountType: {
              type: 'string',
              enum: ['percentage', 'fixed'],
              description: 'Type of discount'
            },
            discountValue: {
              type: 'number',
              description: 'Discount value'
            },
            minimumAmount: {
              type: 'number',
              description: 'Minimum order amount'
            },
            maximumDiscount: {
              type: 'number',
              description: 'Maximum discount amount'
            },
            usageLimit: {
              type: 'integer',
              description: 'Total usage limit'
            },
            usageCount: {
              type: 'integer',
              description: 'Current usage count'
            },
            perUserLimit: {
              type: 'integer',
              description: 'Usage limit per user'
            },
            expiryDate: {
              type: 'string',
              format: 'date-time',
              description: 'Expiry date'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether coupon is active'
            },
            applicableProducts: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Applicable product IDs'
            },
            applicableCategories: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Applicable category IDs'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Category: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Category ID'
            },
            name: {
              type: 'string',
              description: 'Category name'
            },
            slug: {
              type: 'string',
              description: 'Category slug'
            },
            description: {
              type: 'string',
              description: 'Category description'
            },
            parentId: {
              type: 'string',
              description: 'Parent category ID'
            },
            image: {
              type: 'string',
              description: 'Category image URL'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether category is active'
            },
            sortOrder: {
              type: 'integer',
              description: 'Sort order'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Brand: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Brand ID'
            },
            name: {
              type: 'string',
              description: 'Brand name'
            },
            slug: {
              type: 'string',
              description: 'Brand slug'
            },
            description: {
              type: 'string',
              description: 'Brand description'
            },
            logo: {
              type: 'string',
              description: 'Brand logo URL'
            },
            website: {
              type: 'string',
              description: 'Brand website URL'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether brand is active'
            },
            sortOrder: {
              type: 'integer',
              description: 'Sort order'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Collection: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Collection ID'
            },
            name: {
              type: 'string',
              description: 'Collection name'
            },
            slug: {
              type: 'string',
              description: 'Collection slug'
            },
            description: {
              type: 'string',
              description: 'Collection description'
            },
            image: {
              type: 'string',
              description: 'Collection image URL'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether collection is active'
            },
            sortOrder: {
              type: 'integer',
              description: 'Sort order'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Tag: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Tag ID'
            },
            name: {
              type: 'string',
              description: 'Tag name'
            },
            slug: {
              type: 'string',
              description: 'Tag slug'
            },
            description: {
              type: 'string',
              description: 'Tag description'
            },
            color: {
              type: 'string',
              description: 'Tag color hex code'
            },
            type: {
              type: 'string',
              enum: ['product', 'blog', 'general'],
              description: 'Tag type'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether tag is active'
            },
            sortOrder: {
              type: 'integer',
              description: 'Sort order'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Review: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Review ID'
            },
            productId: {
              type: 'string',
              description: 'Product ID being reviewed'
            },
            userId: {
              type: 'string',
              description: 'User ID who wrote the review'
            },
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Rating from 1-5 stars'
            },
            comment: {
              type: 'string',
              description: 'Review comment'
            },
            isVerifiedPurchase: {
              type: 'boolean',
              description: 'Whether review is from verified purchase'
            },
            isApproved: {
              type: 'boolean',
              description: 'Whether review is approved by admin'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Review creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Users',
        description: 'User profile and account management'
      },
      {
        name: 'Addresses',
        description: 'Address management with Google Places integration'
      },
      {
        name: 'Roles',
        description: 'Role-based access control and permission management'
      },
      {
        name: 'Variants',
        description: 'Product variant and option management'
      },
      {
        name: 'Products',
        description: 'Product catalog and inventory management'
      },
      {
        name: 'Categories',
        description: 'Product category management'
      },
      {
        name: 'Brands',
        description: 'Brand management'
      },
      {
        name: 'Collections',
        description: 'Product collection management'
      },
      {
        name: 'Tags',
        description: 'Product tag management'
      },
      {
        name: 'Cart',
        description: 'Shopping cart management'
      },
      {
        name: 'Coupons',
        description: 'Discount coupon management'
      },
      {
        name: 'Reviews',
        description: 'Product review management'
      },
      {
        name: 'Orders',
        description: 'Order processing and tracking'
      },
      {
        name: 'Payments',
        description: 'Payment processing (M-Pesa, Paystack)'
      },
      {
        name: 'Invoices',
        description: 'Order invoice management'
      },
      {
        name: 'Receipts',
        description: 'Receipt generation and retrieval'
      }
    ]
  },
  apis: [
    './routes/*.js',
    './controllers/*.js',
    './models/*.js'
  ]
}


const specs = swaggerJsdoc(options)


const swaggerConfig = {
  swaggerUi,
  specs,
  options: {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #4B2E83 }
      .swagger-ui .scheme-container { background: #f8f9fa }
    `,
    customSiteTitle: 'TEO KICKS API Documentation',
    customfavIcon: '/favicon.ico'
  }
}


export default swaggerConfig