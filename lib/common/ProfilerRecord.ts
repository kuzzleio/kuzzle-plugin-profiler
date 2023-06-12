export type ProfilerRecord = {
  type: 'request';
  timestamp?: number;
  cpuTime?: number;
  realTime?: number;
  requestId?: string;
  request?: {
    controller?: string;
    action?: string;
    protocol?: string;
    body?: any;
    headers?: any;
    args?: any;
    volatile?: any;
  }
  response?: {
    status?: number;
    error?: any;
    result?: any;
    headers?: any;
  }
} | {
  type: 'pipe' | 'hook' | 'ask';
  name?: string;
  cpuTime?: number;
  realTime?: number;
  timestamp?: number;
  args?: any[];
  result?: any;
};