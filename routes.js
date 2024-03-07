const express = require("express")
const controlers = require("./controlers")
const router = express.Router()


router.get("/emails/:email", controlers.readMails)

module.exports = router