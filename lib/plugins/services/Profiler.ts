import { createHook, AsyncHook, AsyncLocalStorage } from 'node:async_hooks';
import { Chrono } from '../../common/Chrono';
import { ProfilerStore } from '../../common/ProfilerStore';
import { Stack, StackBuilder } from '../../common/Stackbuilder';
import { ProfilerRecord } from '../../common/ProfilerRecord';
import { Request } from 'kuzzle';
import { performance } from 'node:perf_hooks';

export type ProfilerConfig = {
  capturePipeArguments?: boolean;
  captureHookArguments?: boolean;
  captureAskArguments?: boolean;

  capturePipeResult?: boolean;
  captureHookResult?: boolean;
  captureAskResult?: boolean;
}

export class Profiler {
  private oldPipeFunction: any;
  private oldEventFunction: any;
  private oldAskFunction: any;
  private oldFunnelExecuteFunction: any;
  private oldFunnelPluginExecuteFunction: any;

  private running: boolean = false;
  private static asyncLocalStorage: AsyncLocalStorage<ProfilerStore> = new AsyncLocalStorage();
  private static currentStore: ProfilerStore | null = null;
  private asyncHook: AsyncHook;
  private records: Stack<ProfilerRecord>[] = [];

  private config: ProfilerConfig | null;

  constructor() {
    this.asyncHook = createHook({
      init: this.asyncHookInit.bind(this),
      before: this.asyncHookBefore.bind(this),
      after: this.asyncHookAfter.bind(this),
      destroy: this.asyncHookDestroy.bind(this),
      promiseResolve: this.asyncHookPromiseResolve.bind(this),
    });
  }

  getTime(): number {
    return performance.now();
  }

  start(config: ProfilerConfig = {}) {
    if (this.running) {
      return;
    }

    this.config = config;

    this.records = [];
    this.running = true;

    this.oldPipeFunction = global.kuzzle.pipe.bind(global.kuzzle);
    this.oldEventFunction = global.kuzzle.emit.bind(global.kuzzle);
    this.oldAskFunction = global.kuzzle.ask.bind(global.kuzzle);
    this.oldFunnelExecuteFunction = global.kuzzle.funnel.execute.bind(global.kuzzle.funnel);
    this.oldFunnelPluginExecuteFunction = global.kuzzle.funnel.executePluginRequest.bind(global.kuzzle.funnel);

    try {
      this.asyncHook.enable();
      global.kuzzle.pipe = this.pipeHook.bind(this);
      global.kuzzle.emit = this.eventHook.bind(this);
      global.kuzzle.ask = this.askHook.bind(this);
      global.kuzzle.funnel.execute = this.funnelExecuteHook.bind(this);
      global.kuzzle.funnel.executePluginRequest = this.funnelPluginExecuteHook.bind(this);
    } catch (e) {
      this.restore();
      this.running = false;
      this.asyncHook.disable();
      throw e;
    }
  }

  private reagregateRecords(stack: Stack<ProfilerRecord>) {
    if (stack.children.length === 0) {
      return stack.value?.realTime || 0;
    }

    let realTime = 0;
    for (const child of stack.children) {
      realTime += this.reagregateRecords(child);
    }
    if (stack.value) {
      stack.value.realTime = Math.max(realTime, stack.value.realTime || 0);
    }

    return realTime;
  }

  stop(): Stack<ProfilerRecord>[] {
    if (!this.running) {
      return;
    }

    this.restore();

    this.asyncHook.disable();

    this.running = false;

    for (const stack of this.records) {
      this.reagregateRecords(stack);
    }

    return this.records;
  }

