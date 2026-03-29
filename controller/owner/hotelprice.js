const HotelRoom = require("../../model/hotel/hotelroom");

// ADD PRICE
exports.addDynamicPrice = async (req, res) => {
    try {
        const { startDate, endDate, price, reason } = req.body;
        const { id } = req.params;

        const room = await HotelRoom.findById(id);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        // ❗ Overlapping Check
        const isOverlapping = room.dynamicPricing.some(dp =>
            new Date(startDate) <= new Date(dp.endDate) &&
            new Date(endDate) >= new Date(dp.startDate)
        );

        if (isOverlapping) {
            return res.status(400).json({
                success: false,
                message: "Date range overlaps with existing pricing",
            });
        }

        room.dynamicPricing.push({
            startDate,
            endDate,
            price,
            reason,
        });

        await room.save();

        res.status(200).json({
            success: true,
            message: "Dynamic price added",
            data: room,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



exports.deleteDynamicPrice = async (req, res) => {
    try {
        const { roomId, pricingId } = req.params;

        const room = await HotelRoom.findById(roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        room.dynamicPricing = room.dynamicPricing.filter(
            dp => dp._id.toString() !== pricingId
        );

        await room.save();

        res.json({
            success: true,
            message: "Dynamic pricing removed",
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};