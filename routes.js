const express = require("express")
const controlers = require("./controlers")
const router = express.Router()


router.get("/emails/:numMsg/:email/:client_id/:client_secret", controlers.readMails)

module.exports = router