import * as amqp from "amqplib";
import {
  clientWelcome,
  commandStatus,
  getInput,
  printClientHelp,
  printQuit,
} from "../internal/gamelogic/gamelogic.js";
import {
  declareAndBind,
  publishJSON,
  SimpleQueueType,
  subscribeJSON,
} from "../internal/pubsub.js";
import {
  ArmyMovesPrefix,
  ExchangePerilDirect,
  ExchangePerilTopic,
  PauseKey,
} from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { handlerMove, handlerPause } from "./handlers.js";

async function main() {
  console.log("Starting Peril client...");
  const connectString = "amqp://guest:guest@localhost:5672/";
  const connection = await amqp.connect(connectString);
  console.log("Connection successful");

  const userName = await clientWelcome();
  // const bound = await declareAndBind(
  //   connection,
  //   ExchangePerilDirect,
  //   `${PauseKey}.${userName}`,
  //   PauseKey,
  //   SimpleQueueType.Transient,
  // );

  const newGameState = new GameState(userName);
  await subscribeJSON(
    connection,
    ExchangePerilDirect,
    `${PauseKey}.${userName}`,
    PauseKey,
    SimpleQueueType.Transient,
    handlerPause(newGameState),
  );
  await subscribeJSON(
    connection,
    ExchangePerilTopic,
    `${ArmyMovesPrefix}.${userName}`,
    `${ArmyMovesPrefix}.*`,
    SimpleQueueType.Transient,
    handlerMove(newGameState),
  );
  const channel = await connection.createConfirmChannel()
  while (true) {
    const command = await getInput();
    switch (command[0]) {
      case "spawn":
        commandSpawn(newGameState, command);
        break;
      case "move":
        const armyMove = commandMove(newGameState, command);
        publishJSON(channel, ExchangePerilTopic, `${ArmyMovesPrefix}.${userName}`, armyMove)
        process.stdout.write('Published successfully')
        break;
      case "status":
        await commandStatus(newGameState);
        break;
      case "help":
        printClientHelp();
        break;
      case "spam":
        console.log("Spamming not allowed yet!");
        break;
      case "quit":
        printQuit();
        await connection.close();
        process.exit(0);
        break;
      default:
        console.log("That is not an accepted command");
        continue;
    }
  }

  // process.on("SIGINT", async () => {
  //   console.log("Program is shutting down");
  // });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
