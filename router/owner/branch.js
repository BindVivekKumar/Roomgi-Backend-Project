const express = require("express");
const router = express.Router();
const multer = require("multer")
const { Validate, IsOwner } = require("../../middleware/uservalidate");
const upload = multer({ storage: multer.diskStorage({}) });


const {
    GetAllBranchByBranchId,GetAllBranchOwner,
    listPgRoom,getalllistedandunlisted,
    GetAllBranch,AddBranch,DeleteBranch,EditBranch,
      getStates,
  getcities,
  getlocationname


} = require("../../controller/owner/branch");


//used 

router.post("/add", Validate, upload.array("images"), AddBranch);
 router.get("/getalllbranchowner", Validate, GetAllBranchOwner)

 router.get("/getbranch/bybranchMnager", Validate, GetAllBranchByBranchId)


router.get("/get", Validate, GetAllBranch)




// Get all states
router.get("/states", getStates);

// Get cities by state
router.post("/cities", getcities);

// Get location names by state + city
router.post("/locations", getlocationname);













router.get("/getallpg", getalllistedandunlisted)
router.post("/listpg", listPgRoom)


// router.put("/branchmanager/passwordchange", Validate, changebranchpassword)






router.patch("/edit/:branchId", Validate, EditBranch)
router.delete("/DeleteBranch", Validate, DeleteBranch)



module.exports = router;
