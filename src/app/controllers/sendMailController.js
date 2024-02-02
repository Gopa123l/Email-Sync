const sendMailService= require('../services/sendMailService');

exports.sendReplyToThreadController= async function (req, res) {
    try {
        const result= await sendMailService.sendReplyToThread(req);
        if(result.status)
        res.status(200).json({ success: true, message: 'Reply sent successfully.' });
    } catch (error) {
        console.error('Error sending reply to thread:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

exports.sendReplyToEmailController=async function (req, res) {   
    try {       
        const result= await sendMailService.sendReplyToEmail(req);
        if(result.status)
        res.status(200).json({ status: true, message: 'Reply sent successfully.' });
    } catch (error) {
        console.error('Error sending reply to email:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}


exports.sendEmail=async function (req, res) {
  try {   
    const result= await sendMailService.sendEmail(req);
    if(result.status)
    res.status(200).json({ status: true, message: 'Email sent successfully.' });   
  } catch (error) {
    console.error('Error sending email:', error.message);
    res.status(500).json({ status: false, message: 'Internal server error.' });
  }
}