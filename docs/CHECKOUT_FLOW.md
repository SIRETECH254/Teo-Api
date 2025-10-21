### Admin Checkout Flow (Cart → Checkout → Order/Invoice/Receipt)

This document defines the end-to-end logic (frontend + backend) for the admin checkout process initiated from `@admin/Cart.jsx`. It covers the procedural tabs, payment paths, order/invoice/receipt lifecycle, and realtime notifications via websockets. No code here — implementation guidance only.

## High-level Flow
- From Cart → Proceed to Checkout
- Checkout uses procedural tabs (1 → 7). Each tab validates and persists the user’s choices.
- On Complete Order:
  - Create Order (status depends on payment preference)
  - Create Invoice linked to Order (1:1)
  - If Pay Now: initiate payment (MPesa via Daraja STK / Card via Paystack)
  - On payment success: finalize Invoice, generate Receipt, update Order status
  - Emit websocket events for order, payment, invoice, receipt, notifications

## Frontend: Checkout Tabs (Procedural)
Validation: cannot proceed unless the current tab is valid. Tabs are dynamic; some are hidden based on earlier choices.

1) Location
- Values: `in_shop` | `away`
- Drives payment eligibility (e.g., Post to Bill available only in-shop)

2) Order Type
- Values: `pickup` | `delivery`
- Allowed permutations:
  - in_shop → delivery or pickup
  - away → delivery or pickup (pickup ≈ self-pickup)
- If delivery → Address tab appears; pickup skips Address tab.

3) Packaging Option
- Visible only if any cart item has a packaging option with fee > 0
- Selection strategy can be per-item or per-order (decide in UI/UX)
- Totals incorporate packagingFee

4) Timing
- Values: `now` | `scheduled`
- If scheduled: pick date/time (validate against store hours, holidays, lead time, cutoff). Add schedulingFee if enabled.

5) Address (only for delivery)
- Choose from saved addresses or add new; allow default selection
- Distance-based fee for away/delivery; show fee in summary

6) Payment
- Values: `post_to_bill` | `pay_now` (mpesa_stk via Daraja | paystack_card) | `cash` (incl. COD if enabled)
- Availability examples:
  - Post to Bill: in_shop only
  - Cash: in_shop pickup/delivery; COD optional if delivery + allowed
  - Online (MPesa via Daraja / Paystack card): typically required for away orders
- Behavior:
  - Post to Bill → invoice paymentStatus: PENDING; settle later
  - Cash (in-shop) → mark paid if collected immediately; otherwise keep paymentStatus: PENDING
  - COD → invoice paymentStatus: PENDING until handover, then paid on collection
  - Pay Now → initiate transaction, await result

7) Summary
- Show items, variants, pricing breakdown (subtotal, discounts, packaging, scheduling, delivery, tax, total)
- Show location, order type, timing, address (if delivery), payment method
- CTA: Complete Order

## Backend: Data Model (Core Fields)
Order
- id, userId (staff initiator + customerId), location, type
- items [{ skuId, productId, quantity, unitPrice, variantOptions, packagingChoice? }]
- pricing: subtotal, discounts, packagingFee, schedulingFee, deliveryFee, tax, total
- timing: isScheduled, scheduledAt
- addressId (if delivery)
- paymentPreference (post_to_bill | pay_now method | cash/COD)
- status (enum): PLACED → CONFIRMED → PACKED → SHIPPED/OUT_FOR_DELIVERY → DELIVERED; CANCELLED/REFUNDED
- paymentStatus (enum): UNPAID | PENDING | PAID | PARTIALLY_REFUNDED | REFUNDED
- invoiceId, receiptId?, metadata, createdBy, createdAt

Invoice
- id, orderId, number, lineItems, subtotal, fees, tax, total, balanceDue
- paymentStatus: PENDING | PAID | CANCELLED

Payment
- id, invoiceId, method (mpesa_stk | paystack_card | cash | post_to_bill | cod), amount, currency
- processorRefs (merchantRequestId, checkoutRequestId, paystackRef, etc.), status: INITIATED | PENDING | SUCCESS | FAILED | CANCELLED
- timestamps, rawPayload

