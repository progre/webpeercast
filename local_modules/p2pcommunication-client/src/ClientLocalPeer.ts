import {
  Broadcastable,
  LocalPeer,
  OfferRequestData,
  OtherStream,
  PeerType,
  RemotePeer,
  SignalingOfferData,
  Upstream,
} from 'p2pcommunication-common';
import * as declaration from '../index';
import ClientWebSocketConnection from './ClientWebSocketConnection';
import { printError, safe } from './printerror';
import { answerDataChannel, offerDataChannel } from './rtcconnector';
import RTCDataChannelConnection from './RTCDataChannelConnection';

/**
 * It does nothing when it's disconnected with a downstream.
 * It connects to upstream when it's disconnected with a upstream.
 */
export default class ClientLocalPeer<T> implements declaration.LocalPeer<T> {
  readonly localPeer = new LocalPeer<T>(1);
  /** Decide by root server */
  id: string | null;
  private url: string | null;

  debug = {
    hasPeer: (id: string | null) => {
      for (const conn of this.localPeer.otherStreams) {
        if (conn.id === id) {
          return true;
        }
      }
      return false;
    },
    getUpstreams: () => {
      return this.localPeer.upstreams;
    },
    getOtherStreams: () => {
      return this.localPeer.otherStreams;
    },
    getDownstreams: () => {
      return this.localPeer.downstreams;
    },
  };

  onConnected = this.localPeer.onConnected;
  onBroadcastReceived = this.localPeer.onBroadcastReceived;

  constructor(url: string) {
    this.url = url;
    this.startConnectToServer();
  }

  disconnect() {
    this.url = null;
    const peers = (<(Upstream<T> | OtherStream<T>)[]>[...this.localPeer.upstreams])
      .concat([...this.localPeer.otherStreams]);
    for (const peer of peers) {
      peer.disconnect();
    }
  }

  broadcast = (payload: T) => this.localPeer.broadcast(payload);

  private startConnectToServer() {
    if (this.url == null) {
      return;
    }
    const url = this.url;
    try {
      this.id = null;
      const upstream = new RemotePeer(
        '00000000-0000-0000-0000-000000000000',
        new ClientWebSocketConnection(new WebSocket(url)),
      );
      upstream.onIdCreated.subscribe((id) => {
        this.id = id;
      });
      this.setUpstreamEventsTo(upstream);
      this.addUpstream(upstream);
    } catch (e) {
      printError(e);
      setTimeout(
        () => this.startConnectToServer(),
        3 * 1000,
      );
    }
  }

  private async offerNewConnection(
    to: string,
    peerType: PeerType,
    upstream: Upstream<T>,
  ) {
    if (peerType === 'downstream') {
      throw new Error('Assertion error.');
    }
    const peerConnection = new RTCPeerConnection();
    const dataChannel = await offerDataChannel(
      peerConnection,
      to,
      upstream,
    );
    await this.addNewConnection(to, peerConnection, dataChannel, peerType);
  }

  private async answerNewConnection(
    from: string,
    peerType: PeerType,
    offer: RTCSessionDescriptionInit,
    upstream: Upstream<T>,
  ) {
    const peerConnection = new RTCPeerConnection();
    const dataChannel = await answerDataChannel(
      peerConnection,
      from,
      offer,
      upstream,
    );
    await this.addNewConnection(from, peerConnection, dataChannel, peerType);
  }

  private async addNewConnection(
    id: string,
    peerConnection: RTCPeerConnection,
    dataChannel: RTCDataChannel,
    peerType: PeerType,
  ) {
    const peer = new RemotePeer<T>(
      id,
      new RTCDataChannelConnection(peerConnection, dataChannel),
    );
    switch (peerType) {
      case 'upstream':
        this.setUpstreamEventsTo(peer);
        this.addUpstream(peer);
        break;
      case 'otherStream':
        this.localPeer.setOtherStreamEventsTo(peer);
        this.localPeer.addNewOtherStream(peer);
        break;
      case 'downstream':
        await this.localPeer.addNewDownstream(peer);
        break;
      default:
        throw new Error(`Unsupported peerType: ${peerType}`);
    }
  }

  private setUpstreamEventsTo(upstream: RemotePeer<T>) {
    upstream.onOfferRequesting.subscribe(safe(async (data: OfferRequestData) => {
      await this.offerNewConnection(data.to, data.peerType, upstream);
    }));
    upstream.onSignalingOffer.subscribe(safe(async (data: SignalingOfferData) => {
      await this.answerNewConnection(data.from, data.peerType, data.offer, upstream);
    }));
    upstream.onClosed.subscribe(safe(async () => {
      this.localPeer.upstreams.delete(upstream);
      if (this.localPeer.upstreams.size <= 0) {
        this.startConnectToServer();
      }
    }));
    upstream.onBroadcasting.subscribe((data) => {
      this.onBroadcastReceived.next(data);
      broadcastTo(data, this.localPeer.downstreams);
    });
  }

  private addUpstream(upstream: RemotePeer<T>) {
    this.localPeer.upstreams.add(upstream);
    this.onConnected.next({ peerType: 'upstream', remotePeer: upstream });
  }
}

function broadcastTo<T>(data: T, streams: Set<Broadcastable<T>>) {
  for (const peer of streams) {
    peer.broadcast(data);
  }
}
