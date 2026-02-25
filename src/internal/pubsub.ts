import type { Channel} from "amqplib";
import amqp from "amqplib";
import { writeLog } from "./gamelogic/logs.js";

export enum SimpleQueueType {
  Durable,
  Transient,
}

export enum Acktype {
  Ack,
  NackRequeue,
  NackDiscard,
}

export function publishJSON<T>(
  ch: Channel,
  exchange: string,
  routingKey: string,
  value: T,
) {
  const contentString = JSON.stringify(value);
  const contentBuffer = Buffer.from(contentString, "utf8");
  ch.publish(exchange, routingKey, contentBuffer, {
    contentType: "application/json",
  });
}
// I thought I lost you!

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const queueOptions: amqp.Options.AssertQueue = {
    durable: true,
    autoDelete: false,
    exclusive: false,
  };

  if (queueType == SimpleQueueType.Transient) {
    queueOptions.autoDelete = true;
    queueOptions.durable = false;
    queueOptions.exclusive = true;
  }

  const channel = await conn.createChannel();
  const q = await channel.assertQueue(queueName, queueOptions);
 await channel.bindQueue(q.queue, exchange, key);
  return [channel, q];
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => Promise<Acktype>,
): Promise<void> {
  const [channel, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType,
  );
  if (!queue) {
    throw new Error("nope!");
  }

  
  await channel.consume(queue.queue, async (msg: amqp.ConsumeMessage | null)=>{
    if(!msg){
      return
    }
    const parsedJSON = JSON.parse(msg.content.toString())

    const type = await handler(parsedJSON)
    switch(type){
      case Acktype.Ack:
        channel.ack(msg)
        writeLog({
          currentTime: new Date(),
          message: msg,
          username: ""
        })
        break;
      case Acktype.NackRequeue:
        channel.nack(msg, false, true)
        break;
      case Acktype.NackDiscard:
        channel.nack(msg, false, false)
        break;

    }
    return
  });
}


