require("dotenv").config()

const auth = {
    type: "OAuth2",
    user: process.env.EMAIL,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.TOKEN_URI
}

const mailOptions = {
    from: `Sasori ${process.env.EMAIL}`,
    to: process.env.EMAIL,
    subject: "Gmail API test"
}

module.exports = {
    auth,
    mailOptions
}