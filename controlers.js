const axios = require("axios")
const { generateConfig } = require("./utils")
const nodemailer = require("nodemailer")
const CONSTANTS = require("./constants")
const { google } = require("googleapis")

require("dotenv").config()

const oAuth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URIS
)

oAuth2Client.setCredentials({refresh_token: process.env.TOKEN_URI})

function getHeader(messageHeaders, header){
    j=0;
    found=false
    while(!found){
        if(messageHeaders[j].name==header) return messageHeaders[j].value
        j++
    }
}

async function getEmail(message, token){
    let url2 = `https://gmail.googleapis.com/gmail/v1/users/${process.env.EMAIL}/messages/${message.id}`
    let config2 = generateConfig(url2, token);
    let response2 = await axios(config2)
    let data2 = await response2.data
    if(data2.payload.parts!==undefined){
        msg = data2.payload.parts[0].body.data
    }else{
        msg = ""
    }
    let email = {
        Subject: getHeader(data2.payload.headers, "Subject"),
        From: getHeader(data2.payload.headers, "From"),
        To: getHeader(data2.payload.headers, "To"),
        Date: getHeader(data2.payload.headers, "Date"),
        Message: Buffer.from(msg,"base64").toString("ascii")
    }
    return email
}
async function readMails(req, res){
    const url = `https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/messages?maxResults=10`
    const {token} = await oAuth2Client.getAccessToken()
    const config = generateConfig(url, token)
    const messages = await axios(config)
    let readMessages = new Array()

    for(i=0;i<10;i++){
        //console.log(i)
        let message = await getEmail(messages.data.messages[i], token)
        readMessages.push(message)
    }
    
    res.json(readMessages)
}


module.exports = {
    readMails
}