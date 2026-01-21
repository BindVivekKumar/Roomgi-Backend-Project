const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateRoomDescription = async ({ newRoom, branch }) => {
    // 1. Move variable declarations outside Try block so Catch can see them
    const safeArea = branch?.area || branch?.city || newRoom.city || "prime residential location";
    const safeRent = newRoom.price || newRoom.rentperday || newRoom.rent || "competitive pricing";
    const safeCategory = newRoom.category || "accommodation";
    const safeCity = branch?.city || newRoom.city || "Ghaziabad";
    const safeFurnished = newRoom.furnishedType || "well-maintained";

    try {
        // ✅ FIX: Using "gemini-1.5-flash-latest" or just "gemini-1.5-flash"
        // Also ensure your @google/generative-ai package is up to date
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const facilities = Array.isArray(newRoom.facilities) && newRoom.facilities.length > 0
            ? newRoom.facilities.join(", ")
            : "basic essential amenities";

        const rules = Array.isArray(newRoom.rules) && newRoom.rules.length > 0
            ? newRoom.rules.join(", ")
            : "Standard PG guidelines";

        const prompt = `
            Act as a Senior Real Estate Copywriter for RoomGi.
            Generate a professional rental listing:
            - Room: ${newRoom.roomNumber} (${safeCategory})
            - City: ${safeCity}
            - Area: ${safeArea}
            - Rent: ₹${safeRent}
            - Furnishing: ${safeFurnished}
            - Facilities: ${facilities}
            - Rules: ${rules}

            STRICT FORMAT: 1. TITLE, 2. HIGHLIGHTS, 3. DESCRIPTION (3 sentences), 4. IDEAL FOR, 5. KEYWORDS.
            No Markdown symbols.
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        return text.replace(/\*/g, "").replace(/#/g, "").trim();

    } catch (error) {
        // Detailed logging for you, but the app won't crash
        console.error("AI API Error:", error.message);

        // ✅ FIXED: Using 'safeArea', 'safeCity', etc. which are defined above
        return `Professional ${safeCategory} available for rent in ${safeArea}, ${safeCity}. 
        This ${safeFurnished} property features ${newRoom.facilities?.slice(0, 3).join(", ") || "essential amenities"}. 
        Monthly rent is ₹${safeRent}. Perfect for students and working professionals.`.replace(/\s+/g, ' ');
    }
};