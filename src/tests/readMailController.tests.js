const request = require('supertest');
const jest= require('jest')
const express = require('express');
const readMailController = require('../app/controllers/readMailController'); 
const readGmailService = require('../app/services/readMailService'); 

jest.mock('../app/services/readMailService', () => ({
  searchGmail: jest.fn(),
  readInboxContent: jest.fn(),
}));

const app = express();
app.use(express.json());

app.get("/search/:searchItem", readMailController.search);
app.get("/read/:searchText", readMailController.readContent);

describe('API Controller Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /search/:searchItem', () => {
    it('should search Gmail and return 200 with search results', async () => {      
      readGmailService.searchGmail.mockResolvedValue(['email1', 'email2']);      
      const response = await request(app).get(`/search/${searchTerm}`);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe(true);
      expect(response.body.data).toEqual(['email1', 'email2']);      
      expect(readGmailService.searchGmail).toHaveBeenCalledWith('searchItem');
    });

    it('should return 500 if search fails', async () => {      
      readGmailService.searchGmail.mockRejectedValue(new Error('Search failed'));      
      const response = await request(app).get(`/search/${searchTerm}`);

      expect(response.status).toBe(500);
      expect(response.body.status).toBe(false);
      expect(response.body.message).toBe('Internal server error.');
    });
  });

  describe('GET /read/:searchText', () => {
    it('should read inbox content and return 200 with content', async () => {      
      readGmailService.readInboxContent.mockResolvedValue(['email1 content', 'email2 content']);      
      const response = await request(app).get(`/read/${searchText}`);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe(true);
      expect(response.body.data).toEqual(['email1 content', 'email2 content']);
      
      expect(readGmailService.readInboxContent).toHaveBeenCalledWith('searchText');
    });

    it('should return 500 if reading content fails', async () => {      
      readGmailService.readInboxContent.mockRejectedValue(new Error('Read failed'));
      const response = await request(app).get(`/read/${searchText}`)
      
      expect(response.status).toBe(500);
      expect(response.body.status).toBe(false);
      expect(response.body.message).toBe('Internal server error.');
    });
  });
});
