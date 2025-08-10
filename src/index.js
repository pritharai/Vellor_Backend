require('dotenv')
.config(
    {
        path:'./.env'
    }
)
const { app } = require('./app')
const ConnectDB = require('./database/DB_Connection')


ConnectDB()
.then(()=>{
    app.listen(process.env.PORT, ()=>console.log("Server is running"))
})
.catch(()=>console.log("MongoDB Connection failed"))