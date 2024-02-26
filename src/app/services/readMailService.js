const axios = require("axios");
const qs = require("qs");
const fs = require('fs');
require('dotenv').config();


class gmailService {
    async getAccessToken() {
        var data = qs.stringify({
            client_id:
                process.env.GMAIL_API_CREDENTIALS_CLIENT_ID,
            client_secret: process.env.GMAIL_API_CREDENTIALS_CLIENT_SECRET,
            refresh_token:
                process.env.GMAIL_API_CREDENTIALS_REFRESH_TOKEN,
            grant_type: "refresh_token",
        });
        var config = {
            method: "post",
            url: "https://accounts.google.com/o/oauth2/token",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data: data,
        };

        let accessToken = "";

        await axios(config)
            .then(async function (response) {
                accessToken = await response.data.access_token;                
            })
            .catch(function (error) {
                console.log(error);
            });

        return accessToken;
    }

    async searchGmail(contractId) {
        const searchQuery = `subject:${contractId}`
        var config1 = {
            method: "get",
            url: `https://www.googleapis.com/gmail/v1/users/me/messages?q=${searchQuery}`,
            headers: {
                Authorization: `Bearer ${await this.getAccessToken()} `,
            },
        };
        var threadId = "";
        try {
            const response = await axios(config1)
            let array = [];
            for (let i = 0; i < response.data["messages"].length; i++) {
                threadId = response.data["messages"][i].id;
                array.push(threadId);
            }
            console.log(array)
            return array;
        }
        catch {
            console.error('Error searching gmail content', error);
            throw error;
        }
    }

    async readGmailContent(messageId) {
        var config = {
            method: "get",
            url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
            headers: {
                Authorization: `Bearer ${await this.getAccessToken()}`,
            },
        };

        var data = [];
        try {
            const response = await axios(config)
            data = response.data;
            return data;
        }
        catch {
            console.error('Error fetching gmail content:', error);
            throw error;
        }
    }

    async getAttachment(attachmentId) {
        const config = {
            method: 'get',
            url: `https://www.googleapis.com/gmail/v1/users/me/messages/${attachmentId}/attachments/${attachmentId}`,
            headers: {
                Authorization: `Bearer ${await this.getAccessToken()}`,
            },
        };
        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            console.error('Error fetching attachment:', error);
            throw error;
        }
    }

    async readInboxContent(searchText) {
        let threadId = []
        threadId = await this.searchGmail(searchText);
        let arr = [];
        for (let d = 0; d < threadId.length; d++) {
            const message = await this.readGmailContent(threadId[d]);
            arr.push(message)
        }
        let arr1 = [];
        for (let k = 0; k < arr.length; k++) {
            const bodyPart = arr[k].payload.parts;
            for (let l = 0; l < bodyPart.length; l++) {
                if (bodyPart[l] && bodyPart[l].mimeType === 'text/html' && bodyPart[l].body && bodyPart[l].body.data) {
                    console.log("hello")
                    const encodedMessage = bodyPart[l].body.data;
                    const decodedStr = Buffer.from(encodedMessage, "base64").toString("ascii");
                    arr1.push(decodedStr)
                    console.log("decoded str", decodedStr);
                }
                if (bodyPart[l] && bodyPart[l].mimeType === 'text/plain' && bodyPart[l].body && bodyPart[l].body.data) {
                    console.log("hello")
                    const encodedMessage = bodyPart[l].body.data;
                    const decodedStr = Buffer.from(encodedMessage, "base64").toString("ascii");
                    arr1.push(decodedStr)
                    console.log("decoded str", decodedStr);
                }
                if (bodyPart[l] && bodyPart[l].mimeType === 'application/pdf' && bodyPart[l].body && bodyPart[l].body.attachmentId) {
                    console.log("hbewicnd")
                    const attachmentId = bodyPart[l].body.attachmentId;
                    console.log("attachmentId", attachmentId)
                    const attachmentData = await this.getAttachment(attachmentId);
                    console.log("attachement data", attachmentData)
                    const binaryData = Buffer.from(attachmentData.data, 'base64');

                    const filePath = '../saved-files.pdf';

                    fs.writeFileSync(filePath, binaryData);

                    console.log('PDF saved at:', filePath);
                    arr1.push(filePath);
                }
                if (bodyPart[l] && bodyPart[l].mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && bodyPart[l].body && bodyPart[l].body.attachmentId) {
                    console.log("hbewicnd")
                    const encodedMessage = bodyPart[l].body.attachmentId;
                    const decodedStr = Buffer.from(encodedMessage, "base64").toString("ascii");
                    arr1.push(decodedStr)
                }
                if (bodyPart[l] && bodyPart[l].mimeType === 'multipart/alternative' && bodyPart[l].body) {
                    console.log("giu,kbh")
                    for (let k = 0; k < bodyPart[l].parts.length; k++) {
                        if (bodyPart[l] && bodyPart[l].parts[k].mimeType === 'text/html' && bodyPart[l].parts[k].body && bodyPart[l].parts[k].body.data) {
                            console.log("hbuvbhwckdh")
                            const encodedMessage = bodyPart[l].parts[k].body.data;
                            const decodedStr = Buffer.from(encodedMessage, "base64").toString("ascii");
                            console.log("decoded str", decodedStr)
                            arr1.push(decodedStr)
                        }
                        else
                            continue;
                    }
                }
            }
        }
        return arr1;
    }

}

module.exports = new gmailService();