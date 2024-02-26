const request = require('supertest');
const jest= require('jest')
const express = require('express');
const sendMailController = require('../app/controllers/sendMailController'); 
const sendMailService = require('../app/services/sendMailService'); 

jest.mock('../app/services/sendMailService', () => ({
  sendEmail: jest.fn(),
  sendReplyToThread: jest.fn(),
  sendReplyToEmail: jest.fn(),
}));

const app = express();
app.use(express.json());


app.post("/send-email", sendMailController.sendEmail);
app.post("/send-reply-to-thread/:threadId", sendMailController.sendReplyToThreadController);

describe('API Controller Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /send-email', () => {
    it('should send email and return 200 with success message', async () => {      
      sendMailService.sendEmail.mockResolvedValue({ status: true, message: 'Email sent successfully.' });
      
      const response = await request(app)
        .post('/send-email')
        .send({ to: 'recipient@example.com', subject: 'Test Subject', body: 'Test Body' });

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body.status).toBe(true);
      expect(response.body.message).toBe('Email sent successfully.');      
      expect(sendMailService.sendEmail).toHaveBeenCalledWith(expect.anything());
    });

    it('should return 500 if sending email fails', async () => {      
      sendMailService.sendEmail.mockRejectedValue(new Error('Send email failed'));      
      const response = await request(app)
        .post('/send-email')
        .send({ to: 'recipient@example.com', subject: 'Test Subject', body: 'Test Body' });
      
      expect(response.status).toBe(500);
      expect(response.body.status).toBe(false);
      expect(response.body.message).toBe('Internal server error.');
    });
  });

  describe('POST /send-reply-to-thread/:threadId', () => {
    it('should send email within thread and return 200 with success message', async () => {      
      sendMailService.sendEmail.mockResolvedValue({ status: true, message: 'Email sent successfully.' });
      
      const response = await request(app)
        .post(`/send-reply-to-thread/${threadId}`)
        .send({ to: 'recipient@example.com', subject: 'Test Subject', body: 'Test Body' });

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body.status).toBe(true);
      expect(response.body.message).toBe('Email sent successfully.');      
      expect(sendMailService.sendEmail).toHaveBeenCalledWith(expect.anything());
    });

    it('should return 500 if sending email fails', async () => {      
      sendMailService.sendEmail.mockRejectedValue(new Error('Send email failed'));      
      const response = await request(app)
        .post(`/send-reply-to-thread/${threadId}`)
        .send({ to: 'recipient@example.com', subject: 'Test Subject', body: 'Test Body' });
      
      expect(response.status).toBe(500);
      expect(response.body.status).toBe(false);
      expect(response.body.message).toBe('Internal server error.');
    });
  });

  
});
