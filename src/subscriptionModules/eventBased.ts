import { ApiPromise} from '@polkadot/api';
import {
    AuctionData
} from '../types';
import { Event } from '@polkadot/types/interfaces';
import { extractBidAcceptedInfoFromEvent, isAuctionBidAcceptedEvent } from '../utils';
import { ISubscriptionModule, SubscriptionModuleConstructorParams } from './ISubscribscriptionModule';
import { IPersister } from '../persister/IPersister';
import { LoggerSingleton } from '../logger';

export class EventBased implements ISubscriptionModule{

    private readonly api: ApiPromise
    private readonly networkId: string
    private readonly persister: IPersister
    private readonly logger = LoggerSingleton.getInstance()

    
    constructor(params: SubscriptionModuleConstructorParams) {
      this.api = params.api
      this.networkId = params.networkId
      this.persister = params.persister
    }

    public subscribe = async (): Promise<void> => {
      await this._handleEventsSubscriptions()
      this.logger.info(`Event Based Module subscribed...`)
    }

    private _handleEventsSubscriptions = async (): Promise<void> => {
      this.api.query.system.events((events) => {

        events.forEach(async (record) => {
          const { event } = record;

          await this._handleAuctionEvents(event)

        })
      })
    }

    private _handleAuctionEvents = async (event: Event): Promise<void> => {
      if (isAuctionBidAcceptedEvent(event)) {
        this._bidAcceptedHandler(event)
      }
    }

    private _bidAcceptedHandler = async (event: Event): Promise<void> => {
      this.logger.debug('Auctions Bid Accepted Event Received')
      const [timestamp, blockNumber] = await Promise.all([
        this.api.query.timestamp.now(),
        this.api.query.system.number()
      ]);
      const bidInfo = extractBidAcceptedInfoFromEvent(event)
      this.logger.debug(`${JSON.stringify(bidInfo)}`)
      const {who} = bidInfo
      this.logger.info(`New Auctions Bid Accepted Event from ${who} detected`)
      this._notifyNewAuctionsBidAccepted({
        ...bidInfo,
        networkId: this.networkId,
        blockNumber:blockNumber.toNumber(),
        timestamp:timestamp.toNumber()
      })
    }
    
    private _notifyNewAuctionsBidAccepted = async (data: AuctionData): Promise<void> => {
      this.logger.debug(`Delegating to the Notifier the New Auctions Bid Accepted Event notification...`)
      this.logger.debug(JSON.stringify(data))
      this.persister.newAuctionsBidAccepted(data)
    }

}
