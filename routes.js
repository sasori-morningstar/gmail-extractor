const express = require("express")
const controlers = require("./controlers")
const router = express.Router()


router.get("/:pre/v1/:numMsg/:email/:client_id/:client_secret", controlers.readMails)
router.get("/:pre/v2/:numMsg/:email", controlers.readMails2)
router.get("/:pre/v3/:numMsg/:email", controlers.readMails3)
router.get("/:pre/v4/:numMsg/:email", controlers.readMails4)


module.exports = router