Receipt
- id, orderId, invoiceId, receiptNumber, amountPaid, paymentMethod, issuedAt

Notification
- id, userId, type (order_created, payment_success, order_status_changed, invoice_generated, receipt_issued), payload, read

Optional Delivery
- id, orderId, assignedTo (rider), distanceKm, deliveryFee, status (ASSIGNED → PICKED → DELIVERED)

### Core fields as JSON (schema-style, representative values)
```json
{
  "Order": {
    "id": "string",
    "customerId": "string",
    "createdBy": "string",
    "location": "in_shop | away",
    "type": "pickup | delivery",
    "items": [
      {
        "skuId": "string",
        "productId": "string",
        "title": "string",
        "variantOptions": { "<variantName>": "<optionValue>" },
        "quantity": 0,
        "unitPrice": 0,
        "packagingChoice": { "id": "string", "name": "string", "fee": 0 }
      }
    ],
    "pricing": {
      "subtotal": 0,
      "discounts": 0,
      "packagingFee": 0,
      "schedulingFee": 0,
      "deliveryFee": 0,
      "tax": 0,
      "total": 0
    },
    "timing": { "isScheduled": false, "scheduledAt": "ISO8601|null" },
    "addressId": "string|null",
    "paymentPreference": {
      "mode": "post_to_bill | pay_now | cash | cod",
      "method": "mpesa_stk | paystack_card | null"
    },
    "status": "PLACED | CONFIRMED | PACKED | SHIPPED | OUT_FOR_DELIVERY | DELIVERED | CANCELLED | REFUNDED",
    "paymentStatus": "UNPAID | PENDING | PAID | PARTIALLY_REFUNDED | REFUNDED",
    "invoiceId": "string|null",
    "receiptId": "string|null",
    "metadata": {},
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  },
  "Invoice": {
    "id": "string",
    "orderId": "string",
    "number": "string",
    "lineItems": [ { "label": "string", "amount": 0 } ],
    "subtotal": 0,
    "fees": 0,
    "tax": 0,
    "total": 0,
    "balanceDue": 0,
    "paymentStatus": "PENDING | PAID | CANCELLED",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  },
  "Payment": {
    "id": "string",
    "invoiceId": "string",
    "method": "mpesa_stk | paystack_card | cash | post_to_bill | cod",
    "amount": 0,
    "currency": "KES",
    "processorRefs": {
      "daraja": { "merchantRequestId": "string", "checkoutRequestId": "string" },
      "paystack": { "reference": "string" }
    },
    "status": "INITIATED | PENDING | SUCCESS | FAILED | CANCELLED",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601",
    "rawPayload": {}
  },
  "Receipt": {
    "id": "string",
    "orderId": "string",
    "invoiceId": "string",
    "receiptNumber": "string",
    "amountPaid": 0,
    "paymentMethod": "mpesa_stk | paystack_card | cash",
    "issuedAt": "ISO8601",
    "pdfUrl": "string"
  },
  "Notification": {
    "id": "string",
    "userId": "string",
    "type": "order_created | payment_success | order_status_changed | invoice_generated | receipt_issued",
    "payload": {},
    "read": false,
    "createdAt": "ISO8601"
  },
  "Delivery": {
    "id": "string",
    "orderId": "string",
    "assignedTo": "string",
    "distanceKm": 0,
    "deliveryFee": 0,
    "status": "ASSIGNED | PICKED | DELIVERED",
    "createdAt": "ISO8601"
  }
}
```

## Backend: Endpoints (Suggested)
Orders
- POST /orders — create order from checkout selections (returns orderId)
- GET /orders/:id — detail (includes invoice/payment/receipt)
- PATCH /orders/:id/status — update status (admin)
- PATCH /orders/:id/assign-rider — optional

Invoices
- POST /invoices — create invoice for a given orderId (called explicitly after order creation)
- GET /invoices/:id
- PATCH /invoices/:id/void (admin)