  restore() {
    global.kuzzle.pipe = this.oldPipeFunction || global.kuzzle.pipe;
    global.kuzzle.emit = this.oldEventFunction || global.kuzzle.emit;
    global.kuzzle.ask = this.oldAskFunction || global.kuzzle.ask;
    global.kuzzle.funnel.execute = this.oldFunnelExecuteFunction || global.kuzzle.funnel.execute;
    global.kuzzle.funnel.executePluginRequest = this.oldFunnelPluginExecuteFunction || global.kuzzle.funnel.executePluginRequest;

    this.oldPipeFunction = null;
    this.oldEventFunction = null;
    this.oldAskFunction = null;
    this.oldFunnelExecuteFunction = null;
    this.oldFunnelPluginExecuteFunction = null;
  }

  private async pipeHook(name: string, ...args: any[]) {
    const store = Profiler.asyncLocalStorage.getStore();

    let startCpuTimer: number;
    let startRealTimer: number;
    let record: ProfilerRecord;

    if (store) {
      startCpuTimer = store.chrono.getDuration();
      startRealTimer = this.getTime();

      let filteredArgs;
      if (this.config.capturePipeArguments) {
        try {
          filteredArgs = JSON.parse(JSON.stringify(args));
        }
        catch (e) {
          filteredArgs = "Circular reference, cannot be serialized";
        }
      }

      record = {
        type: "pipe",
        name,
        args: filteredArgs,
        timestamp: Date.now(),
      };

      store.stack.push(record);
    }

    let result = await this.oldPipeFunction(name, ...args);

    if (store) {
      record.cpuTime = store.chrono.getDuration() - startCpuTimer;
      record.realTime = this.getTime() - startRealTimer;

      if (record.type === "pipe" && this.config.capturePipeResult) {
        try {
          record.result = JSON.parse(JSON.stringify(result));
        } catch (e) {
          record.result = "Circular reference, cannot be serialized";
        }
      }
      store.stack.pop();
    }
    return result;
  }

  private async eventHook(name: string, ...args: any[]) {
    const store = Profiler.asyncLocalStorage.getStore();

    let startCpuTimer: number;
    let startRealTimer: number;
    let record: ProfilerRecord;

    if (store) {
      startCpuTimer = store.chrono.getDuration();
      startRealTimer = this.getTime();

      let filteredArgs;
      if (this.config.captureHookArguments) {
        try {
          filteredArgs = JSON.parse(JSON.stringify(args));
        }
        catch (e) {
          filteredArgs = "Circular reference, cannot be serialized";
        }
      }

      record = {
        type: "hook",
        name,
        args: filteredArgs,
        timestamp: Date.now(),
      };

      store.stack.push(record);
    }

    let result = await this.oldEventFunction(name, ...args);

    if (store) {
      record.cpuTime = store.chrono.getDuration() - startCpuTimer;
      record.realTime = this.getTime() - startRealTimer;

      if (record.type === "hook" && this.config.captureHookResult) {
        try {
          record.result = JSON.parse(JSON.stringify(result));
        } catch (e) {
          record.result = "Circular reference, cannot be serialized";
        }
      }
      store.stack.pop();
    }
    return result;
  }

  private async askHook(name: string, ...args: any[]) {
    const store = Profiler.asyncLocalStorage.getStore();

    let startCpuTimer: number;
    let startRealTimer: number;
    let record: ProfilerRecord;

    if (store) {
      startCpuTimer = store.chrono.getDuration();
      startRealTimer = this.getTime();

      let filteredArgs;
      if (this.config.captureAskArguments) {
        try {
          filteredArgs = JSON.parse(JSON.stringify(args));
        }
        catch (e) {
          filteredArgs = "Circular reference, cannot be serialized";
        }
      }

      record = {
        type: "ask",
        name,
        args: filteredArgs,
        timestamp: Date.now(),
      };

      store.stack.push(record);
    }

    let result = await this.oldAskFunction(name, ...args);

    if (store) {
      record.cpuTime = store.chrono.getDuration() - startCpuTimer;
      record.realTime = this.getTime() - startRealTimer;

      if (record.type === "ask" && this.config.captureAskResult) {
        try {
          record.result = JSON.parse(JSON.stringify(result));
        } catch (e) {
          record.result = "Circular reference, cannot be serialized";
        }
      }
      store.stack.pop();
    }
    return result;
  }

