const express = require("express");
const router = express.Router();
const readMailController = require("../controllers/readMailController");
const userAuth = require('../middlewares/userAuth');

router.get("/search/:searchItem", readMailController.search);
router.get("/read/:searchText", readMailController.readContent);
router.get("/read/:searchText/get-details/:id",userAuth, readMailController.getDetailsOfEachMail)
router.post('/mark-favourite', userAuth, readMailController.markFavourite);

module.exports = router;