Payments
- POST /payments/initiate — { invoiceId, method, amount }
- GET /payments/:id
- Webhooks: POST /webhooks/mpesa, POST /webhooks/paystack
- PATCH /payments/:id/cash — mark cash collected (admin)

Receipts
- POST /receipts — generate when invoice paid
- GET /receipts/:id

Address & Fees
- GET /delivery/fee?from=store&to=addressId — distance-based fee
- GET /store/hours, GET /store/holidays — timing validation

Notifications
- GET /notifications (admin)
- POST /notifications/mark-read

Config/Eligibility
- GET /store-config — toggles: COD, scheduling, fee-per-km, in-shop rules

## Creation & Status Transitions
Complete Order (frontend)
1) POST /orders with: location, type, timing, addressId (if delivery), paymentPreference, packagingSelections, cartId (optional), creator
2) Server creates Order (PLACED) and Invoice (paymentStatus PENDING) inside one transaction (OrderService → InvoiceService). Order items are pulled from server cart and totals are recalculated on backend:
   - post_to_bill → Invoice paymentStatus PENDING; return success
   - cash (in-shop) → optionally mark paid immediately (paymentStatus PAID)
   - pay_now → initiate payment; return PENDING + tracking data
3) On online payment webhook success → Payment SUCCESS → Invoice PAID → Receipt created → Order.paymentStatus PAID → emit events

## Realtime (WebSockets)
Namespaces/Rooms
- role:admin, role:rider, user:<userId>, order:<orderId>

Events
- order.created { orderId }
- order.updated { orderId, status }
- invoice.created { invoiceId, orderId }
- payment.updated { paymentId, status }
- receipt.created { receiptId, orderId }
- notification.new { notificationId }

## Payment Integrations
MPesa STK (Daraja)
- Initiate STK push via Daraja (PENDING); handle Daraja webhook for SUCCESS/FAILED; update payment/invoice/order; emit events

Paystack (Card)
- Create card transaction reference; handle Paystack webhook for final status; update entities; emit events

Cash
- In-shop: mark collected (admin) → Invoice paymentStatus PAID → Receipt
- COD: Invoice paymentStatus PENDING until delivery; collect at handover

Post to Bill (in_shop)
- Invoice paymentStatus PENDING; multiple orders may be posted to bill; settle later via separate flow

## Pricing & Totals
- subtotal = sum(item.unitPrice × qty)
- discounts (coupons)
- packagingFee (if any)
- schedulingFee (if any)
- deliveryFee (if any)
- tax (if configured)
- total = subtotal − discounts + fees + tax

Guardrails
- Away orders typically require pay-now unless config allows COD
- Scheduling must respect business hours/holidays
- Pickup must not include delivery fee

## Notifications
Triggers
- Order created; Payment success/fail; Order status changes; Receipt issued

Channels
- In-app (websocket), email, SMS (if configured)

## State Machines
Order.status
- PLACED → CONFIRMED → PACKED → SHIPPED/OUT_FOR_DELIVERY → DELIVERED (CANCELLED/REFUNDED)

Payment.status
- INITIATED → PENDING → SUCCESS | FAILED | CANCELLED

Invoice.status
- OPEN → PENDING → PAID | VOID

Delivery.status (optional)
- ASSIGNED → PICKED → DELIVERED

## Validation & Edge Cases
- Empty cart → block checkout
- Address required for delivery; valid geocoding
- Scheduled date/time within rules; add schedulingFee
- Payment method eligibility (in_shop vs away)
- Idempotency keys for create order/invoice/payment-initiate
- Concurrency: lock invoice to prevent double-pay

## Security
- Admin/staff role guards; audit sensitive mutations (status, cash mark-paid)
- Webhook signature verification (Daraja/Paystack)
- Scoped socket access; join rooms after auth

## Implementation Notes (Work Units)
Backend
- Models: Order, Invoice, Payment, Receipt, Notification (+ Delivery optional)
- Controllers: order, invoice, payment (incl. webhooks), receipt, notification
- Routes: as listed above
- Services: payment integrations, invoicing, receipt, notifications, socket gateway
- Realtime: socket server emitting on mutations

