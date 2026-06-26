# WhatsApp Reply Desk - Final Clean Version

Fixed version for faster Vercel deployment.

## Features
- Password lock: `344565`
- 5 categories: Work, Family, Personal, Hockey, Classes
- Urgent / Action / No Reply are NOT columns
- Search sender or group
- Group chats by sender/group
- Vertical scroll within each chat card, with full message text shown
- Remove duplicate messages
- Change category
- Shift chat up/down
- Combine selected chats
- Delete entire chat
- Save to Firebase
- AI replies via OpenRouter only, through Vercel API

## Vercel environment variables
Set these in Vercel:

```text
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openai/gpt-5
```

Do not put API keys in the frontend.

## Latest update
- Added Hockey and Classes categories.
- Latest messages appear at the top.
- Combined chats keep all messages fully displayed, with each original sender labelled.
