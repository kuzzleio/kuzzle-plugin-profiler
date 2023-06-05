import { Backend } from "kuzzle";
import { ProfilerPlugin } from "./plugins/ProfilerPlugin";

export type MyApplicationConfig = {
  someValue: string;

  another: {
    value: number;
  };
};

export class MyApplication extends Backend {
  private profiler = new ProfilerPlugin();

  get appConfig() {
    return this.config.content.application as MyApplicationConfig;
  }

  constructor() {
    super("my-application");

    this.pipe.register("request:beforeExecution", async (request) => {
      console.log("beforeExecution", request);
      try {
        await this.sdk.document.create("my-index", "my-collection", { foo: "bar" });
      } catch (e) {
        console.error(e);
      }
      return request;
    });

    this.plugin.use(this.profiler);
  }

  async start() {
    await super.start();

    this.log.info("Application started");
  }
}
