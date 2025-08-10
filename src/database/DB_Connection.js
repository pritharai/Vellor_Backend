const mongoose = require('mongoose')
const {DB_NAME} = require('../constants')

const ConnectDB = async() =>{
    try {
        const connection = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)
        console.log("MongoDB connected Successfully")
        console.log(`MongoDB connection host: ${connection.connection.host}`)
    } catch (error) {
        console.log("Error Connecting to MongoDB", error)
        process.exit(1)
    }
}

module.exports = ConnectDB