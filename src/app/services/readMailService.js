const axios = require("axios");
const fs = require('fs');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const path = require('path');
const readMailModel = require('../models/readMailModel')
const { globalErrorHandler } = require('../utils/errorHandler');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const s3Service = require('../services/s3Service');
const documentModel = require("../models/documentModel");
const moment = require('moment');
const refreshToken = require('../models/tokenModel');

class gmailService {
    async getOAuthClient() {
        const client_id = process.env.GMAIL_API_CREDENTIALS_CLIENT_ID
        const client_secret = process.env.GMAIL_API_CREDENTIALS_CLIENT_SECRET
        const client_redirect_uris = process.env.GMAIL_API_CREDENTIALS_REDIRECT_URIS
        const oAuth2Client = new OAuth2Client(client_id, client_secret, client_redirect_uris);
        try {         
            const access_token= process.env.GMAIL_API_CREDENTIALS_ACCESS_TOKEN;
            const refresh_token=  process.env.GMAIL_API_CREDENTIALS_REFRESH_TOKEN;
            const expiry_date=  process.env.GMAIL_API_CREDENTIALS_EXPIRY_DATE;
            const token_type=  process.env.GMAIL_API_CREDENTIALS_TOKEN_TYPE;
            const scope=  process.env.GMAIL_API_CREDENTIALS_SCOPE
            oAuth2Client.setCredentials({access_token:access_token, refresh_token: refresh_token,expiry_date: expiry_date, token_type: token_type,scope :scope});                   
            if (!this.isTokenExpired(oAuth2Client.credentials)) {                             
                return oAuth2Client;
            }
                     
            await oAuth2Client.getAccessToken();
            const storedToken = await refreshToken.findOne({ clientId: process.env.GMAIL_API_CREDENTIALS_CLIENT_ID });           
            if (storedToken == null) {                             
                const setToken = new refreshToken({
                    clientId: process.env.GMAIL_API_CREDENTIALS_CLIENT_ID,
                    refreshToken: process.env.GMAIL_API_CREDENTIALS_REFRESH_TOKEN,
                    expiryDate: process.env.GMAIL_API_CREDENTIALS_EXPIRY_DATE,
                    tokenType:process.env.GMAIL_API_CREDENTIALS_TOKEN_TYPE, 
                    scope: process.env.GMAIL_API_CREDENTIALS_SCOPE,
                })
                await setToken.save();                
            } 
            else {
                await oAuth2Client.getAccessToken();
            }
            return oAuth2Client;
        } catch (err) {
            console.error('Error getting OAuth client:', err);
            throw err;
        }
    }
    async isTokenExpired(credentials) {
        return credentials.expiry_date && credentials.expiry_date > Date.now();
    }
    

    async searchGmail(oAuth2Client, contractId) {
        let searchQuery = `subject:${contractId}`;

        const config1 = {
            method: "get",
            url: `https://www.googleapis.com/gmail/v1/users/me/messages?q=${searchQuery}`,
            headers: {
                Authorization: `Bearer ${oAuth2Client.credentials.access_token} `,
            },
        };

        var threadId = "";
        try {
            const response = await axios(config1);
            let array = [];
            for (let i = 0; i < response.data["messages"].length; i++) {
                threadId = response.data["messages"][i].id;
                array.push(threadId);
            }
            return array;
        }
        catch (error) {
            return globalErrorHandler(error);
        }
    }

    async searchGmailForOneMail(oAuth2Client, contractId, threadId) {
        let searchQuery = `subject:${contractId}`;
        var config1 = {
            method: "get",
            url: `https://www.googleapis.com/gmail/v1/users/me/messages?q=${searchQuery}`,
            headers: {
                Authorization: `Bearer ${oAuth2Client.credentials.access_token} `,
            },
        };
        try {
            const response = await axios(config1);
            const matchingEmails = [];
            for (let i = 0; i < response.data["messages"].length; i++) {
                const messageId = response.data["messages"][i].id;
                const email = await this.readGmailContentForOneMail(oAuth2Client, messageId);
                if (email.id == threadId) {
                    matchingEmails.push(email);
                }
            }
            if (matchingEmails.length > 0) {
                return matchingEmails;
            } else {
                return null;
            }
        } catch (error) {
            return globalErrorHandler(error);
        }
    };

