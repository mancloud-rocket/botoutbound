const prompt = `
You are an AI voice assistant for Owl Shoes, a premium shoe retailer. Your role is to help customers find the perfect pair of shoes based on their preferences and profile. Engage in a friendly, helpful manner while gathering relevant information to make personalized recommendations.
Follow these guidelines:
1. Greet the customer warmly and ask how you can assist them.
2. Inquire about their shoe needs (e.g., type of shoe, size, specific requirements).
3. Access and utilize the customer's profile information when available (e.g., previous purchases, running habits).
4. Ask clarifying questions to better understand their preferences.
5. Provide recommendations based on the information gathered, explaining why each suggestion suits their needs.
6. Offer additional product details (e.g., available colors, materials) when asked.
7. Assist with the purchasing process if the customer decides to buy.
8. Confirm order details and provide next steps.
9. Always maintain a polite and professional tone.
10. If you don't have an answer, offer to connect the customer with a human representative.

Remember to personalize the interaction based on the customer's history with Owl Shoes, if available. Your goal is to provide an efficient, enjoyable, and tailored shopping experience.
`;

const userProfile = `
{
    "customerProfile": {
        "id": "CS12345",
        "name": "Brandon Hawkins",
        "email": "brandon.johnson@email.com",
        "phoneNumber": "+1 (555) 123-4567",
        "shoeSize": 10,
        "width": "Medium",
        "preferredColors": ["Blue", "Black", "Gray"],
        "activityLevel": "High",
        "primaryActivities": ["Trail Running", "Hiking", "Casual Wear"],
        "preferences": {
            "archSupport": "High",
            "cushioning": "Maximum",
            "breathability": "High"
        },
        "loyaltyTier": "Gold",
        "communicationPreferences": ["Email", "SMS"],
        "lastInteraction": "2024-10-15"
    }
}
`;

const orderHistory = `
{
    "orderHistory": [
        {
            "orderId": "ORD98765",
            "date": "2024-09-01",
            "items": [
                {
                    "productName": "TrailMaster X1",
                    "category": "Trail Running",
                    "color": "Blue",
                    "size": 10,
                    "price": 129.99
                }
            ],
            "totalAmount": 129.99
        },
        {
            "orderId": "ORD87654",
            "date": "2024-06-15",
            "items": [
                {
                    "productName": "ComfortWalk Pro",
                    "category": "Casual",
                    "color": "Black",
                    "size": 10,
                    "price": 89.99
                },
                {
                    "productName": "HikeSupreme 2000",
                    "category": "Hiking",
                    "color": "Gray",
                    "size": 10,
                    "price": 149.99
                }
            ],
            "totalAmount": 239.98
        },
        {
            "orderId": "ORD76543",
            "date": "2024-03-10",
            "items": [
                {
                    "productName": "RunElite 5",
                    "category": "Road Running",
                    "color": "Red",
                    "size": 10,
                    "price": 119.99
                }
            ],
            "totalAmount": 119.99
        }
    ]
}
`;

module.exports = { prompt, userProfile, orderHistory };