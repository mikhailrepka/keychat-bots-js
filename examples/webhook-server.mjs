import { createServer } from "node:http";
import { KeyChatBot, dispatchWebhook } from "@keychat/bots";

const bot = new KeyChatBot(process.env.KEYCHAT_BOT_TOKEN);
const secret = process.env.KEYCHAT_WEBHOOK_SECRET;

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/webhook") {
    response.writeHead(404).end(); return;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);
  try {
    const result = await dispatchWebhook(rawBody, request.headers, secret, {
      "message.created": async event => {
        await bot.sendMessage({ chat_id: event.data.chat_id, content: { text: `Echo: ${event.data.message.text}` } });
        return {};
      },
      "button.clicked": () => ({ ok: true }),
      "inline.query": event => ({ results: [{ id: "result", type: "text", text: event.data.query }] }),
    });
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result ?? {}));
  } catch (error) {
    response.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ error: String(error) }));
  }
}).listen(3000, () => console.log("Webhook: http://127.0.0.1:3000/webhook"));