    async saveEmailToDatabase(snippet, from, to, subject, cc, bcc, internalDate, date, threadId, mailId, isDocAttachedWithMail, contractId) {
        try {
            const newEmail = new readMailModel({
                snippet: snippet,
                from: from,
                to: to,
                subject: subject,
                cc: cc,
                bcc: bcc,
                internalDate: internalDate,
                date: date,
                threadId: threadId,
                mailId: mailId,
                isDocAttachedWithMail: isDocAttachedWithMail,
                contractId: contractId
            });
            await newEmail.save();
        } catch (error) {
            return globalErrorHandler(error);
        }
    }

    async processAndStoreEmail(email, contractId) {
        try {
            const snippet = email.snippet;
            const from = email.payload.headers.find(header => header.name === "From").value;
            const to = email.payload.headers.find(header => header.name === "To").value;
            const subject = email.payload.headers.find(header => header.name === "Subject").value
            var cc = email.payload.headers.find(header => header.name === "Cc");
            if (cc) {
                cc = cc.value;
            }
            var bcc = email.payload.headers.find(header => header.name === "Bcc");
            if (bcc) {
                bcc = bcc.value;
            }
            const internalDate = email.internalDate;
            const date = email.payload.headers.find(header => header.name === "Date").value;
            const format = 'ddd, DD MMM YYYY HH:mm:ss Z';

            const parsedDateTime = moment(date, format);
            const epochTimestamp = parsedDateTime.unix();

            const threadId = email.threadId;
            const mailId = email.id;
            let isDocAttachedWithMail;
            for (let i = 0; i < email.payload.parts.length; i++) {
                const bodyPart = email.payload.parts[i];
                if (bodyPart.mimeType == "application/pdf" || bodyPart.mimeType == "text/csv" || bodyPart.mimeType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || bodyPart.mimeType == "image/png") {
                    isDocAttachedWithMail = true;
                }
            }
            await this.saveEmailToDatabase(snippet, from, to, subject, cc, bcc, internalDate, epochTimestamp, threadId, mailId, isDocAttachedWithMail, contractId);
        } catch (error) {
            return globalErrorHandler(error);
        }
    }

    async readGmailContent(oAuth2Client, messageId, latestHistoryId) {
        var config = {
            method: "get",
            url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
            headers: {
                Authorization: `Bearer ${oAuth2Client.credentials.access_token}`,
            },
        };
        var data = [];
        var internalDate = "";
        var timestamp = "";
        try {
            const response = await axios(config)
            data = response.data;
            internalDate = data.internalDate;
            if (latestHistoryId != 0) {
                timestamp = parseInt(latestHistoryId, 10);
            }
            else {
                timestamp = 0
            }
            const timestamp1 = parseInt(internalDate, 10);
            if (timestamp1 > timestamp)
                return data;
        }
        catch (error) {
            return globalErrorHandler(error);
        }
    }
    async readGmailContentForOneMail(oAuth2Client, messageId) {
        var config = {
            method: "get",
            url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
            headers: {
                Authorization: `Bearer ${oAuth2Client.credentials.access_token}`,
            },
        };
        var data = [];
        try {
            const response = await axios(config)
            data = response.data;
            return data;
        }
        catch (error) {
            return globalErrorHandler(error);
        }
    }

