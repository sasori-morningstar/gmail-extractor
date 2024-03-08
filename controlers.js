const axios = require("axios")
const { generateConfig } = require("./utils")
const { google } = require("googleapis")
const Imap = require("imap");
const inspect = require("util").inspect;

require("dotenv").config()

/*const oAuth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URIS
)

oAuth2Client.setCredentials({refresh_token: process.env.TOKEN_URI})*/

function getHeader(messageHeaders, header){
    j=0;
    found=false
    while(!found){
        if(messageHeaders[j].name==header) return messageHeaders[j].value
        j++
    }
}

function countMsgMin(date){
    let now = new Date()
    let msDifference = now - new Date(date)    
    let minutes = Math.floor(msDifference / 1000 / 60);
    return minutes
}

async function getEmail(message, token, eml){
    let url2 = `https://gmail.googleapis.com/gmail/v1/users/${eml}/messages/${message.id}`
    let config2 = generateConfig(url2, token);
    let response2 = await axios(config2)
    let data2 = await response2.data
    if(data2.payload.parts!==undefined){
        msg = data2.payload.parts[0].body.data
    }else{
        msg = ""
    }
    let date = getHeader(data2.payload.headers, "Date")
    let email = {
        Subject: getHeader(data2.payload.headers, "Subject"),
        From: getHeader(data2.payload.headers, "From"),
        To: getHeader(data2.payload.headers, "To"),
        Date: date,
        Since: countMsgMin(date),
        Message: Buffer.from(msg,"base64").toString("ascii")
    }
    return email
}
async function readMails(req, res){
  
    const oAuth2Client = new google.auth.OAuth2(
        req.params.client_id,
        req.params.client_secret,
        process.env.REDIRECT_URIS
    )
    oAuth2Client.setCredentials({refresh_token: req.query.refresh_token})
    //console.log(req.query.refresh_token)
    let readMessages = new Array()
  try{
    const url = `https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/messages?maxResults=${req.params.numMsg}`
    const {token} = await oAuth2Client.getAccessToken()
    const config = generateConfig(url, token)
    const messages = await axios(config)
    if(req.params.pre!=process.env.PRE){
      res.json();
      return
    }
    for(i=0;i<req.params.numMsg;i++){
        //console.log(i)
        let message = await getEmail(messages.data.messages[i], token, req.params.email)
        readMessages.push(message)
    }
  }catch(err){
    console.log(err)
    res.json({message: err})
    return
  }
    
    res.json(readMessages)
}



/* V2 */



let imap;
function openInbox(cb) {
   imap.openBox("INBOX", true, cb);
}
async function readMails2(req, res){
  if(req.params.pre!=process.env.PRE){
    res.json()
    return
  }
    imap = new Imap({
        user: req.params.email, ///// 
        password: req.query.app_code, ///////
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        tlsOptions: {
          rejectUnauthorized: false,
        },
    });
    let msgArr = new Array();
    let numMsg = Number(req.params.numMsg)-1
    imap.once("ready", function () {
      openInbox(function (err, box) {
        if (err) throw err;
        let f = imap.seq.fetch(`${box.messages.total - numMsg}:${box.messages.total}`, {
          bodies: "HEADER.FIELDS (FROM TO SUBJECT DATE)",
          struct: true,
        });
        f.on("message", function (msg, seqno) {
          //console.log("Message #%d", seqno);
          let prefix = "(#" + seqno + ") ";
          msg.on("body", function (stream, info) {
            let buffer = "";
            stream.on("data", function (chunk) {
              buffer += chunk.toString("utf8");
            });
            stream.once("end", function () {
              msgArr.push(

                Imap.parseHeader(buffer),
              );
            });
          });
        });
        f.once("error", function (err) {
          console.log("Fetch error: " + err);
        });
        f.once("end", function () {
          console.log("Done fetching all messages!");
          imap.end();
          res.json(msgArr)
        });
      });
    });
    
    imap.once("error", function (err) {
      console.log(err);
      res.json({message: err})
    });
    
    imap.once("end", function () {
      console.log("Connection ended");
    });
    
    imap.connect();
}

/* V3 */
const{simpleParser} = require("mailparser")

async function readMails3(req, res){
  if(req.params.pre!=process.env.PRE){
    res.json()
    return
  }
    let msgArr = new Array()
    const imapConfig = {
      user: req.params.email,
      password: req.query.app_code,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false,
      },
    };
    try{
        const imap = new Imap(imapConfig);
        let numMsg = Number(req.params.numMsg)
        imap.once('ready', () => {
            imap.openBox("INBOX", true, function (err, box) {
                if (err) throw err;
                console.log(`${box.messages.total - numMsg}:${box.messages.total}`)
                let f = imap.seq.fetch(`${box.messages.total - numMsg}:${box.messages.total}`, {
                  bodies: "",
                  struct: true,
                });

              f.on('message', msg => {
                msg.on('body', stream => {
                  simpleParser(stream, async (err, parsed) => {
                    
                    const {from, subject, to, date, text} = parsed
                    
                    msgArr.push({
                        from: from.value,
                        to: to.value,
                        date: date,
                        since: countMsgMin(date),
                        subject: subject,
                        message: text
                    })
                    
                  });
                });
                
              });
              f.once('error', ex => {
                return Promise.reject(ex);
              });
              f.once('end', () => {
                res.json(msgArr)
                console.log('Done fetching all messages!');
                imap.end();
              });
            });
          });
        
    
        imap.once('error', err => {
          console.log(err);
          res.json({message: err})
        });
    
        imap.once('end', () => {
          console.log('Connection ended');
        });
    
        imap.connect();
    } catch (ex) {
      console.log('an error occurred');
    }
}

module.exports = {
    readMails,
    readMails2,
    readMails3
}