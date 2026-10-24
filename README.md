# Key Chat Bots SDK for JavaScript / TypeScript

Small server-side SDK for the Key Chat Bot Runtime API and signed webhooks. Node.js 18+.

## Install

After the first npm release:

```bash
npm install @keychat/bots
```

For local development before publication:

```bash
git clone https://github.com/mikhailrepka/keychat-bots-js.git
cd keychat-bots-js
npm install
npm run build
npm test
```

Use a local checkout from another project with `npm install ../keychat-bots-js`.

## Connect

Create a bot in Key Chat and issue its runtime token. In the existing bot's editor, enter a public HTTPS webhook URL and save it; Key Chat reveals the signing secret once. Store the values on your server as `KEYCHAT_BOT_TOKEN` and `KEYCHAT_WEBHOOK_SECRET`. Rotating the webhook secret invalidates the previous value immediately.

```ts
import { KeyChatBot, botCommand, callbackButton, commandButton } from "@keychat/bots";

const bot = new KeyChatBot(process.env.KEYCHAT_BOT_TOKEN!);

await bot.sendMessage({
  chat_id: chatId,
  content: {
    text: "**Choose an action**",
    format: "markdown",
    keyboard: { rows: [[commandButton("/help")], [callbackButton("details", "Details", "job-42")]] },
    menu: { rows: [[commandButton("/start"), commandButton("/settings")]] },
    commands: [
      botCommand("/start", { description: "Start again", icon: "▶️" }),
      botCommand("/invite", { arguments: "<email>", description: "Invite a user" })
    ]
  },
  idempotency_key: crypto.randomUUID()
});
```

`menu` replaces the current bot menu. Omit it to keep the menu, send `menu: null` to hide it. `keyboard` contains buttons attached to a message. A callback button does not post a visible user message.

`commands` updates slash-command autocomplete in direct bot chats. Omit it to keep the current list; send `commands: null` or `commands: []` to clear it. `arguments` is shown as a hint but is not inserted into the composer.

Edit a message without changing its event reference:

```ts
await bot.editMessage(chatId, eventId, { text: "Done", keyboard: null });
```

Upload and send media:

```ts
const media = await bot.uploadMedia(new Blob([bytes], { type: "image/png" }), "result.png");
await bot.sendMessage({ chat_id: chatId, content: { attachments: [{ type: "image", ...media }] } });
```

## Receive webhooks

Signature verification must use the raw request body, before JSON parsing.

```ts
import { dispatchWebhook } from "@keychat/bots";

const result = await dispatchWebhook(rawBody, request.headers, process.env.KEYCHAT_WEBHOOK_SECRET!, {
  "message.created": async event => {
    await bot.sendMessage({ chat_id: String(event.data.chat_id), content: { text: `Echo: ${event.data.message.text}` } });
    return {};
  },
  "button.clicked": event => ({ ok: true }),
  "inline.query": event => ({ results: [{ id: "one", type: "text", text: `Result: ${event.data.query}` }] })
});
```

Return `result` as JSON with a 2xx status. Key Chat retries queued events, so use `event.id` or an `idempotency_key` to avoid duplicate work.

A complete dependency-free Node HTTP example is in [`examples/webhook-server.mjs`](./examples/webhook-server.mjs). After building the package, run it with `KEYCHAT_BOT_TOKEN=… KEYCHAT_WEBHOOK_SECRET=… node examples/webhook-server.mjs`.

## Documentation

The README is the quick start. Generate and serve the typed API reference locally:

```bash
npm install
npm run docs
npm run docs:serve
```

Platform documentation: <https://chat.wokey.pro/docs/bots/>. Runtime endpoint: `https://chat.wokey.pro/_keychat` (override with `new KeyChatBot(token, { baseUrl })` for tests).
