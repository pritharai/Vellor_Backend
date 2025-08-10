const asyncHandler = (handleFunction)=>{
    return (req,res,next) =>{
        Promise.resolve(handleFunction(req,res,next)).catch((err)=>next(err))
    }
}

module.exports = asyncHandler