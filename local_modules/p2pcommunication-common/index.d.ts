import { Subscribable } from "rxjs/Observable";
export { Subscribable }

export interface RemotePeer<T> {
    readonly id: string;

    onClosed: Subscribable<{}>;
    onOfferRequesting: Subscribable<string>;
    onOffering: Subscribable<RTCOfferData>;
    onAnswering: Subscribable<RTCAnswerData>;
    onIceCandidateEmitting: Subscribable<IceCandidateData>;
    onBroadcasting: Subscribable<T>;

    send(obj: { type: string, payload: Object }): void;
    disconnect(): void;
}

export type RTCOfferData = { from: string, offer: RTCSessionDescriptionInit };
export type RTCAnswerData = { from: string, answer: RTCSessionDescriptionInit };
export type IceCandidateData = { from: string, iceCandidate: RTCIceCandidateInit };