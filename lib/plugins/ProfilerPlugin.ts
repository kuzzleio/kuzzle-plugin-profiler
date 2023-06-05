import { JSONObject, KuzzleRequest, Plugin, PluginContext } from "kuzzle";
import { Profiler } from "./services/Profiler";

export class ProfilerPlugin extends Plugin {
  private profiler: Profiler = new Profiler();

  constructor() {
    super({
      kuzzleVersion: ">=2.14.0 <3",
    });
  }

  init(config: JSONObject, context: PluginContext) {
    
    this.api = {
      profiler: {
        actions: {
          startProfiler: {
            handler: (request: KuzzleRequest) => this.startProfiler(request),
            http: [{ verb: "post", path: "startProfiler" }],
          },
          stopProfiler: {
            handler: (request: KuzzleRequest) => this.stopProfiler(request),
            http: [{ verb: "post", path: "stopProfiler" }],
          },
        }
      }
    }

  }

  async startProfiler(request: KuzzleRequest) {
    const captureAskArguments = request.getBodyBoolean("captureAskArguments");
    const captureAskResult = request.getBodyBoolean("captureAskResult");
    const captureHookArguments = request.getBodyBoolean("captureHookArguments");
    const captureHookResult = request.getBodyBoolean("captureHookResult");
    const capturePipeArguments = request.getBodyBoolean("capturePipeArguments");
    const capturePipeResult = request.getBodyBoolean("capturePipeResult");

    return this.profiler.start({
      captureAskArguments,
      captureAskResult,
      captureHookArguments,
      captureHookResult,
      capturePipeArguments,
      capturePipeResult,
    });
  }

  async stopProfiler(request: KuzzleRequest) {
    return this.profiler.stop();
  }
  
}