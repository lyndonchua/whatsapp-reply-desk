# WhatsApp Reply Desk

Bento-box WhatsApp reply app paired with your WhatsApp briefing app.

## Features
- Upload daily briefing export `.txt`, `.json`, or `.csv`
- Groups chats by sender or WhatsApp group
- Removes duplicate messages before display and before Firebase saving
- Vertical scroll inside each sender/group card
- Auto-categorises chats by colour:
  - Work = blue
  - Family = green
  - Personal = purple
  - Urgent = red
  - Action Needed = orange
  - No Reply Needed = grey
- Uses Firebase Firestore to save daily grouped uploads and AI suggestions
- Uses Vercel API route so no OpenAI key is entered in the app

## Firebase
Firebase config is already added in `src/firebase.js`.

Firestore collections used:
- `dailyBriefings`
- `replySuggestions`

Each `dailyBriefings` record saves:
- `fileName`
- `totalGroups`
- `totalMessages`
- `groups`
- `createdAt`

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
