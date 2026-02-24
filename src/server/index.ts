import amqp from "amqplib";
import {
  declareAndBind,
  publishJSON,
  SimpleQueueType,
} from "../internal/pubsub.js";
import {
  ExchangePerilDirect,
  ExchangePerilTopic,
  GameLogSlug,
  PauseKey,
} from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";

async function main() {
  console.log("Starting Peril server...");
  const connectString = "amqp://guest:guest@localhost:5672/";

  const connection = await amqp.connect(connectString);
  console.log("Connection successful");

  const channel = await connection.createConfirmChannel();
  const [channelLog, queueLog] = await declareAndBind(
    connection,
    ExchangePerilTopic,
    GameLogSlug,
    `${GameLogSlug}.*`,
    SimpleQueueType.Durable,
  );

  await channel.assertExchange(ExchangePerilDirect, "direct", {
    durable: true,
  });
  printServerHelp();
  let state: PlayingState;
  while (true) {
    const input = await getInput();
    if (!input) {
      continue;
    }
    switch (input[0]) {
      case "pause":
        console.log("sending a pause message");
        state = { isPaused: true };
        publishJSON(channel, ExchangePerilDirect, PauseKey, state);
        break;

      case "resume":
        console.log("sending a resume message");
        state = { isPaused: false };
        publishJSON(channel, ExchangePerilDirect, PauseKey, state);
        break;

      case "quit":
        console.log("Exiting");
        await connection.close();
        
        return;

      default:
        console.log("I don't understand the command");
    }
  }

  process.on("exit", () => {
    connection.close();
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
