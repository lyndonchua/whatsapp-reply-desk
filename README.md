# WhatsApp Reply Desk

Bento-box WhatsApp reply app paired with your WhatsApp briefing app.

## Features
- Upload daily briefing export `.txt`, `.json`, or `.csv`
- Auto-categorises chats by colour:
  - Work = blue
  - Family = green
  - Personal = purple
  - Urgent = red
  - Action Needed = orange
  - No Reply Needed = grey
- Uses Firebase Firestore to save daily uploads and AI suggestions
- Uses Vercel API route so no OpenAI key is entered in the app

## Firebase
Firebase config is already added in `src/firebase.js`.

Firestore collections used:
- `dailyBriefings`
- `replySuggestions`

## Vercel API key
In Vercel, add Environment Variable:

`OPENAI_API_KEY=your_key_here`

Optional:

`OPENAI_MODEL=gpt-4o-mini`

Do not put the API key inside the app.

## Run locally
```bash
npm install
npm run dev
```

## Deploy to Vercel
```bash
npm run build
```
Then deploy the folder to Vercel.
