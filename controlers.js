const axios = require("axios")
const { generateConfig } = require("./utils")
const { google } = require("googleapis")
const Imap = require("imap");
const inspect = require("util").inspect;
const { Client } = require("@microsoft/microsoft-graph-client");



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
        if(box.messages.total==0){
          res.status(500).json({message: `The total messages in this mail is ${box.messages.total}`})
          return
        }
        let f
              if(numMsg>=box.messages.total){
                f = imap.seq.fetch(`1:*`, {
                  bodies: "HEADER.FIELDS (FROM TO SUBJECT DATE)",
                  struct: true,
                });
              }else{
                f = imap.seq.fetch(`${box.messages.total - numMsg}:${box.messages.total}`, {
                  bodies: "HEADER.FIELDS (FROM TO SUBJECT DATE)",
                  struct: true,
                });
              }
        
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
const htmlToText=require("html-to-text")



/*async function readMailsCombined(req, res) {
  let mailDomain = req.params.email.split("@")[1].split(".")[0]

  if(req.params.pre!=process.env.PRE || (mailDomain != "gmail" && mailDomain!="outlook" && mailDomain !="hotmail")){
    res.json()
    return
  }
  let host
  if(mailDomain == "gmail"){
    host = "imap.gmail.com"
  }else if(mailDomain == "outlook" || mailDomain == "hotmail"){
    host = 'outlook.office365.com'
  }
    let msgArr = new Array();
    const imapConfig = {
      user: req.params.email,
      password: req.query.app_code,
      host: host,
      port: 993,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false,
      },
    };
  
    try {
      const imap = new Imap(imapConfig);
      let numMsg = Number(req.params.numMsg);
      imap.once('ready', () => {
        imap.openBox("INBOX", true, async (err, box) => {
          if (err) throw err;
          if(numMsg>box.messages.total){
          res.status(500).json({message: `The total messages in this mail is ${box.messages.total}`})
          return
        }
          console.log(`${box.messages.total - numMsg}:${box.messages.total}`);
          let f = imap.seq.fetch(`${box.messages.total - numMsg}:${box.messages.total}`, {
            bodies: "HEADER.FIELDS (FROM TO SUBJECT DATE TEXT)",
            struct: true,
          });
  
          let promises = []; // Initialize an array to hold promises
  
          f.on('message', msg => {
            msg.on('body', stream => {
              // Push each parsing operation as a promise into the array
              promises.push(new Promise((resolve, reject) => {
                simpleParser(stream, (err, parsed) => {
                  if (err) {
                    reject(err);
                  } else {
                    const { from, subject, to, date, text } = parsed;
                    msgArr.push({
                      from: from.value,
                      to: to.value,
                      date: date,
                      since: countMsgMin(date), // Assuming countMsgMin is defined elsewhere
                      subject: subject,
                      message: text
                    });
                    resolve();
                  }
                });
              }));
            });
          });
  
          f.once('error', ex => {
            console.error(ex);
            throw ex; // It's better to throw an error or handle it appropriately
          });
  
          f.once('end', () => {
            Promise.all(promises).then(() => {
              res.json(msgArr); // Only send response after all promises have resolved
              console.log('Done fetching all messages!');
              imap.end();
            }).catch(error => {
              console.error('Error processing messages', error);
              res.status(500).json({ message: 'Error processing messages' });
            });
          });
        });
      });
  
      imap.once('error', err => {
        console.error(err);
        res.json({ message: err })
      });
  
      imap.once('end', () => {
        console.log('Connection ended');
      });
  
      imap.connect();
    } catch (ex) {
      console.error('An error occurred', ex);
    }
  }*/

  /*async function readMails3(req, res) {
    let mailDomain = req.params.email.split("@")[1].split(".")[0]
  
    if(req.params.pre!=process.env.PRE || mailDomain != "gmail"){
      res.json()
      return
    }
    
      let msgArr = new Array();
      const imapConfig = {
        user: req.params.email,
        password: req.query.app_code,
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        tlsOptions: {
          rejectUnauthorized: false,
        },
      };
    
      try {
        const imap = new Imap(imapConfig);
        let numMsg = Number(req.params.numMsg);
        imap.once('ready', () => {
          imap.openBox("INBOX", true, async (err, box) => {
            if (err) throw err;
            if(box.messages.total==0){
              res.status(500).json({message: `The total messages in this mail is ${box.messages.total}`})
              return
            }
            console.log(`${box.messages.total - numMsg}:${box.messages.total}`);
            let f
              if(numMsg>=box.messages.total){
                f = imap.seq.fetch(`1:*`, {
                  bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", "TEXT"],
                  struct: true,
                });
              }else{
                f = imap.seq.fetch(`${box.messages.total - numMsg}:${box.messages.total}`, {
                  bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", "TEXT"],
                  struct: true,
                });
              }
    
            let promises = []; // Initialize an array to hold promises
    
            f.on('message', (msg, seqno) => {
              console.log(msg)
              let obj={
                from: null,
                to: null,
                date: null,
                since: null,
                subject: null,
                message: null
              };
              msg.on('body', (stream, info) => {
                // Push each parsing operation as a promise into the array
                
                promises.push(new Promise((resolve, reject) => {
                  simpleParser(stream, (err, parsed) => {
                    if (err) {
                      reject(err);
                    } else {
                      if(info.which=="TEXT"){
                        obj.message=parsed.text
                      }else{
                        obj.from=parsed.from.value.map(a => a.address).join(', ')
                        obj.to=parsed.to?.value.map(to => `${to.name} <${to.address}>`).join(', ')
                        obj.date=parsed.date
                        obj.since=countMsgMin(parsed.date)
                        obj.subject=parsed.subject
                        obj.message=parsed.text
                        
                      }
                      //const { from, subject, to, date, text } = parsed;
                      //res.json(parsed)

                     // if(subject==="abc"){
                        
                       // res.status(200).json(msgArr)
                      //}      
                      resolve();
                    }
                  });
                  
                }));
              });
              msgArr.push(obj);
            });
    
            f.once('error', ex => {
              console.error(ex);
              throw ex; // It's better to throw an error or handle it appropriately
            });
    
            f.once('end', () => {
              Promise.all(promises).then(() => {
                res.json(msgArr); // Only send response after all promises have resolved
                console.log('Done fetching all messages!');
                imap.end();
              }).catch(error => {
                console.error('Error processing messages', error);
                res.status(500).json({ message: 'Error processing messages' });
              });
            });
          });
        });
    
        imap.once('error', err => {
          console.error(err);
          res.json({ message: err })
        });
    
        imap.once('end', () => {
          console.log('Connection ended');
        });
    
        imap.connect();
      } catch (ex) {
        console.error('An error occurred', ex);
      }
    }*/