Frontend
- Checkout wizard (7 tabs) with guarded navigation and dynamic visibility
- Totals calculator (recompute on change)
- Payment initiation & tracking UI (PENDING states)
- Realtime listeners to reflect status changes
- Summary + Complete Order call (order → invoice → optional payment)


---

## API & Models Reference (Authoritative)

This section contains concrete JSON schemas, sample payloads, controller responsibilities, routes, and example requests/responses for the end-to-end flow.

### Models (JSON shape examples)

Order (example)
```json
{
  "id": "ord_01JZ6XZ4R6S7W0",
  "customerId": "cus_01JZ6XYV3CE3C8",
  "createdBy": "staff_01JZ6XXY8PQ4AB",
  "location": "in_shop",
  "type": "delivery",
  "items": [
    {
      "skuId": "sku_abc123",
      "productId": "prod_01JZ6XE4P9M3ZQ",
      "title": "Nike Air Max 270",
      "variantOptions": { "Size": "10" },
      "quantity": 2,
      "unitPrice": 1500,
      "packagingChoice": { "id": "pack_gift", "name": "Gift", "fee": 100 }
    }
  ],
  "pricing": {
    "subtotal": 3000,
    "discounts": 0,
    "packagingFee": 100,
    "schedulingFee": 0,
    "deliveryFee": 200,
    "tax": 0,
    "total": 3300
  },
  "timing": { "isScheduled": false, "scheduledAt": null },
  "addressId": "addr_01JZ6WQ1D6N7PM",
  "paymentPreference": { "mode": "pay_now", "method": "mpesa_stk" },
  "status": "PLACED",
  "paymentStatus": "PENDING",
  "invoiceId": null,
  "receiptId": null,
  "metadata": { "notes": "Leave at reception" },
  "createdAt": "2025-09-10T10:12:34.000Z",
  "updatedAt": "2025-09-10T10:12:34.000Z"
}
```

Order (away + pickup, pay_now only — no cash)
```json
{
  "id": "ord_01JZ7A2MN3PQRS",
  "customerId": "cus_01JZ6XYV3CE3C8",
  "createdBy": "staff_01JZ6XXY8PQ4AB",
  "location": "away",
  "type": "pickup",
  "items": [
    {
      "skuId": "sku_xyz789",
      "productId": "prod_01JZ700K2ABC9D",
      "title": "Adidas Ultraboost 22",
      "variantOptions": { "Size": "9" },
      "quantity": 1,
      "unitPrice": 1800
    }
  ],
  "pricing": {
    "subtotal": 1800,
    "discounts": 0,
    "packagingFee": 0,
    "schedulingFee": 0,
    "deliveryFee": 0,
    "tax": 0,
    "total": 1800
  },
  "timing": { "isScheduled": false, "scheduledAt": null },
  "addressId": null,
  "paymentPreference": { "mode": "pay_now", "method": "paystack_card" },
  "status": "PLACED",
  "paymentStatus": "PENDING",
  "invoiceId": null,
  "receiptId": null,
  "metadata": { "notes": "Customer will self-pick at front desk" },
  "createdAt": "2025-09-10T11:00:00.000Z",
  "updatedAt": "2025-09-10T11:00:00.000Z"
}
```

Invoice (example)
```json
{
  "id": "inv_01JZ6Y0CC5RB2N",
  "orderId": "ord_01JZ6XZ4R6S7W0",
  "number": "INV-2025-000123",
  "lineItems": [
    { "label": "Items subtotal", "amount": 3000 },
    { "label": "Packaging", "amount": 100 },
    { "label": "Delivery", "amount": 200 }
  ],
  "subtotal": 3000,
  "fees": 300,
  "tax": 0,
  "total": 3300,
  "balanceDue": 3300,
  "status": "OPEN",
  "createdAt": "2025-09-10T10:13:00.000Z",
  "updatedAt": "2025-09-10T10:13:00.000Z"
}
```

