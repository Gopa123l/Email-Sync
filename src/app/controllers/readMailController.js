const readGmailService = require('../services/readMailService');

class GmailController {
    async search(req, res) {
        try {
            const result = await readGmailService.searchGmail(req.params.searchItem);
            if (result.status) return res.status(200).send({ status: true, data: result.data });
            return res.status(result.code).send({ status: false, msg: result.msg });
        } catch (error) {
            return res.status(500).send({ status: false, msg: error.stack });
        }
    }

    async readContent(req, res) {
        try {
            const result = await readGmailService.readInboxContent(req.params.searchText, req);
            if (result.status) return res.status(200).send({ status: true, data: result.data });
            return res.status(result.code).send({ status: false, msg: result.msg });
        } catch (error) {
            return res.status(500).send({ status: false, msg: error.stack });
        }
    }

    async getDetailsOfEachMail(req, res) {
        try {
            const result = await readGmailService.getDetailsOfEachMail(req.params.searchText, req.params.id, req,req.user.organizationId);
            if (result.status) return res.status(200).send({ status: true, data: result.data });
            return res.status(result.code).send({ status: false, msg: result.msg });
        } catch (error) {
            return res.status(500).send({ status: false, msg: error.stack });
        }
    }

    async markFavourite (req, res) {
        try {
            let result = await readGmailService.markFavourite(req);
            if (result.status) return res.status(200).send({ status: true, data: result.data });
            return res.status(result.code).send({ status: false, msg: result.msg });
        } catch (e) {
            return res.status(500).send({ status: false, msg: e.stack });
        }
    };

}

module.exports = new GmailController();
