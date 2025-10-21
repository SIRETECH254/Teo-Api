import axios from "axios"


export const initTransaction = async ({ amount, email, reference, callbackUrl, currency = 'KES' }) => {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) throw new Error('Paystack secret not configured')

  const resp = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    {
      email,
      amount: Math.round(amount * 100),
      currency,
      reference,
      callback_url: callbackUrl
    },
    { headers: { Authorization: `Bearer ${secret}` } }
  )

  return {
    authorizationUrl: resp.data?.data?.authorization_url,
    reference: resp.data?.data?.reference,
    raw: resp.data
  }
}


export const parseWebhook = (body) => {
  const event = body?.event
  const reference = body?.data?.reference
  const status = body?.data?.status
  const success = event === 'charge.success' || status === 'success'
  return {
    valid: !!reference,
    success,
    reference,
    raw: body
  }
}

