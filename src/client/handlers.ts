import type { ArmyMove } from "../internal/gamelogic/gamedata.js";
import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { Acktype } from "../internal/pubsub.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => Acktype{
    return function handle(ps: PlayingState){
        handlePause(gs,ps);
        process.stdout.write("> ")
        return Acktype.Ack
    };
}
export function handlerMove(gs: GameState):(move: ArmyMove)=>Acktype{
    return function handle(move: ArmyMove){
        const outcome = handleMove(gs, move)
        process.stdout.write("> ")
        if(outcome == MoveOutcome.Safe || outcome == MoveOutcome.MakeWar){
            return Acktype.Ack
        } else {
            return Acktype.NackDiscard
        }
    }
}