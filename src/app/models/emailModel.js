const mongoose= require('mongoose');
const ObjectId= mongoose.Schema.Types.ObjectId;

const readMailModel= new mongoose.Schema(
    {
        snippet:{
            type:String,
            required:true
        },
        from:{
            type:String,
            required:true
        },
        to:[{
            type:String,
            required:true
        }],        
        internalDate:{
            type:String,
            required: true
        },
        contractId:{
            type: String,
            required: true,
            match: /^[a-z0-9]{24}$/
        },
        subject:{
            type:String,
            required:true
        },
        cc:[{
            type:String
        }],
        bcc:[{
            type:String
        }],
        date:{
           type:Number,
           required:true
        },
        threadId:{
            type:String,
            required:true
        },
        mailId:{
           type:String,
           required:true 
        },
        documentIds:[{
            type:ObjectId,
            ref:"document"
        }],
        isDocAttachedWithMail:{
            type:Boolean,
            default:false
        },
        isEmailMarkedFavourite:{
            type:Boolean,
            default:false
        }           
    },
    {timestamps: true}
)

module.exports= mongoose.model('readMail',readMailModel )