Payment (example)
```json
{
  "id": "pay_01JZ6Y5W9E2T4Q",
  "invoiceId": "inv_01JZ6Y0CC5RB2N",
  "method": "mpesa_stk",
  "amount": 3300,
  "currency": "KES",
  "processorRefs": {
    "daraja": {
      "merchantRequestId": "29115-34620561-1",
      "checkoutRequestId": "ws_CO_03092024101526212"
    }
  },
  "status": "PENDING",
  "createdAt": "2025-09-10T10:13:05.000Z",
  "updatedAt": "2025-09-10T10:13:05.000Z",
  "rawPayload": null
}
```

Receipt (example)
```json
{
  "id": "rcp_01JZ6YDTBTV28C",
  "orderId": "ord_01JZ6XZ4R6S7W0",
  "invoiceId": "inv_01JZ6Y0CC5RB2N",
  "receiptNumber": "RCP-2025-000456",
  "amountPaid": 3300,
  "paymentMethod": "mpesa_stk",
  "issuedAt": "2025-09-10T10:15:30.000Z",
  "pdfUrl": "https://res.cloudinary.com/teo-kicks/image/upload/v1725966930/receipts/RCP-2025-000456.pdf"
}
```

Notes:
- Receipt PDFs are generated server-side, uploaded to Cloudinary, and the `pdfUrl` is persisted on the receipt.
- After creation, the receipt PDF link is sent to the user via email (and optionally SMS) along with a summary.

Notification (example)
```json
{
  "id": "ntf_01JZ6YQ8DQBQ6E",
  "userId": "cus_01JZ6XYV3CE3C8",
  "type": "payment_success",
  "payload": { "orderId": "ord_01JZ6XZ4R6S7W0", "invoiceId": "inv_01JZ6Y0CC5RB2N" },
  "read": false,
  "createdAt": "2025-09-10T10:15:31.000Z"
}
```

Delivery (optional, example)
```json
{
  "id": "dlv_01JZ6Z3XJ4FDQF",
  "orderId": "ord_01JZ6XZ4R6S7W0",
  "assignedTo": "rider_01JZ7001WQ9ZTP",
  "distanceKm": 5.8,
  "deliveryFee": 200,
  "status": "ASSIGNED",
  "createdAt": "2025-09-10T10:20:00.000Z"
}
```

### Routes, Controllers, Payloads

- Orders
- Route: POST /orders
- Controller: createOrder(req, res)
- Request (body)
```json
{
  "customerId": "cus_01JZ6XYV3CE3C8",
  "location": "in_shop",
  "type": "delivery",
  "timing": { "isScheduled": false, "scheduledAt": null },
  "addressId": "addr_01JZ6WQ1D6N7PM",
  "paymentPreference": { "mode": "pay_now", "method": "mpesa_stk" },
  "packagingSelections": [
    { "skuId": "sku_abc123", "choiceId": "pack_gift" }
  ],
  "cartId": null,
  "metadata": { "notes": "Leave at reception" }
}
```
Note:
- Items and prices are NOT accepted from the client. The server loads the authoritative cart items for the authenticated customer (or the provided `cartId`) and recalculates prices (unit price, delivery fee, packaging, taxes, totals) from backend data. Any client-submitted price or item overrides are ignored.
- Response (201)
```json
{ "success": true, "data": { "orderId": "ord_01JZ6XZ4R6S7W0" } }
```

- Route: GET /orders/:id
- Controller: getOrderById(req, res)
- Response (200)
```json
{ "success": true, "data": { "order": { /* full Order JSON incl. links */ } } }
```

- Route: PATCH /orders/:id/status
- Controller: updateOrderStatus(req, res)
- Request
```json
{ "status": "CONFIRMED" }
```
- Response (200)
```json
{ "success": true }
```

Invoices
- Route: POST /invoices
- Controller: createInvoice(req, res)
- Request
```json
{ "orderId": "ord_01JZ6XZ4R6S7W0" }
```
- Response (201)
```json
{ "success": true, "data": { "invoiceId": "inv_01JZ6Y0CC5RB2N" } }
```

