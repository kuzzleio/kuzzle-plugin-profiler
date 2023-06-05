export enum ChronoState {
  STOPPED,
  RUNNING,
  PAUSED,
}

export type TimeMeasurementCallback<T> = () => number;

export class Chrono {
  private startTime: number = 0;
  private duration: number = 0;
  private state: ChronoState = ChronoState.STOPPED;

  protected getTime(): number {
    return Date.now();
  }

  public getState(): ChronoState {
    return this.state;
  }

  public start() {
    if (this.state !== ChronoState.STOPPED) {
      return;
    }

    this.startTime = this.getTime();
    this.state = ChronoState.RUNNING;
    this.duration = 0;
  }

  public pause() {
    if (this.state !== ChronoState.RUNNING) {
      return;
    }
    this.state = ChronoState.PAUSED;
    this.duration += this.getTime() - this.startTime;
  }

  public resume() {
    if (this.state !== ChronoState.PAUSED) {
      return;
    }
    this.startTime = this.getTime();
    this.state = ChronoState.RUNNING;
  }

  public stop() {
    if (this.state !== ChronoState.RUNNING) {
      return;
    }
    this.duration += this.getTime() - this.startTime;
    this.state = ChronoState.STOPPED;
  }

  public getDuration(): number {
    if (this.state === ChronoState.RUNNING) {
      return this.getTime() - this.startTime + this.duration;
    }
    return this.duration;
  }
}