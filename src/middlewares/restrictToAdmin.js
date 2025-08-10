const APIError = require("../utils/API/APIError");
const asyncHandler = require("../utils/API/asyncHandler");

const restrictToAdmin = asyncHandler((req,res,next) =>{
    if(req.user?.role !== 'admin') throw new APIError(403,"Forbidden Access")
    next()
})

module.exports = restrictToAdmin