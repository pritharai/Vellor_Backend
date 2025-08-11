const Contact = require('../models/Contact.model')
const APIError = require("../utils/API/APIError");
const APIResponse = require("../utils/API/APIResponse");
const asyncHandler = require("../utils/API/asyncHandler");

const createContact = asyncHandler(async(req,res) =>{
    const {name,email,phone,message} = req.body
    if(
        !name||
        !email ||
        !phone ||
        !message
    ) throw new APIError("Name, Email, Contact number & message are required ")

    const contact = await Contact.create({name,email,phone,message})
    res.status(201).json(new APIResponse(201,contact,"Your message successfully recieved"))
})

const getContacts = asyncHandler(async(req,res) =>{
    const contacts = await Contact.find().sort({createdAt: -1})
    res.status(200).json(new APIResponse(200, contacts, "Contacts fetched successfully"))
})

const getContactById = asyncHandler(async(req,res) =>{
 const contact = await Contact.findById(req.params.id);
  if (!contact) {
    throw new APIError(404, "Contact not found");
  }
  res.status(200).json(new APIResponse(200, contact, "Contact fetched successfully"));
})

const deleteContact = asyncHandler(async(req,res) =>{
    const contact = await Contact.findByIdAndDelete(req.params.id)
    if(!contact) throw new APIError(404, "Contact not found")
    res.status(200).json(new APIResponse(200, contact, "Contact deleted successfully"))
})

module.exports = {
    createContact,
    getContacts,
    getContactById,
    deleteContact,
}
