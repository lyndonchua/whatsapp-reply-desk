# WhatsApp Reply Desk

Updated version:
- Password lock: `344565`
- Only 3 dashboard categories: Work, Family, Personal
- Urgent / Action / No Reply Needed are NOT columns; they are card attributes only
- Group chats by sender or group
- Remove duplicate messages
- Vertical scroll inside each sender/group card and each column
- Search sender, group, or message
- Combine selected chats
- Delete entire chat
- Save grouped chats to Firebase
- AI replies through OpenRouter only via Vercel `/api/suggest`

## Vercel environment variables

```txt
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-5
```
