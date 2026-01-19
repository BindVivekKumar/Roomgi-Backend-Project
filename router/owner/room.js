const express = require("express");
const router = express.Router();
const multer = require("multer")
const { Validate, IsOwner } = require("../../middleware/uservalidate");
const upload = multer({ storage: multer.diskStorage({}) });


const {
   
    AddRoom,ownerAllroom,DeleteRoom,getAllRoomOfBranch,UpdateRoom,addRoomImages
    ,getdetails,deleteimage
} = require("../../controller/owner/room");




router.delete("/deleteroomimage", deleteimage)
// Upload up to 10 images
router.put(
    "/addroomimages",Validate,
    upload.array("roomImages", 10),
    addRoomImages
);
router.get("/branch-rooms/:id", getAllRoomOfBranch);

 router.get("/allroomsaccordingtoowner", Validate, ownerAllroom)
router.delete("/deleteroom/:id", Validate, DeleteRoom)
router.put("/updateroom/:Id", Validate, UpdateRoom)
router.post(
    "/addroom", Validate,
    upload.fields([{ name: "images", maxCount: 10 }]),
    AddRoom
);

router.get("/get/:id", getdetails)

module.exports = router;
