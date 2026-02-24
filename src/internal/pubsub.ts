import type { Channel} from "amqplib";
import amqp from "amqplib";

export enum SimpleQueueType {
  Durable,
  Transient,
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
  handler: (data: T) => Channel,
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

    const type = handler(parsedJSON)
    switch(type){
      case "Ack":
        break;
      case "NackRequeue":
        channel.nack(msg, false, true)
        break;
      case "NackDiscard":
        channel.nack(msg, false, false)
        break;

    }
    channel.ack(msg)
    return
  });
}