  private async funnelExecuteHook(request: Request, callback: any) {
    const chrono = new Chrono();
    let store: ProfilerStore = {
      id: request.internalId,
      chrono: chrono,
      stack: new StackBuilder<ProfilerRecord>(),
    };


    let record: ProfilerRecord = {
      type: "request",
      timestamp: request.timestamp,
      requestId: request.id,
      request: {
        controller: request.input.controller,
        action: request.input.action,
        args: request.input.args,
        body: request.input.body,
        headers: request.input.headers,
        protocol: request.context.protocol,
        volatile: request.input.volatile,
      }
    };
    store.stack.push(record);

    let result;
    Profiler.asyncLocalStorage.run(store, () => {
      chrono.start();
      let startRealTimer = this.getTime();
      Profiler.currentStore = store;

      result = this.oldFunnelExecuteFunction(request, (...args: any[]) => {
        chrono.stop();

        // console.log(`Funnel execute: ${request.input.controller}/${request.input.action} finished`, request);

        record.cpuTime = chrono.getDuration();
        record.realTime = this.getTime() - startRealTimer;

        if (record.type === "request") {
          record.response = {
            error: request.error,
            headers: request.response.headers,
            result: JSON.parse(JSON.stringify(request.response.result)),
            status: request.status,
          };

          store.stack.pop();
        }

        this.records.push(store.stack.getRoot());


        return callback(...args);
      });
    });

    return result;
  }

  private async funnelPluginExecuteHook(request: Request) {
    const store = Profiler.asyncLocalStorage.getStore();

    let startCpuTimer: number;
    let startRealTimer: number;
    let record: ProfilerRecord;

    if (store) {
      startCpuTimer = store.chrono.getDuration();
      startRealTimer = this.getTime();

      record = {
        type: "request",
        timestamp: request.timestamp,
        requestId: request.id,
        request: {
          controller: request.input.controller,
          action: request.input.action,
          args: request.input.args,
          body: request.input.body,
          headers: request.input.headers,
          protocol: request.context.protocol,
          volatile: request.input.volatile,
        }
      };

      store.stack.push(record);
    }

    let result = await this.oldFunnelPluginExecuteFunction(request);

    if (store) {
      console.log(`Funnel plugin execute: ${request.input.controller}/${request.input.action} finished`, request);
      record.cpuTime = store.chrono.getDuration() - startCpuTimer;
      record.realTime = this.getTime() - startRealTimer;

      if (record.type === "request") {
        record.response = {
          error: request.error,
          headers: request.response.headers,
          result: JSON.parse(JSON.stringify(request.response.result)),
          status: request.status,
        };
      }

      store.stack.pop();
    }
    return result;
  }

  private contextSwitch(storage: ProfilerStore | undefined) {
    if (Profiler.currentStore && storage && Profiler.currentStore.id === storage.id) {
      return;
    }

    if (Profiler.currentStore) {
      Profiler.currentStore.chrono.pause();
    }
    Profiler.currentStore = storage;
    if (Profiler.currentStore) {
      Profiler.currentStore.chrono.resume();
    }
  }


  private asyncHookInit(asyncId: number, type: string, triggerAsyncId: number, resource: object) {
    const store = Profiler.asyncLocalStorage.getStore();

    this.contextSwitch(store);
  }

  private asyncHookBefore(asyncId: number) {
    const store = Profiler.asyncLocalStorage.getStore();

    this.contextSwitch(store);
  }

  private asyncHookAfter(asyncId: number) {
    const store = Profiler.asyncLocalStorage.getStore();

    this.contextSwitch(store);
  }

  private asyncHookDestroy(asyncId: number) {
    const store = Profiler.asyncLocalStorage.getStore();

    this.contextSwitch(store);
  }

  private asyncHookPromiseResolve(asyncId: number) {
    const store = Profiler.asyncLocalStorage.getStore();

    this.contextSwitch(store);

  }
}