- Route: GET /invoices/:id
- Controller: getInvoiceById(req, res)
- Response
```json
{ "success": true, "data": { "invoice": { /* full Invoice */ } } }
```

Payments
- Route: POST /payments/initiate
- Controller: initiatePayment(req, res)
- Request
```json
{ "invoiceId": "inv_01JZ6Y0CC5RB2N", "method": "mpesa_stk", "amount": 3300 }
```
- Response (202)
```json
{ "success": true, "data": { "paymentId": "pay_01JZ6Y5W9E2T4Q", "status": "PENDING" } }
```

- Route: GET /payments/:id
- Controller: getPaymentById(req, res)
- Response
```json
{ "success": true, "data": { "payment": { /* full Payment */ } } }
```

- Route: PATCH /payments/:id/cash
- Controller: markCashCollected(req, res)
- Request
```json
{ "amount": 3300 }
```
- Response
```json
{ "success": true }
```

Receipts
- Route: POST /receipts
- Controller: createReceipt(req, res)
- Request
```json
{ "invoiceId": "inv_01JZ6Y0CC5RB2N" }
```
- Response (201)
```json
{ "success": true, "data": { "receiptId": "rcp_01JZ6YDTBTV28C" } }
```

Delivery (optional)
- Route: PATCH /orders/:id/assign-rider
- Controller: assignRider(req, res)
- Request
```json
{ "riderId": "rider_01JZ7001WQ9ZTP" }
```
- Response
```json
{ "success": true }
```

### Webhooks (Daraja, Paystack)

Daraja (MPesa STK) webhook (example)
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_03092024101526212",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 3300 },
          { "Name": "MpesaReceiptNumber", "Value": "QBC2V8R8D1" },
          { "Name": "TransactionDate", "Value": 20250910101530 },
          { "Name": "PhoneNumber", "Value": 254712345678 }
        ]
      }
    }
  }
}
```
Mapping logic (controller):
- Find Payment by `CheckoutRequestID`
- If `ResultCode == 0` → Payment SUCCESS; update Invoice to PAID; create Receipt; update Order.paymentStatus → PAID; emit events
- Else → Payment FAILED; emit events

Paystack webhook (example)
```json
{
  "event": "charge.success",
  "data": {
    "id": 1234567,
    "amount": 330000, // in kobo
    "currency": "KES",
    "reference": "PSK-REF-123",
    "status": "success",
    "customer": { "email": "customer@example.com" }
  }
}
```
Mapping logic (controller):
- Find Payment by `reference`
- On success: Payment SUCCESS → Invoice PAID → Receipt → Order.paymentStatus PAID → emit events

### WebSocket Events (payloads)
```json
// order.created
{ "orderId": "ord_01JZ6XZ4R6S7W0" }

// order.updated
{ "orderId": "ord_01JZ6XZ4R6S7W0", "status": "CONFIRMED" }

// invoice.created
{ "invoiceId": "inv_01JZ6Y0CC5RB2N", "orderId": "ord_01JZ6XZ4R6S7W0" }

// payment.updated
{ "paymentId": "pay_01JZ6Y5W9E2T4Q", "status": "SUCCESS" }

// receipt.created
{ "receiptId": "rcp_01JZ6YDTBTV28C", "orderId": "ord_01JZ6XZ4R6S7W0" }

// notification.new
{ "notificationId": "ntf_01JZ6YQ8DQBQ6E" }
```

### End-to-end sequences

Pay Now (Daraja STK)
1) POST /orders → orderId
2) POST /invoices { orderId } → invoiceId
3) POST /payments/initiate { invoiceId, method: mpesa_stk, amount } → paymentId (PENDING)
4) Daraja webhook → SUCCESS → server updates Payment/Invoice/Order; emits events
5) POST /receipts { invoiceId } (optional if created by webhook logic) → receiptId

Post to Bill (in_shop)
1) POST /orders → orderId (paymentPreference: post_to_bill)
2) POST /invoices → invoice OPEN
3) Later settlement via cash or online → mark paid → receipt → events

