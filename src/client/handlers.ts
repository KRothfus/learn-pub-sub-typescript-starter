
import type {
  ArmyMove,
  RecognitionOfWar,
} from "../internal/gamelogic/gamedata.js";
import {
  GameState,
  type PlayingState,
} from "../internal/gamelogic/gamestate.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";
import {
  Acktype,
  publishJSON,
  SimpleQueueType,
  subscribeJSON,
} from "../internal/pubsub.js";
import {
  ExchangePerilTopic,
  WarRecognitionsPrefix,
} from "../internal/routing/routing.js";
import type { Channel, ConfirmChannel } from "amqplib";
import { publishGameLog } from "./index.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => Acktype {
  return function handle(ps: PlayingState) {
    handlePause(gs, ps);
    process.stdout.write("> ");
    return Acktype.Ack;
  };
}
export function handlerMove(
  gs: GameState,
  ch: ConfirmChannel,
): (move: ArmyMove) => Promise<Acktype> {
  return async function handle(move: ArmyMove) {
    const outcome = handleMove(gs, move);
    process.stdout.write("> ");
    if (outcome == MoveOutcome.Safe) {
      return Acktype.Ack;
    } else if (outcome == MoveOutcome.MakeWar) {
      const rw: RecognitionOfWar = {
        attacker: move.player,
        defender: gs.getPlayerSnap(),
      };
      try {
        await publishJSON(
          ch,
          ExchangePerilTopic,
          `${WarRecognitionsPrefix}.${gs.getUsername()}`,
          rw,
        );
      } catch {
        return Acktype.NackRequeue;
      }
      return Acktype.Ack;
    } else {
      return Acktype.NackDiscard;
    }
  };
}

export function handlerWar(
  gs: GameState,
  ch: ConfirmChannel,
): (rw: RecognitionOfWar) => Promise<Acktype> {
  return async function handle(rw: RecognitionOfWar) {
    const resolution = handleWar(gs, rw);
    let msg = "";
    switch (resolution.result) {
      case WarOutcome.Draw:
        msg = `A war betwen ${resolution.attacker} and ${resolution.defender} resulted in a draw`;
        break;
      case WarOutcome.YouWon || WarOutcome.OpponentWon:
        msg = `${resolution.winner} won a war against ${resolution.loser}`;
        break;
      default:
        console.log("Was either not involved or had no units");
    }
    try {
      publishGameLog(ch, gs.getUsername(), msg);
    } catch {
      return Acktype.NackRequeue;
    }
    process.stdout.write("> ");
    switch (resolution.result) {
      case WarOutcome.NotInvolved:
        return Acktype.NackRequeue;

      case WarOutcome.NoUnits:
        return Acktype.NackDiscard;

      case WarOutcome.OpponentWon:
        return Acktype.Ack;

      case WarOutcome.YouWon:
        return Acktype.Ack;

      case WarOutcome.Draw:
        return Acktype.Ack;

      default:
        console.error("Not recognized");
        return Acktype.NackDiscard;
    }
  };
}
