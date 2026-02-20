import type { Channel, ConfirmChannel } from "amqplib";
import { buffer } from "stream/consumers";
import amqp from "amqplib";

export enum SimpleQueueType {
  Durable,
  Transient,
}

export function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routhingKey: string,
  value: T,
) {
  const contentString = JSON.stringify(value);
  const contentBuffer = Buffer.from(contentString, "utf8");
  ch.publish(exchange, routhingKey, contentBuffer, {
    contentType: "application/json",
  });
}

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const options = {
    durable: true,
    autoDelete: false,
    exclusive: false,
  };

  if (queueType == SimpleQueueType.Transient) {
    options.autoDelete = true;
    options.durable = false;
    options.exclusive = true;
  }

  const channel = await conn.createChannel();
  const queue = await channel.assertQueue(queueName, options);

  const queueBind = await channel.bindQueue(queueName, exchange, key);
  return [channel, queue];
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => void,
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

  
  await channel.consume(queue.queue, (msg: amqp.ConsumeMessage | null)=>{
    if(!msg){
      return
    }
    const parsedJSON = JSON.parse(msg.content.toString())
    handler(parsedJSON)
    channel.ack(msg)
    return
  });
}
