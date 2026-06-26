# WhatsApp Reply Desk

Bento-style WhatsApp reply dashboard.

## Added in this version
- Search box to search by sender or group name
- Three-column bento layout for chat sections
- Chats grouped by sender/group
- Duplicate messages removed before display and saving
- Vertical scroll inside each sender/group card
- Delete entire sender/group chat from the dashboard
- Save/upload grouped chats to Firebase Firestore
- AI reply suggestions through Vercel API only

## Firebase
Your Firebase config is in `src/firebase.js`.
Uploaded and manually saved chats are stored in `dailyBriefings`.
AI reply suggestions are stored in `replySuggestions`.

## Vercel API key
Do not put the OpenAI API key in the app.
Add it in Vercel Environment Variables as:

`OPENAI_API_KEY`
