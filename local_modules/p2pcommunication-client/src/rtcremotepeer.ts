import * as Rx from "rxjs";
import { RemotePeer } from "p2pcommunication-common";

export default class RTCRemotePeer<T> implements RemotePeer<T> {
    onClosed = new Rx.Subject();
    onBroadcasting = new Rx.Subject<T>();

    constructor(
        public readonly id: string,
        private peerConnection: RTCPeerConnection,
        private dataChannel: RTCDataChannel,
    ) {
        dataChannel.addEventListener("message", (e: MessageEvent) => {
            if (e.type !== "message") {
                throw new Error(`Unsupported message type: ${e.type}`);
            }
            let data = JSON.parse(e.data);
            if (data.type !== "broadcast") {
                throw new Error(`Unsupported data type: ${e.type}`);
            }
            this.onBroadcasting.next(data.payload);
        });
        dataChannel.addEventListener("error", (e: ErrorEvent) => {
            console.error(e);
        });
        dataChannel.addEventListener("close", (e: Event) => {
            this.onClosed.next();
            this.onClosed.complete();
        });
    }

    broadcast(payload: T) {
        this.dataChannel.send(JSON.stringify({ type: "broadcast", payload }));
    }

    disconnect() {
        this.dataChannel.close();
        this.peerConnection.close();
    }
}
