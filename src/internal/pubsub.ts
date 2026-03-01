import type { Channel } from "amqplib";
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
    arguments: {"x-dead-letter-exchange":"peril_dlx"},
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
  handler: (data: T) => Acktype,
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

  await channel.consume(
    queue.queue,
    async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) {
        return;
      }
      let type;
      const userName = queueName.split(".")[1] as string
      try {
        const parsedJSON = JSON.parse(msg.content.toString()) as T;

        type = handler(parsedJSON);
      } catch {
        type = Acktype.NackDiscard;
      }
      switch (type) {
        case Acktype.Ack:
          channel.ack(msg);
          writeLog({
            currentTime: new Date(),
            message: msg.content.toString(),
            username: userName,
          });
          break;
        case Acktype.NackRequeue:
          channel.nack(msg, false, true);
          writeLog({
            currentTime: new Date(),
            message: msg.content.toString(),
            username: userName,
          });
          break;
        case Acktype.NackDiscard:
          channel.nack(msg, false, false);
          writeLog({
            currentTime: new Date(),
            message: msg.content.toString(),
            username: userName,
          });
          break;
      }
      return;
    },
  );
}
