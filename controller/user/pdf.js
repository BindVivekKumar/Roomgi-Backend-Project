

const Tenant = require("../model/tenants");
const Complaint = require("../model/complaints");
const redisClient = require("../utils/redis");
const branchmanager = require("../model/branchmanager");
const PropertyBranch = require("../model/propertyBranch");
 







exports.downloadpdf=async(req,res)=>{

    try {

        const {brachId}=req.params;

        const branch=await PropertyBranch.findById(brachId);

        if(!branch){
            return res.status(404).json({success:false,
                message:"Branch not found"
            })
        }
        
    } catch (error) {
        
    }
}