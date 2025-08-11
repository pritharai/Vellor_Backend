const router = require("express").Router();
const {
  createContact,
  deleteContact,
  getContactById,
  getContacts,
} = require("../controllers/contact.controller");

router.post('/',createContact)
router.delete('/:id', deleteContact);
router.get('/',getContacts)
router.get('/:id',getContactById)

module.exports = router;
