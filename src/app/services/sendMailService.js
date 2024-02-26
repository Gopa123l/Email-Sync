const fs = require('fs');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const TOKEN_PATH = 'token.json';
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

async function getOAuthClient() {
    const client_id= process.env.GMAIL_API_CREDENTIALS_CLIENT_ID;
    const client_secret=  process.env.GMAIL_API_CREDENTIALS_CLIENT_SECRET;
    const refresh_token= process.env.GMAIL_API_CREDENTIALS_REFRESH_TOKEN;
    const redirect_uris= process.env.GMAIL_API_CREDENTIALS_REDIRECT_URIS;
    const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris);
    try {
        const token = fs.readFileSync(TOKEN_PATH);
        oAuth2Client.setCredentials(JSON.parse(token));
    } catch (err) {
        await getAccessToken(oAuth2Client);
    }
    return oAuth2Client;
}

async function getAccessToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });

    console.log(`Authorize this app by visiting this URL: ${authUrl}`);
    const code = '4/0AeaYSHCsxOdGmT8-BscEOpnp85rFvOXJ_WQiqwWZcV6xCHyYfLiv4tLxv-7CJtoBosNQcQ&scope=https://mail.google.com/';

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log('Token stored to', TOKEN_PATH);
}

exports.sendEmail= async function (req) {
    const { to, subject, body } = req.body; 
    const attachmentFiles = req.files;
    console.log(attachmentFiles);

    const auth = await getOAuthClient();
    console.log(auth);
    const gmail = google.gmail({ version: 'v1', auth });

    const messageParts = [];
    const message = [];

    messageParts.push(`To: ${to}`);
    messageParts.push(`Subject: ${subject}`);
    messageParts.push('Content-Type: multipart/mixed; boundary="boundary"');
    messageParts.push('');
    messageParts.push('--boundary');
    messageParts.push('Content-Type: text/plain; charset=utf-8');
    messageParts.push('');
    messageParts.push(body);
    messageParts.push('');

    // Loop through each attachment
    if(attachmentFiles){
    for (const attachmentFile of attachmentFiles) {
        const attachmentContent = attachmentFile.buffer.toString('base64');
        messageParts.push('--boundary');
        messageParts.push(`Content-Type: application/octet-stream; name="${attachmentFile.originalname}"`);
        messageParts.push('Content-Transfer-Encoding: base64');
        messageParts.push('Content-Disposition: attachment');
        messageParts.push('');
        messageParts.push(attachmentContent);
        messageParts.push('');
    }
}

    messageParts.push('--boundary--');

    const raw = messageParts.join('\n');
    const gmailMessage = Buffer.from(raw).toString('base64');

    try {
        const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: gmailMessage,
            },
        });
        console.log('Message sent successfully:', response.data);
        return ({ status: true, message: 'Email sent successfully.' });
    } catch (error) {
        console.error('Error sending message:', error.message);
        return({ status: false, message: 'Internal server error.' });
    }
}

exports.sendReplyToThread= async function (req) {
    const  threadId  = req.params.threadId;
    console.log(threadId)
    const { to, subject, body } = req.body;
    const attachmentFiles = req.files;

    const auth = await getOAuthClient();
    const gmail = google.gmail({ version: 'v1', auth });

    const messageParts = [];
    messageParts.push(`To: ${to}`);
    messageParts.push(`Subject: ${subject}`);
    
    // Include the threadId in the References and In-Reply-To headers
    messageParts.push(`References: <${threadId}>`);
    messageParts.push(`In-Reply-To: <${threadId}>`);
    
    messageParts.push('Content-Type: multipart/mixed; boundary="boundary"');
    messageParts.push('');
    messageParts.push('--boundary');
    messageParts.push('Content-Type: text/plain; charset=utf-8');
    messageParts.push('');
    messageParts.push(body);
    messageParts.push('');

    // Loop through each attachment
    for (const attachmentFile of attachmentFiles) {
        const attachmentContent = attachmentFile.buffer.toString('base64');
        messageParts.push('--boundary');
        messageParts.push(`Content-Type: application/octet-stream; name="${attachmentFile.originalname}"`);
        messageParts.push('Content-Transfer-Encoding: base64');
        messageParts.push('Content-Disposition: attachment');
        messageParts.push('');
        messageParts.push(attachmentContent);
        messageParts.push('');
    }

    messageParts.push('--boundary--');
    console.log(messageParts)

    const raw = messageParts.join('\n');
    const gmailMessage = Buffer.from(raw).toString('base64');

    try {
        const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: gmailMessage,
            },
        });
        console.log('Message sent successfully:', response.data);
        return ({ status: true, message: 'Email sent successfully.' });
    } catch (error) {
        console.error('Error sending reply to thread:', error.message);
        throw error;
        
    }
}

