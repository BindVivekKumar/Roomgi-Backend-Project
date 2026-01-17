const { GoogleGenerativeAI } = require("@google/generative-ai"); // Correct Package Name

// 1. Initialize API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateRoomDescription = async ({ newRoom, branch }) => {
  try {
    // 2. Setup Model inside the function
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const facilities = newRoom.facilities?.length > 0 ? newRoom.facilities.join(", ") : "essential basic amenities";
    const area = branch?.area || branch?.city || "prime location";
    const rent = newRoom.price || newRoom.rentperday || "competitive";

    const prompt = `
      Act as a Senior Real Estate Copywriter for RoomGi. 
      Generate a professional, human-like property listing based ONLY on these facts:
      - Property: Room ${newRoom.roomNumber} (${newRoom.category})
      - Location: ${area}, ${newRoom.city}
      - Financials: ₹${rent} rent
      - Setup: ${newRoom.furnishedType} furnishing
      - Facilities: ${facilities}
      - Rules: ${newRoom.rules?.join(", ") || "Standard guidelines"}

      OUTPUT FORMAT (STRICT):
      1. PROPERTY TITLE: [SEO Friendly Title]
      2. KEY HIGHLIGHTS: [3 short bullet points]
      3. FULL DESCRIPTION: 
         Write EXACTLY 3 impactful and flowing lines:
         Line 1: Location advantage of ${area}.
         Line 2: Room comfort, rent (₹${rent}), and ${facilities}.
         Line 3: Suitability and a trust-building closing.
      4. IDEAL FOR: [1 concise line]
      5. SEARCH KEYWORDS: [10 keywords]

      NOTE: DO NOT use markdown bold (**) or symbols.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Cleaning the output
    return text.replace(/\*\*/g, "").replace(/#/g, "").trim();

  } catch (error) {
    console.error("AI Description Error:", error);
    return "Professional room in " + (branch?.city || "Ghaziabad") + " available for rent.";
  }
};