# LeaveFlow Backend API

LeaveFlow Backend built with Express, Mongoose, and Google Gemini AI Agent integration.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/leavemgmt
JWT_SECRET=your_jwt_secret_key_here
GEMINI_API_KEY=your_gemini_api_key_from_aistudio
GEMINI_MODEL=gemini-1.5-flash # or whichever current Flash model ID you select
```

---

## ⚠️ Free-Tier AI Privacy Notice
> **Important:** Prompts and data sent on the **Google AI Studio Free Tier** may be reviewed by human reviewers and used by Google to improve its products and services.
> 
> To safeguard sensitive corporate data:
> - Passwords, password hashes, and database secrets are **never** passed to the model or tool arguments.
> - Tools select only minimal necessary employee snapshots and strictly scoped fields.
> - For production environments requiring strict enterprise confidentiality, upgrade to a paid Google Cloud Vertex AI / Gemini API tier where customer data is not logged or used for training.

---

## Known Limits
- In-memory state resets on restart and works for a single instance only.

