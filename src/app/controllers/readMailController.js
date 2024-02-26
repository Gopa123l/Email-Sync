const readGmailService = require('../services/readMailService');

class GmailController {
    async search(req, res) {
        try {
            const result = await readGmailService.searchGmail(req.params.searchItem);
            return res.status(200).send({ status: true, data: result});
        } catch (error) {
            return res.status(500).send({ status: false, msg: error.stack });
        }
    }

    async readContent(req, res) {
        try {
            const result = await readGmailService.readInboxContent(req.params.searchText, req);           
            return res.status(200).send({ status: true, data: result});
        } catch (error) {
            return res.status(500).send({ status: false, msg: error.stack });
        }
    }    
    
}

module.exports = new GmailController();
