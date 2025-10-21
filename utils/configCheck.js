// Configuration check utility


// Check email configuration
export const checkEmailConfig = () => {

    const emailConfig = {
        configured: false,
        missing: []
    }

    const requiredVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']

    requiredVars.forEach(varName => {

        if (!process.env[varName] || process.env[varName] === '') {

            emailConfig.missing.push(varName)

        }

    })

    emailConfig.configured = emailConfig.missing.length === 0

    return emailConfig

}


// Check SMS configuration
export const checkSMSConfig = () => {

    const smsConfig = {
        configured: false,
        missing: []
    }

    const requiredVars = ['AT_API_KEY', 'AT_USERNAME']

    requiredVars.forEach(varName => {

        if (!process.env[varName] || 
            process.env[varName] === '' || 
            process.env[varName] === `your-africastalking-${varName.toLowerCase().replace('at_', '')}`) {

            smsConfig.missing.push(varName)

        }

    })

    smsConfig.configured = smsConfig.missing.length === 0

    return smsConfig

}


// Get overall configuration status
export const getConfigStatus = () => {

    const email = checkEmailConfig()

    const sms = checkSMSConfig()

    return {
        email: email,
        sms: sms,
        summary: {
            emailReady: email.configured,
            smsReady: sms.configured,
            hasAtLeastOne: email.configured || sms.configured
        }
    }

}


// Log configuration status
export const logConfigStatus = () => {

    console.log('\n🔧 TEO KICKS Configuration Status:')

    const status = getConfigStatus()

    console.log(`📧 Email Service: ${status.email.configured ? '✅ Ready' : '❌ Not Configured'}`)

    if (!status.email.configured) {

        console.log(`   Missing: ${status.email.missing.join(', ')}`)

    }

    console.log(`📱 SMS Service: ${status.sms.configured ? '✅ Ready' : '❌ Not Configured'}`)

    if (!status.sms.configured) {

        console.log(`   Missing: ${status.sms.missing.join(', ')}`)

    }

    if (status.summary.hasAtLeastOne) {

        console.log('✅ At least one notification method is available')

    } else {

        console.log('⚠️  No notification methods configured - OTP delivery will fail')

    }

    console.log('')

}