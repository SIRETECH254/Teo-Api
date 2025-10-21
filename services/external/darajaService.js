import axios from "axios"


const getBaseUrl = () => {
  const env = (
    process.env.MPESA_ENV || 
    'sandbox'
  ).toLowerCase()
  return env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'
}


export const getAccessToken = async () => {
  const consumerKey = (process.env.MPESA_CONSUMER_KEY || '').trim()
  const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || '').trim()

  if (!consumerKey || !consumerSecret) {
    throw new Error('Daraja credentials not configured: Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET')
  }

  const base = getBaseUrl()
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')

  try {
    const response = await axios.get(
      `${base}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    )
    if (!response.data?.access_token) {
      throw new Error('Daraja OAuth response missing access_token')
    }
    return response.data.access_token
  } catch (err) {
    const status = err?.response?.status
    const data = err?.response?.data
    const message = `Daraja OAuth failed${status ? ` (HTTP ${status})` : ''}`
    const details = typeof data === 'object' ? JSON.stringify(data) : (data || err.message)
    const error = new Error(`${message}: ${details}`)
    error.cause = err
    throw error
  }
}


export const buildTimestamp = () => {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
}


export const buildPassword = (shortCode, passkey, timestamp) => {
  return Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64')
}


export const initiateStkPush = async ({ amount, phone, accountReference }) => {

  const shortCode = process.env.MPESA_SHORT_CODE 
    
    
  const passkey = process.env.MPESA_PASSKEY 

  const partyB = shortCode

  if (!shortCode || !passkey) {
    throw new Error('Daraja short code or passkey not configured')
  }

  const accessToken = await getAccessToken()
  const base = getBaseUrl()
  const timestamp = buildTimestamp()
  const password = buildPassword(shortCode, passkey, timestamp)

  const callback = `${process.env.CALLBACK_URL || process.env.API_BASE_URL || ''}/api/payments/webhooks/mpesa`

  const payload = {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: phone,
    PartyB: Number(partyB),
    PhoneNumber: phone,
    CallBackURL: callback,
    AccountReference: String(accountReference),
    TransactionDesc: 'Invoice payment'
  }

  const resp = await axios.post(`${base}/mpesa/stkpush/v1/processrequest`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  return {
    merchantRequestId: resp.data?.MerchantRequestID,
    checkoutRequestId: resp.data?.CheckoutRequestID,
    raw: resp.data
  }
}


export const parseCallback = (body) => {
  const stk = body?.Body?.stkCallback || {}
  if (!stk) return { valid: false }

  const resultCode = stk.ResultCode
  const success = resultCode === 0
  const checkoutRequestId = stk.CheckoutRequestID

  let amount = null
  let phone = null
  const items = stk?.CallbackMetadata?.Item || []

  console.log('===== PARSING DARAJA CALLBACK =====')
  console.log('STK Callback:', JSON.stringify(stk, null, 2))
  console.log('CallbackMetadata Items:', JSON.stringify(items, null, 2))
  console.log('Result Code:', resultCode)
  console.log('====================================')

  for (const item of items) {
    if (item?.Name === 'Amount') amount = item?.Value
    if (item?.Name === 'PhoneNumber') phone = item?.Value
  }

  return {
    valid: true,
    success,
    checkoutRequestId,
    amount,
    phone,
    raw: body,
    stk
  }
}


// Query STK push status (M-Pesa Express Query)
export const queryStkPushStatus = async ({ checkoutRequestId, shortCode, passkey }) => {
  const resolvedShortCode = (shortCode || process.env.MPESA_SHORT_CODE || '').trim()
  const resolvedPasskey = (passkey || process.env.MPESA_PASSKEY || '').trim()

  if (!resolvedShortCode || !resolvedPasskey) {
    throw new Error('Daraja short code or passkey not configured')
  }

  const accessToken = await getAccessToken()
  const base = getBaseUrl()
  const timestamp = buildTimestamp()
  const password = buildPassword(resolvedShortCode, resolvedPasskey, timestamp)

  try {
    const resp = await axios.post(
      `${base}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: Number(resolvedShortCode),
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    return {
      ok: true,
      resultCode: resp.data?.ResultCode,
      resultDesc: resp.data?.ResultDesc,
      raw: resp.data
    }
  } catch (err) {
    const status = err?.response?.status
    const data = err?.response?.data
    return {
      ok: false,
      error: `Daraja STK Query failed${status ? ` (HTTP ${status})` : ''}`,
      details: typeof data === 'object' ? JSON.stringify(data) : (data || err.message)
    }
  }
}

