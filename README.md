# WhatsApp Reply Desk

Updated from the uploaded OpenRouter zip.

Changes in this version:
- Only 3 categories/columns: Work, Family, Personal
- Removed separate Urgent, Action, and No Reply Needed columns
- Urgency remains as a label inside each chat card
- Search box searches sender/group names and sections
- Sender/group cards have their own vertical message scroll
- Left sidebar has vertical scroll
- Delete entire sender/group chat option
- Combine selected chats option
- Change category option for each sender/group
- Save grouped/deduplicated chats to Firebase
- AI replies use OpenRouter only through Vercel `/api/suggest`

Vercel environment variables:

```text
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-5
```

The API key is not entered in the app frontend.
