const ms = require("ms");
const _ = require("lodash");
const { setWorldConstructor } = require("cucumber");

require("./assertions");

class KuzzleWorld {
  constructor(attach, parameters) {
    this.attach = attach.attach;
    this.parameters = parameters;

    this.host = process.env.KUZZLE_HOST || "localhost";
    this.port = process.env.KUZZLE_PORT || "7512";

    // Intermediate steps should store values inside this object
    this.props = {};
  }

  parseObject(dataTable) {
    const rawContent = dataTable.rowsHash(),
      content = {};

    for (const [path, value] of Object.entries(rawContent)) {
      if (value.includes("_AGO_")) {
        // format: "_5m_AGO_"
        const timeAgo = ms(value.split("_")[1]);

        _.set(content, path, this.props.now - timeAgo);
      } else {
        _.set(content, path, eval(`var o = ${value}; o`));
      }
    }

    return content;
  }

  parseObjectArray(dataTable) {
    const objectArray = [],
      keys = dataTable.rawTable[0];

    for (let i = 1; i < dataTable.rawTable.length; i++) {
      const object = {},
        rawObject = dataTable.rawTable[i];

      for (let j = 0; j < keys.length; j++) {
        if (rawObject[j] !== "-") {
          _.set(object, keys[j], eval(`var o = ${rawObject[j]}; o`));
        }
      }

      objectArray.push(object);
    }

    return objectArray;
  }

  /**
   * Await the promise provided in the argument, and throw an error depending
   * on whether we expect the action to succeed or not
   *
   * @param  {Promise} promise
   * @param  {boolean} failureExpected
   * @param  {string} [message] optional custom error message
   * @throws If expectations are not met
   */
  async tryAction(promise, failureExpected, message) {
    this.props.error = null;

    try {
      this.props.result = await promise;
    } catch (e) {
      this.props.error = e;
    }

    if (failureExpected && !this.props.error) {
      throw new Error(message || "Expected action to fail");
    }

    if (!failureExpected && this.props.error) {
      throw this.props.error;
    }
  }

  /**
   * Re-try to validate the same predicate N times.
   *
   * By default, it will wait for a maximum of 5 seconds.
   *
   * You may want to increase cucumber default step timeout:
   * `Then(..., { timeout: 5000 }, async function (...) {`
   *
   * @param predicate Function throwing an exception when fail to validate
   * @param options.retries Max number of retries (`100`)
   * @param options.interval Interval between retries in ms (`50`)
   */
  async retry(predicate, { retries = 100, interval = 50 } = {}) {
    let count = 0;

    while (count < retries) {
      try {
        await predicate();
        count = retries;
      } catch (error) {
        if (count === retries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, interval));

        count++;
      }
    }
  }
}

setWorldConstructor(KuzzleWorld);

module.exports = KuzzleWorld;
