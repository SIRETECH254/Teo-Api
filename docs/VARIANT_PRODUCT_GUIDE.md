# Variant & Product System Guide

This guide explains how to use the improved variant and product system in your TEO KICKS e-commerce platform.

## 🏗️ **System Architecture**

### **Core Components**

1. **Variants** - Reusable attributes (Size, Color, Material)
2. **Products** - Main catalog items with variants and SKUs
3. **SKUs** - Specific variant combinations with individual pricing/stock
4. **Categories** - Product categorization
5. **Collections** - Curated product groups

### **Data Flow**

```
Variants (Size, Color) → Products → SKUs (Size-M + Color-Red)
```

## 📊 **Database Models**

### **Variant Model** (`variantModel.js`)

```javascript
Variant {
  name: "Color",                    // e.g., "Size", "Color", "Material"
  description: "Product colors",
  options: [                        // Possible values
    { value: "Red", isActive: true },
    { value: "Blue", isActive: true }
  ],
  displayType: "swatch",            // UI display method
  isActive: true
}
```

### **Product Model** (`productModel.js`)

```javascript
Product {
  title: "Nike Air Max 90",
  slug: "nike-air-max-90",
  basePrice: 5000,
  variants: [variantId1, variantId2],  // References to Variant collection
  skus: [                              // Generated combinations
    {
      attributes: [
        { variantId: "colorId", optionId: "redId" },
        { variantId: "sizeId", optionId: "8Id" }
      ],
      price: 5000,
      stock: 10,
      skuCode: "NK90-RED-8"
    }
  ]
}
```

## 🚀 **API Endpoints**

### **Variants**

#### **Create Variant**
```bash
POST /api/variants
Content-Type: application/json

{
  "name": "Size",
  "description": "Shoe sizes",
  "options": [
    { "value": "7", "sortOrder": 1 },
    { "value": "8", "sortOrder": 2 },
    { "value": "9", "sortOrder": 3 }
  ],
  "displayType": "dropdown"
}
```

#### **Get All Variants**
```bash
GET /api/variants?page=1&limit=10&search=size
```

#### **Add Option to Variant**
```bash
POST /api/variants/:variantId/options
Content-Type: application/json

{
  "value": "10",
  "sortOrder": 4
}
```

### **Products**

#### **Create Product**
```bash
POST /api/products
Content-Type: application/json

{
  "title": "Nike Air Max 90",
  "description": "Classic sneaker",
  "basePrice": 5000,
  "variants": ["colorVariantId", "sizeVariantId"],
  "categories": ["shoesCategoryId"],
  "brand": "Nike"
}
```

#### **Generate SKUs**
```bash
POST /api/products/:productId/generate-skus
```

#### **Update SKU**
```bash
PATCH /api/products/:productId/skus/:skuId
Content-Type: application/json

{
  "price": 5500,
  "stock": 15
}
```

## 🛠️ **Implementation Examples**

### **1. Setting Up Variants**

```javascript
// Create Size variant
const sizeVariant = await Variant.create({
  name: "Size",
  description: "Shoe sizes",
  options: [
    { value: "7", sortOrder: 1 },
    { value: "8", sortOrder: 2 },
    { value: "9", sortOrder: 3 }
  ],
  displayType: "dropdown"
})

// Create Color variant
const colorVariant = await Variant.create({
  name: "Color",
  description: "Shoe colors",
  options: [
    { value: "Red", sortOrder: 1, colorHex: "#FF0000" },
    { value: "Blue", sortOrder: 2, colorHex: "#0000FF" }
  ],
  displayType: "swatch"
})
```

### **2. Creating Products with Variants**

```javascript
// Create product with variants
const product = await Product.create({
  title: "Nike Air Max 90",
  description: "Classic sneaker",
  basePrice: 5000,
  variants: [sizeVariant._id, colorVariant._id],
  categories: [shoesCategory._id],
  brand: "Nike",
  createdBy: userId
})

// Generate SKUs automatically
await product.generateSKUs()
```

