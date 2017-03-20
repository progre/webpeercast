import * as debugStatic from 'debug';
import * as http from 'http';
import { Downstream } from 'p2pcommunication-common';
import RootServer from '../RootServer';

const debug = debugStatic('p2pcommunication:server');

export async function createServer() {
  let server: RootServer<{}>;
  const httpServer = http.createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.writeHead(200);
    response.end(createDebugJSON((<any>server).localPeer.downstreams));
  });
  server = new RootServer(httpServer);
  return new Promise<{ close(): void }>((resolve, reject) => {
    httpServer.listen(8080, () => {
      debug((new Date()) + ' Server is listening on port 8080');
      resolve(httpServer);
    });
  });
}

function createDebugJSON(
  downstreams: Set<Downstream<{ id: string }>>,
) {
  return JSON.stringify({
    clients: [...downstreams].map(x => ({ id: x.id })),
  });
}