    async getAttachment(oAuth2Client, attachmentId) {
        const config = {
            method: 'get',
            url: `https://www.googleapis.com/gmail/v1/users/me/messages/${attachmentId}/attachments/${attachmentId}`,
            headers: {
                Authorization: `Bearer ${oAuth2Client.credentials.access_token}`,
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

    async readInboxContent(searchText, req) {
        try {
            let page = req.query && req.query.page ? req.query.page : 1;
            let count = 0;
            let totalPages = 0;
            if (req.query.isFiltered === 'true') {
                const allEmails = await readMailModel
                    .find({ contractId: searchText, isEmailMarkedFavourite: true })
                    .skip(20 * page - 20)
                    .limit(20)
                    .sort({ createdAt: -1 })
                    .lean();
                count = await readMailModel.countDocuments({ contractId: searchText });
                if (count > 0) {
                    totalPages = Math.ceil(count / 20);
                }
                return ({ status: true, data: { emailData: allEmails, totalPages: totalPages, totalCount: count } });
            }
            else {
                const latestEmail = await readMailModel.findOne({ contractId: searchText }, 'internalDate', { sort: { internalDate: -1 } });
                const latestHistoryId = latestEmail ? latestEmail.internalDate : '0';
                let threadId = [];
                const oAuth2Client = await this.getOAuthClient()
                threadId = await this.searchGmail(oAuth2Client, searchText);

                let arr = [];
                for (let d = 0; d < threadId.length; d++) {
                    const message = await this.readGmailContent(oAuth2Client, threadId[d], latestHistoryId);
                    if (message) {
                        arr.push(message);
                    }
                }
                for (let k = 0; k < arr.length; k++) {
                    await this.processAndStoreEmail(arr[k], searchText);
                }
                const allEmails = await readMailModel
                    .find({ contractId: searchText })
                    .skip(20 * page - 20)
                    .limit(20)
                    .sort({ createdAt: -1 })
                    .lean();
                count = await readMailModel.countDocuments({ contractId: searchText });
                if (count > 0) {
                    totalPages = Math.ceil(count / 20);
                }
                return ({ status: true, data: { emailData: allEmails, totalPages: totalPages, totalCount: count } });
            }
        } catch (error) {
            return globalErrorHandler(error);
        }
    }

    async getDetailsOfEachMail(searchText, id, req, organizationId) {
        try {
            const oAuth2Client = await this.getOAuthClient()
            const searchEmail = await readMailModel.findOne({ _id: ObjectId(id), contractId: searchText });
            if (searchEmail.documentIds.length > 0) {
                const allDocuments = await readMailModel.findOne({ _id: ObjectId(id) }).populate('documentIds', 'documentS3Url isEmailAttachment title')
                return ({ status: true, data: { emailData: allDocuments } })
            }
            const messages = await this.searchGmailForOneMail(oAuth2Client, searchText, searchEmail.mailId);
            for (let i = 0; i < messages.length; i++) {
                const bodyPart = messages[i].payload.parts;
                for (let l = 0; l < bodyPart.length; l++) {
                    if (bodyPart[l] && bodyPart[l].mimeType === 'application/pdf' && bodyPart[l].body && bodyPart[l].body.attachmentId) {
                        const attachmentId = bodyPart[l].body.attachmentId;
                        const attachmentData = await this.getAttachment(oAuth2Client, attachmentId);                       
                        const documents = new documentModel();
                        const s3urlFileUrl = await s3Service.uploadBase64ToS3(
                            req,
                            attachmentData.data,
                            `${organizationId}/contracts/${searchText}/email-docs/`,
                            `${documents._id.toString()}_Email-Attachment_${Date.now()}.pdf`
                        );
                        documents.isEmailAttachment = true;
                        documents.documentS3Url = s3urlFileUrl.data.url;
                        documents.title = bodyPart[l].filename;
                        documents.contractId = searchText;
                        documents.organizationId = organizationId;
                        documents.hash = s3urlFileUrl.data.hash;
                        documents.fileSize = s3urlFileUrl.data.size
                        await documents.save();
                        const documentPush = await readMailModel.findOneAndUpdate({ _id: ObjectId(id) }, { $push: { documentIds: documents._id } })
                    }
                    if (bodyPart[l] && bodyPart[l].mimeType === 'text/csv' && bodyPart[l].body && bodyPart[l].body.attachmentId) {
                        const attachmentId = bodyPart[l].body.attachmentId;
                        const attachmentData = await this.getAttachment(oAuth2Client, attachmentId);
                        const documents = new documentModel();
                        const s3urlFileUrl = await s3Service.uploadBase64ToS3(
                            req,
                            attachmentData.data,
                            `${organizationId}/contracts/${searchText}/email-docs/`,
                            `${documents._id.toString()}_Email-Attachment_${Date.now()}.csv`
                        );
                        documents.isEmailAttachment = true;
                        documents.documentS3Url = s3urlFileUrl.data.url;
                        documents.title = bodyPart[l].filename;
                        documents.contractId = searchText;
                        documents.organizationId = organizationId;
                        documents.hash = s3urlFileUrl.data.hash;
                        documents.fileSize = s3urlFileUrl.data.size
                        await documents.save();
                        const documentPush = await readMailModel.findOneAndUpdate({ _id: ObjectId(id) }, { $push: { documentIds: documents._id } })

                    }
                    if (bodyPart[l] && bodyPart[l].mimeType === 'image/png' && bodyPart[l].body && bodyPart[l].body.attachmentId) {
                        const attachmentId = bodyPart[l].body.attachmentId;
                        const attachmentData = await this.getAttachment(oAuth2Client, attachmentId);
                        const documents = new documentModel();
                        const s3urlFileUrl = await s3Service.uploadBase64ToS3(
                            req,
                            attachmentData.data,
                            `${organizationId}/contracts/${searchText}/email-docs/`,
                            `${documents._id.toString()}_Email-Attachment_${Date.now()}.pdf`
                        );
                        documents.isEmailAttachment = true;
                        documents.documentS3Url = s3urlFileUrl.data.url;
                        documents.title = bodyPart[l].filename;
                        documents.contractId = searchText;
                        documents.organizationId = organizationId;
                        documents.hash = s3urlFileUrl.data.hash;
                        documents.fileSize = s3urlFileUrl.data.size
                        await documents.save();
                        const documentPush = await readMailModel.findOneAndUpdate({ _id: ObjectId(id) }, { $push: { documentIds: documents._id } })
                    }
                    if (bodyPart[l] && bodyPart[l].mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && bodyPart[l].body && bodyPart[l].body.attachmentId) {
                        const attachmentId = bodyPart[l].body.attachmentId;
                        const attachmentData = await this.getAttachment(oAuth2Client, attachmentId);
                        const documents = new documentModel();
                        const s3urlFileUrl = await s3Service.uploadBase64ToS3(
                            req,
                            attachmentData.data,
                            `${organizationId}/contracts/${searchText}/email-docs/`,
                            `${documents._id.toString()}_Email-Attachment_${Date.now()}.docx`
                        );
                        documents.isEmailAttachment = true;
                        documents.documentS3Url = s3urlFileUrl.data.url;
                        documents.title = bodyPart[l].filename;
                        documents.contractId = searchText;
                        documents.organizationId = organizationId;
                        documents.hash = s3urlFileUrl.data.hash;
                        documents.fileSize = s3urlFileUrl.data.size
                        await documents.save();
                        const documentPush = await readMailModel.findOneAndUpdate({ _id: ObjectId(id) }, { $push: { documentIds: documents._id } })
                    }
                    if (bodyPart[l] && bodyPart[l].mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' && bodyPart[l].body && bodyPart[l].body.attachmentId) {
                        const attachmentId = bodyPart[l].body.attachmentId;
                        const attachmentData = await this.getAttachment(oAuth2Client, attachmentId);
                        const documents = new documentModel();
                        const s3urlFileUrl = await s3Service.uploadBase64ToS3(
                            req,
                            attachmentData.data,
                            `${organizationId}/contracts/${searchText}/email-docs/`,
                            `${documents._id.toString()}_Email-Attachment_${Date.now()}.pptx`
                        );
                        documents.isEmailAttachment = true;
                        documents.documentS3Url = s3urlFileUrl.data.url;
                        documents.title = bodyPart[l].filename;
                        documents.contractId = searchText;
                        documents.organizationId = organizationId;
                        documents.hash = s3urlFileUrl.data.hash;
                        documents.fileSize = s3urlFileUrl.data.size
                        await documents.save();
                        const documentPush = await readMailModel.findOneAndUpdate({ _id: ObjectId(id) }, { $push: { documentIds: documents._id } })
                    }
                    if (bodyPart[l] && bodyPart[l].mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && bodyPart[l].body && bodyPart[l].body.attachmentId) {
                        const attachmentId = bodyPart[l].body.attachmentId;
                        const attachmentData = await this.getAttachment(oAuth2Client, attachmentId);
                        const documents = new documentModel();
                        const s3urlFileUrl = await s3Service.uploadBase64ToS3(
                            req,
                            attachmentData.data,
                            `${organizationId}/contracts/${searchText}/email-docs/`,
                            `${documents._id.toString()}_Email-Attachment_${Date.now()}.xlsx`
                        );
                        documents.isEmailAttachment = true;
                        documents.documentS3Url = s3urlFileUrl.data.url;
                        documents.title = bodyPart[l].filename;
                        documents.contractId = searchText;
                        documents.organizationId = organizationId;
                        documents.hash = s3urlFileUrl.data.hash;
                        documents.fileSize = s3urlFileUrl.data.size
                        await documents.save();
                        const documentPush = await readMailModel.findOneAndUpdate({ _id: ObjectId(id) }, { $push: { documentIds: documents._id } })
                    }
                    if (bodyPart[l] && bodyPart[l].mimeType === 'image/jpeg' && bodyPart[l].body && bodyPart[l].body.attachmentId) {
                        const attachmentId = bodyPart[l].body.attachmentId;
                        const attachmentData = await this.getAttachment(oAuth2Client, attachmentId);
                        const documents = new documentModel();
                        const s3urlFileUrl = await s3Service.uploadBase64ToS3(
                            req,
                            attachmentData.data,
                            `${organizationId}/contracts/${searchText}/email-docs/`,
                            `${documents._id.toString()}_Email-Attachment_${Date.now()}.jpg`
                        );
                        documents.isEmailAttachment = true;
                        documents.documentS3Url = s3urlFileUrl.data.url;
                        documents.title = bodyPart[l].filename;
                        documents.contractId = searchText;
                        documents.organizationId = organizationId;
                        documents.hash = s3urlFileUrl.data.hash;
                        documents.fileSize = s3urlFileUrl.data.size
                        await documents.save();
                        const documentPush = await readMailModel.findOneAndUpdate({ _id: ObjectId(id) }, { $push: { documentIds: documents._id } })
                    }
                }
                const allDocuments = await readMailModel.findOne({ _id: ObjectId(id) }).populate('documentIds', 'documentS3Url isEmailAttachment title');
                return ({ status: true, data: { emailData: allDocuments } });
            }
        } catch (error) {
            return globalErrorHandler(error);
        }
    }
    async markFavourite(req) {
        try {
            let userId = req.user && req.user.id ? req.user.id : null;
            let userType = req.user && req.user.type ? req.user.type : null;
            let organizationId = req.user.organizationId ? req.user.organizationId : null;
            let bodyData = req.body ? req.body : null;

            if (!userId || !userType || !organizationId) {
                return { status: false, code: 400, msg: 'userId, userType, organizationId is required' };
            }

            if (userType != 'orgUser') {
                return { status: false, code: 400, msg: 'invalid userType' };
            }

            if (!bodyData) {
                return { status: false, code: 400, msg: 'bodyData is required' };
            }

            let mail = await readMailModel.findOne({ _id: bodyData.mailId });

            if (!mail) return { status: false, code: 400, msg: 'mail not found' };

            if (bodyData.markFavourite === true && mail.isEmailMarkedFavourite == false) {
                const updateMail = await readMailModel.findOneAndUpdate({ _id: bodyData.mailId }, { $set: { isEmailMarkedFavourite: true } });
                return { status: true, data: updateMail };
            } else if (bodyData.markFavourite === false && mail.isEmailMarkedFavourite == true) {
                const updateMail = await readMailModel.findOneAndUpdate({ _id: bodyData.mailId }, { $set: { isEmailMarkedFavourite: false } });
                return { status: true, data: updateMail };
            }
            else {
                return { status: true, code: 400, msg: 'all the mails here' };
            }
        } catch (error) {
            return globalErrorHandler(error);
        }
    };
}
module.exports = new gmailService();



