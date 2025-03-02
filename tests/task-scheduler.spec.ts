import { Mock } from 'vitest';
import TaskScheduler from '../plugins/task-scheduler.js';
import { SquadServer } from '../types/SquadJS.js';

describe('task-scheduler.js', () => {

  const squadServer: Partial<SquadServer> = {
    emit: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
  });


  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('schedules a task', async () => {
    const plugin = new TaskScheduler(squadServer, {
      tasks: [
        {
          name: 'foobar',
          cron: '0 * * * *', // every hour
          event: 'hello',
        },
      ],
    });

    await plugin.mount();

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(squadServer.emit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(squadServer.emit).toHaveBeenCalledExactlyOnceWith('hello');

    (squadServer.emit as Mock).mockClear();

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(squadServer.emit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(squadServer.emit).toHaveBeenCalledExactlyOnceWith('hello');

    plugin.unmount();
  });

});
