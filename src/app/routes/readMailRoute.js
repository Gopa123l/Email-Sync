const express = require("express");
const router = express.Router();
const readMailController = require("../controllers/readMailController");

router.get("/search/:searchItem", readMailController.search);
router.get("/read/:searchText", readMailController.readContent);


module.exports = router;