### **3. SKU Auto-Generation**

The system automatically generates all possible variant combinations:

```javascript
// For Size [7,8,9] + Color [Red,Blue]
// Generates 6 SKUs:
// - Size 7 + Red
// - Size 7 + Blue
// - Size 8 + Red
// - Size 8 + Blue
// - Size 9 + Red
// - Size 9 + Blue
```

## 📋 **Admin Workflow**

### **1. Create Variants First**
1. Go to Admin Panel → Variants
2. Create Size variant with options: 7, 8, 9, 10
3. Create Color variant with options: Red, Blue, Black
4. Create Material variant with options: Leather, Canvas

### **2. Create Products**
1. Go to Admin Panel → Products → New Product
2. Fill in basic details (title, description, base price)
3. Attach relevant variants (Size, Color, Material)
4. Save product

### **3. Manage SKUs**
1. System auto-generates all SKU combinations
2. Edit individual SKU prices and stock levels
3. Set low stock thresholds
4. Enable/disable pre-orders per SKU

### **4. Inventory Management**
1. Update stock levels per SKU
2. Set up low stock alerts
3. Manage pre-order settings
4. Track inventory movements

## 🎯 **Frontend Integration**

### **Product Display**

```javascript
// Get product with variants and SKUs
const product = await Product.findById(productId)
  .populate('variants')
  .populate('categories')

// Display variant options
product.variants.forEach(variant => {
  console.log(`${variant.name}: ${variant.options.map(o => o.value).join(', ')}`)
})

// Display SKUs
product.skus.forEach(sku => {
  console.log(`SKU: ${sku.skuCode}, Price: ${sku.price}, Stock: ${sku.stock}`)
})
```

### **SKU Selection**

```javascript
// Find SKU by selected options
const findSKU = (selectedOptions) => {
  return product.skus.find(sku => {
    return selectedOptions.every(selected => {
      return sku.attributes.some(attr => 
        attr.variantId === selected.variantId && 
        attr.optionId === selected.optionId
      )
    })
  })
}
```

## 🔧 **Advanced Features**

### **1. Dynamic Pricing**
- Set different prices per SKU
- Bulk price updates
- Discount applications

### **2. Inventory Tracking**
- Real-time stock updates
- Low stock alerts
- Pre-order management

### **3. SEO Optimization**
- Automatic slug generation
- Meta title/description
- Structured data

### **4. Analytics**
- Product view tracking
- SKU performance metrics
- Inventory analytics

## 🚨 **Best Practices**

### **1. Variant Naming**
- Use clear, consistent names
- Keep options concise
- Use proper capitalization

### **2. SKU Management**
- Regular stock updates
- Monitor low stock levels
- Clean up unused SKUs

### **3. Performance**
- Use indexes for queries
- Implement caching
- Optimize database queries

### **4. Data Integrity**
- Validate variant combinations
- Ensure unique SKU codes
- Maintain referential integrity

## 🔄 **Migration from Old System**

If you have existing products without variants:

1. **Create default variants** for existing products
2. **Generate SKUs** for all products
3. **Update frontend** to use new SKU system
4. **Test thoroughly** before going live

## 📚 **API Documentation**

Full API documentation is available at:
`http://localhost:5000/api/docs`

## 🆘 **Troubleshooting**

### **Common Issues**

1. **SKU not found**: Check if variants are properly attached
2. **Duplicate SKU codes**: Ensure unique product slugs
3. **Missing options**: Verify variant options exist
4. **Stock issues**: Check SKU stock levels

### **Debug Commands**

```bash
# Check variant structure
GET /api/variants/:id

# Verify product SKUs
GET /api/products/:id

# Regenerate SKUs
POST /api/products/:id/generate-skus
```

This improved system provides a robust foundation for managing complex product catalogs with multiple variants and SKUs! 