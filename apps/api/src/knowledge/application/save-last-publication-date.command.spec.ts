import { KnowledgeFeedIngested } from '../domain/events/knowledge-feed-ingested';
import { FeedLastPublicationDateMother } from '../domain/testing/knowledge.mother';
import { SaveLastPublicationDateCommand } from './save-last-publication-date.command';
import { SaveLastPublicationDateOnKnowledgeFeedIngested } from './save-last-publication-date-on-knowledge-feed-ingested';
import {
  InMemoryFeedLastPublicationDateRepository,
  RecordingEventBus,
} from './testing/knowledge-test-doubles';

describe('SaveLastPublicationDateCommand', () => {
  it('handles the feed event, persists its origin and emits a saved event', async () => {
    const repository = new InMemoryFeedLastPublicationDateRepository();
    const bus = new RecordingEventBus();
    const record = FeedLastPublicationDateMother.create();
    const subscriber = new SaveLastPublicationDateOnKnowledgeFeedIngested(
      new SaveLastPublicationDateCommand(repository, bus),
    );
    await subscriber.handle(
      new KnowledgeFeedIngested(
        record.blogName,
        'https://blog.test/feed',
        record.lastPublishedAt,
        new Date().toISOString(),
      ),
    );
    expect(repository.store.get(record.blogName)).toEqual({
      ...record,
      feedUrl: 'https://blog.test/feed',
    });
    expect(bus.ofType('knowledge.feed.last-publication-date.saved')).toHaveLength(1);
  });

  it('does not announce a saved date when persistence fails', async () => {
    const repository = new InMemoryFeedLastPublicationDateRepository();
    jest.spyOn(repository, 'save').mockRejectedValue(new Error('database failed'));
    const bus = new RecordingEventBus();
    await expect(
      new SaveLastPublicationDateCommand(repository, bus).execute({
        ...FeedLastPublicationDateMother.create(),
        feedUrl: 'https://blog.test/feed',
      }),
    ).rejects.toThrow('database failed');
    expect(bus.published).toEqual([]);
  });
});
