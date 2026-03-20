import axios from "axios"

const getBaseUrl = () => {
  const env = (
    process.env.MPESA_ENV || 
    'sandbox'
  ).toLowerCase()
  return env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'
}

// Create axios instance with proper headers to bypass Incapsula WAF
const createAxiosInstance = () => {
  return axios.create({
    timeout: 30000, // 30 seconds timeout
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json'
    }
  });
};

// Retry logic with exponential backoff
const retryRequest = async (
  requestFn,
  maxRetries = 3,
  baseDelay = 1000
) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on 4xx errors (except 429 rate limit)
      if (error?.response?.status && 
          error.response.status >= 400 && 
          error.response.status < 500 && 
          error.response.status !== 429) {
        throw error;
      }
      
      // If it's the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Daraja request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

export const getAccessToken = async () => {
  const consumerKey = (process.env.MPESA_CONSUMER_KEY || '').trim()
  const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || '').trim()

  if (!consumerKey || !consumerSecret) {
    throw new Error('Daraja credentials not configured: Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET')
  }

  const base = getBaseUrl()
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
  const axiosInstance = createAxiosInstance()

  try {
    const response = await retryRequest(async () => {
      return await axiosInstance.get(
        `${base}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${auth}` } }
      )
    })

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

export const initiateStkPush = async (params) => {
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

  const callback = `${process.env.CALLBACK_URL || ''}/api/payments/webhooks/mpesa`

  console.log('callback', callback)
  
  const payload = {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(params.amount),
    PartyA: params.phone,
    PartyB: Number(partyB),
    PhoneNumber: params.phone,
    CallBackURL: callback,
    AccountReference: "TEO-KICKS",
    TransactionDesc: 'Invoice payment'
  }

  const axiosInstance = createAxiosInstance()

  try {
    const resp = await retryRequest(async () => {
      return await axiosInstance.post(
        `${base}/mpesa/stkpush/v1/processrequest`, 
        payload, 
        {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
    })

    return {
      merchantRequestId: resp.data?.MerchantRequestID,
      checkoutRequestId: resp.data?.CheckoutRequestID,
      raw: resp.data
    }
  } catch (err) {
    const status = err?.response?.status
    const data = err?.response?.data
    const message = `Daraja STK Push failed${status ? ` (HTTP ${status})` : ''}`
    const details = typeof data === 'object' ? JSON.stringify(data) : (data || err.message)
    throw new Error(`${message}: ${details}`)
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
export const queryStkPushStatus = async (params) => {
  const resolvedShortCode = (params.shortCode || process.env.MPESA_SHORT_CODE || '').trim()
  const resolvedPasskey = (params.passkey || process.env.MPESA_PASSKEY || '').trim()

  if (!resolvedShortCode || !resolvedPasskey) {
    throw new Error('Daraja short code or passkey not configured')
  }

  const accessToken = await getAccessToken()
  const base = getBaseUrl()
  const timestamp = buildTimestamp()
  const password = buildPassword(resolvedShortCode, resolvedPasskey, timestamp)

  const axiosInstance = createAxiosInstance()

  try {
    const resp = await retryRequest(async () => {
      return await axiosInstance.post(
        `${base}/mpesa/stkpushquery/v1/query`,
        {
          BusinessShortCode: Number(resolvedShortCode),
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: params.checkoutRequestId
        },
        { 
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          } 
        }
      )
    })

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