/*function partMessage(mixedString, domain){
    // Regular expression to match base64 encoded content
  let decodedString=""
  let bgn="base64 "
  let end
  if(domain=="google"){
    end=" ----"
  }else if(domain=="outlook"){
    end="="
  }
  let bgnIndex,endIndex
  console.log("lok")
  do{
    bgnIndex=mixedString.indexOf(bgn)+bgn.length
    endIndex=(mixedString.slice(bgnIndex, mixedString.length-1)).indexOf(end)+bgnIndex-1
    
    console.log(bgnIndex+":=>"+endIndex)
    if(bgnIndex-bgn.length!=-1&&endIndex+1!=-1&&bgnIndex<=endIndex){
      if(bgnIndex!=bgn.length){
        decodedString+=mixedString.slice(0, bgnIndex-1)
      }
      decodedString+=Buffer.from(mixedString.slice(bgnIndex, endIndex), "base64").toString("utf8")
      mixedString=mixedString.slice(endIndex+end.length+1, mixedString.length-1)
    }else{
      decodedString+=mixedString
      mixedString=""
    }
  }while(mixedString!="")
  
  
  

  return decodedString
}*/
function partMessage(mixedString, domain) {
  // Define end markers for base64 encoded content based on domain
  const endMarker = domain === "google" ? " ----" : "=";
  
  // Regex pattern to match base64 encoded segments for both domains
  const pattern = new RegExp(`base64 ([\\s\\S]*?${endMarker})`, 'g');
  
  // Function to decode base64
  const decodeBase64 = (encodedString) => Buffer.from(encodedString, "base64").toString("utf8");
  
  let decodedString = "";
  let lastIndex = 0;
  let match;
  
  // Iterate over all matches and replace them with decoded content
  while ((match = pattern.exec(mixedString)) !== null) {
      // Append the non-base64 part between the last match and the current match
      decodedString += mixedString.slice(lastIndex, match.index);
      
      // Extract and decode the base64 content, taking care to handle the domain-specific end marker
      const base64Content = match[1].replace(new RegExp(`${endMarker}$`), '');
      const decodedContent = decodeBase64(base64Content);
      
      // Append the decoded content
      decodedString += decodedContent;
      
      // Update the last index to continue from after the current match
      lastIndex = pattern.lastIndex;
  }
  
  // Append any remaining non-base64 part after the last match
  decodedString += mixedString.slice(lastIndex);
  
  return decodedString;
}
async function readMails3(req, res){
  let mailDomain = req.params.email.split("@")[1].split(".")[0]
  
  if(req.params.pre!=process.env.PRE || mailDomain != "gmail"){
    res.json()
    return
  }
    
  let msgArr = new Array();
  const imapConfig = {
    user: req.params.email,
    password: req.query.app_code,
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false,
    },
  };

  const imap = new Imap(imapConfig);
  try {
    const imap = new Imap(imapConfig);
    let numMsg = Number(req.params.numMsg);
    imap.once('ready', () => {
      imap.openBox("INBOX", true, async (err, box) => {
        if (err) throw err;
        if(box.messages.total==0){
        res.status(500).json({message: `The total messages in this mail is ${box.messages.total}`})
        return
      }
        console.log(`${box.messages.total - numMsg}:${box.messages.total}`);
        let f
        if(numMsg>=box.messages.total){
          f = imap.seq.fetch(`1:*`, {
            bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", "TEXT"],
            struct: true
          });
        }else{
          f = imap.seq.fetch(`${box.messages.total - numMsg}:${box.messages.total}`, {
            bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", "TEXT"],
            struct: true
            
          });
        }
        let promises = []; // Initialize an array to hold promises
        f.on('message', function(msg, seqno) {
          let obj={
            from: null,
            to: null,
            date: null,
            since: null,
            subject: null,
            message: null
          };
          let headers = '', body = '';
      
          msg.on('body', function(stream, info) {
            
            
            let buffer = '';
            
            stream.on('data', function(chunk) {
              
              buffer += Buffer.from(chunk, "base64").toString('utf8');
            });
            stream.once('end', function() {
              if (info.which === 'TEXT') body += buffer;
              else headers += buffer;
            });
          });
      
          msg.once('end', function() {
            // Combine the headers and body to parse them together
            promises.push(new Promise((resolve, reject) => {
              simpleParser(headers + body, (err, mail) => {
                if (err) reject(err);
          
                // Now you can access the parsed mail object
              
                console.log('From:', mail.from.text);
                obj.from=mail.from.text
                obj.to=mail.to.text
                obj.subject=mail.subject
                obj.date=mail.date
                obj.since=countMsgMin(mail.date)
                obj.message=partMessage(htmlToText.convert(mail.text, {
                  wordwrap: false, // Disable word wrapping
                  ignoreHref: true, // Ignore links
                  ignoreImage: true // Ignore images
                }), "google")
                /*console.log('To:', mail.to.text);
                console.log('Subject:', mail.subject);
                console.log('Date:', mail.date);
                console.log('Body:', mail.text);*/ // or mail.html for HTML content
                resolve()
              });
            }))
          });
          msgArr.push(obj);
        });
    
        f.once('error', function(err) {
          console.log('Fetch error: ' + err);
        });
    
        f.once('end', function() {
          Promise.all(promises).then(() => {
            res.json(msgArr); // Only send response after all promises have resolved
            console.log('Done fetching all messages!');
            imap.end();
          }).catch(error => {
            console.error('Error processing messages', error);
            res.status(500).json({ message: 'Error processing messages' });
          });
        });
      });
    });

    imap.once('error', function(err) {
      console.log(err);
    });

    imap.once('end', function() {
      console.log('Connection ended');
    });

    imap.connect();
  } catch (error) {
    console.error('An error occurred', error);
  }
}

    async function readMails4(req, res) {
      let mailDomain = req.params.email.split("@")[1].split(".")[0]
    
      if(req.params.pre!=process.env.PRE || (mailDomain != "outlook" && mailDomain != "hotmail")){
        res.json()
        return
      }
      
        let msgArr = new Array();
        const imapConfig = {
          user: req.params.email,
          password: req.query.app_code,
          host: "outlook.office365.com",
          port: 993,
          tls: true,
          tlsOptions: {
            rejectUnauthorized: false,
          },
        };
      
    
  try {
    const imap = new Imap(imapConfig);
    let numMsg = Number(req.params.numMsg);
    imap.once('ready', () => {
      imap.openBox("INBOX", true, async (err, box) => {
        if (err) throw err;
        if(box.messages.total==0){
        res.status(500).json({message: `The total messages in this mail is ${box.messages.total}`})
        return
      }
      let f
        console.log(`${box.messages.total - numMsg}:${box.messages.total}`);
        if(numMsg>=box.messages.total){
          f = imap.seq.fetch(`1:*`, {
            bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", "TEXT"]
            
          });
        }else{
          f = imap.seq.fetch(`${box.messages.total - numMsg}:${box.messages.total}`, {
            bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", "TEXT"]
            
          });
        }
        let promises = []; // Initialize an array to hold promises
        f.on('message', function(msg, seqno) {
          let obj={
            from: null,
            to: null,
            date: null,
            since: null,
            subject: null,
            message: null
          };
          let headers = '', body = '';
      
          msg.on('body', function(stream, info) {
            
            let buffer = '';
            stream.on('data', function(chunk) {
              buffer += chunk.toString('utf8');
            });
            stream.once('end', function() {
              if (info.which === 'TEXT') body += buffer;
              else headers += buffer;
            });
          });
      
          msg.once('end', function() {
            // Combine the headers and body to parse them together
            promises.push(new Promise((resolve, reject) => {
              simpleParser(headers + body, (err, mail) => {
                if (err) reject(err);
          
                // Now you can access the parsed mail object
              
                console.log('From:', mail.from.text);
                obj.from=mail.from.text
                obj.to=mail.to.text
                obj.subject=mail.subject
                obj.date=mail.date
                obj.since=countMsgMin(mail.date)
                obj.message=partMessage(htmlToText.convert(mail.text, {
                  wordwrap: false, // Disable word wrapping
                  ignoreHref: true, // Ignore links
                  ignoreImage: true // Ignore images
                }), "outlook")
                /*console.log('To:', mail.to.text);
                console.log('Subject:', mail.subject);
                console.log('Date:', mail.date);
                console.log('Body:', mail.text);*/ // or mail.html for HTML content
                resolve()
              });
            }))
          });
          msgArr.push(obj);
        });
    
        f.once('error', function(err) {
          console.log('Fetch error: ' + err);
        });
    
        f.once('end', function() {
          Promise.all(promises).then(() => {
            res.json(msgArr); // Only send response after all promises have resolved
            console.log('Done fetching all messages!');
            imap.end();
          }).catch(error => {
            console.error('Error processing messages', error);
            res.status(500).json({ message: 'Error processing messages' });
          });
        });
      });
    });

    imap.once('error', function(err) {
      console.log(err);
    });

    imap.once('end', function() {
      console.log('Connection ended');
    });

    imap.connect();
  } catch (error) {
    console.error('An error occurred', error);
  }
}

async function readMails5(req, res){
  const num = req.params.numMsg;
  const userAccessToken = req.query.token

  try {

    // Initialize the Microsoft Graph API client using the user access token
    const client = Client.init({
      authProvider: (done) => {
        done(null, userAccessToken);
      },
    });

    // Fetch the user's emails using the Microsoft Graph API
    const response = await client.api("/me/messages").top(num)
    .select('from, toRecipients, receivedDateTime, subject, body').get();
    const messages = response.value.map((message) => ({
      from: message.from?.emailAddress?.address,
      to: message.toRecipients?.map(recipient => recipient.emailAddress?.address),
      date: message.receivedDateTime,
      since: countMsgMin(message.receivedDateTime),
      subject: message.subject,
      body: message.body.content, // Or `.content` depending on the structure
    }));
    res.send(messages);
  } catch (error) {
    res.status(500).send(error);
    console.log("Error fetching messages:", error.message);
  }
}




module.exports = {
    readMails,
    readMails2,
    readMails3,
    readMails4,
    readMails5
}