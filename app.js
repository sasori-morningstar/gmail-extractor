const express = require("express")
const routes = require("./routes")

require("dotenv").config()

const app = express()

app.listen(process.env.PORT, () => {
    console.log("Listening on port " + process.env.PORT)
})

app.use("/api", routes)

app.get("/", async (req, res) => {
    res.status(200)
    res.send("Welcome to your email visualiser")
})

