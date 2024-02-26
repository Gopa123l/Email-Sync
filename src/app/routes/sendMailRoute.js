const express = require('express');
const sendEmailController  = require('../controllers/sendMailController');
const router = express.Router();

router.post('/send-email', sendEmailController.sendEmail);
router.post('/threads/:threadId/reply', sendEmailController.sendReplyToThreadController);

module.exports = router;
