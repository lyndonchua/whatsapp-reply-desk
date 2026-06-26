# WhatsApp Reply Desk

Updated features:
- Search by sender or group.
- Group chats by sender or group.
- Remove duplicate messages.
- Save uploaded/grouped chats to Firebase Firestore.
- AI reply suggestions through Vercel `/api/suggest`; API key stays in Vercel as `OPENAI_API_KEY`.
- Vertical scroll inside each sender/group card.
- Vertical scroll in the left column.
- Compact bento layout that fits a normal website screen.
- Change category for any chat: Work, Family, Personal, No Reply Needed.
- Shift/move sender/group bento boxes up or down.
- Select and combine multiple chats into one combined chat.
- Delete an entire sender/group chat.

## Run
```bash
npm install
npm run dev
```

## Deploy to Vercel
Add this environment variable in Vercel:

```bash
OPENAI_API_KEY=your_key_here
```
