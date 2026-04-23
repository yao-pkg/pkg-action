import { createRequire as __pkgActionCreateRequire } from 'node:module';
const require = __pkgActionCreateRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf, __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(x, {
  get: (a, b) => (typeof require < "u" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require < "u") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: !0 });
}, __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: !0 }) : target,
  mod
));

// node_modules/tunnel/lib/tunnel.js
var require_tunnel = __commonJS({
  "node_modules/tunnel/lib/tunnel.js"(exports) {
    "use strict";
    var net = __require("net"), tls = __require("tls"), http = __require("http"), https = __require("https"), events2 = __require("events"), assert = __require("assert"), util = __require("util");
    exports.httpOverHttp = httpOverHttp2;
    exports.httpsOverHttp = httpsOverHttp2;
    exports.httpOverHttps = httpOverHttps2;
    exports.httpsOverHttps = httpsOverHttps2;
    function httpOverHttp2(options) {
      var agent = new TunnelingAgent(options);
      return agent.request = http.request, agent;
    }
    function httpsOverHttp2(options) {
      var agent = new TunnelingAgent(options);
      return agent.request = http.request, agent.createSocket = createSecureSocket, agent.defaultPort = 443, agent;
    }
    function httpOverHttps2(options) {
      var agent = new TunnelingAgent(options);
      return agent.request = https.request, agent;
    }
    function httpsOverHttps2(options) {
      var agent = new TunnelingAgent(options);
      return agent.request = https.request, agent.createSocket = createSecureSocket, agent.defaultPort = 443, agent;
    }
    function TunnelingAgent(options) {
      var self = this;
      self.options = options || {}, self.proxyOptions = self.options.proxy || {}, self.maxSockets = self.options.maxSockets || http.Agent.defaultMaxSockets, self.requests = [], self.sockets = [], self.on("free", function(socket, host, port, localAddress) {
        for (var options2 = toOptions(host, port, localAddress), i = 0, len = self.requests.length; i < len; ++i) {
          var pending = self.requests[i];
          if (pending.host === options2.host && pending.port === options2.port) {
            self.requests.splice(i, 1), pending.request.onSocket(socket);
            return;
          }
        }
        socket.destroy(), self.removeSocket(socket);
      });
    }
    util.inherits(TunnelingAgent, events2.EventEmitter);
    TunnelingAgent.prototype.addRequest = function(req, host, port, localAddress) {
      var self = this, options = mergeOptions({ request: req }, self.options, toOptions(host, port, localAddress));
      if (self.sockets.length >= this.maxSockets) {
        self.requests.push(options);
        return;
      }
      self.createSocket(options, function(socket) {
        socket.on("free", onFree), socket.on("close", onCloseOrRemove), socket.on("agentRemove", onCloseOrRemove), req.onSocket(socket);
        function onFree() {
          self.emit("free", socket, options);
        }
        function onCloseOrRemove(err) {
          self.removeSocket(socket), socket.removeListener("free", onFree), socket.removeListener("close", onCloseOrRemove), socket.removeListener("agentRemove", onCloseOrRemove);
        }
      });
    };
    TunnelingAgent.prototype.createSocket = function(options, cb) {
      var self = this, placeholder = {};
      self.sockets.push(placeholder);
      var connectOptions = mergeOptions({}, self.proxyOptions, {
        method: "CONNECT",
        path: options.host + ":" + options.port,
        agent: !1,
        headers: {
          host: options.host + ":" + options.port
        }
      });
      options.localAddress && (connectOptions.localAddress = options.localAddress), connectOptions.proxyAuth && (connectOptions.headers = connectOptions.headers || {}, connectOptions.headers["Proxy-Authorization"] = "Basic " + new Buffer(connectOptions.proxyAuth).toString("base64")), debug2("making CONNECT request");
      var connectReq = self.request(connectOptions);
      connectReq.useChunkedEncodingByDefault = !1, connectReq.once("response", onResponse), connectReq.once("upgrade", onUpgrade), connectReq.once("connect", onConnect), connectReq.once("error", onError), connectReq.end();
      function onResponse(res) {
        res.upgrade = !0;
      }
      function onUpgrade(res, socket, head) {
        process.nextTick(function() {
          onConnect(res, socket, head);
        });
      }
      function onConnect(res, socket, head) {
        if (connectReq.removeAllListeners(), socket.removeAllListeners(), res.statusCode !== 200) {
          debug2(
            "tunneling socket could not be established, statusCode=%d",
            res.statusCode
          ), socket.destroy();
          var error2 = new Error("tunneling socket could not be established, statusCode=" + res.statusCode);
          error2.code = "ECONNRESET", options.request.emit("error", error2), self.removeSocket(placeholder);
          return;
        }
        if (head.length > 0) {
          debug2("got illegal response body from proxy"), socket.destroy();
          var error2 = new Error("got illegal response body from proxy");
          error2.code = "ECONNRESET", options.request.emit("error", error2), self.removeSocket(placeholder);
          return;
        }
        return debug2("tunneling connection has established"), self.sockets[self.sockets.indexOf(placeholder)] = socket, cb(socket);
      }
      function onError(cause) {
        connectReq.removeAllListeners(), debug2(
          `tunneling socket could not be established, cause=%s
`,
          cause.message,
          cause.stack
        );
        var error2 = new Error("tunneling socket could not be established, cause=" + cause.message);
        error2.code = "ECONNRESET", options.request.emit("error", error2), self.removeSocket(placeholder);
      }
    };
    TunnelingAgent.prototype.removeSocket = function(socket) {
      var pos = this.sockets.indexOf(socket);
      if (pos !== -1) {
        this.sockets.splice(pos, 1);
        var pending = this.requests.shift();
        pending && this.createSocket(pending, function(socket2) {
          pending.request.onSocket(socket2);
        });
      }
    };
    function createSecureSocket(options, cb) {
      var self = this;
      TunnelingAgent.prototype.createSocket.call(self, options, function(socket) {
        var hostHeader = options.request.getHeader("host"), tlsOptions = mergeOptions({}, self.options, {
          socket,
          servername: hostHeader ? hostHeader.replace(/:.*$/, "") : options.host
        }), secureSocket = tls.connect(0, tlsOptions);
        self.sockets[self.sockets.indexOf(socket)] = secureSocket, cb(secureSocket);
      });
    }
    function toOptions(host, port, localAddress) {
      return typeof host == "string" ? {
        host,
        port,
        localAddress
      } : host;
    }
    function mergeOptions(target) {
      for (var i = 1, len = arguments.length; i < len; ++i) {
        var overrides = arguments[i];
        if (typeof overrides == "object")
          for (var keys = Object.keys(overrides), j = 0, keyLen = keys.length; j < keyLen; ++j) {
            var k = keys[j];
            overrides[k] !== void 0 && (target[k] = overrides[k]);
          }
      }
      return target;
    }
    var debug2;
    process.env.NODE_DEBUG && /\btunnel\b/.test(process.env.NODE_DEBUG) ? debug2 = function() {
      var args = Array.prototype.slice.call(arguments);
      typeof args[0] == "string" ? args[0] = "TUNNEL: " + args[0] : args.unshift("TUNNEL:"), console.error.apply(console, args);
    } : debug2 = function() {
    };
    exports.debug = debug2;
  }
});

// node_modules/tunnel/index.js
var require_tunnel2 = __commonJS({
  "node_modules/tunnel/index.js"(exports, module) {
    module.exports = require_tunnel();
  }
});

// node_modules/undici/lib/core/symbols.js
var require_symbols = __commonJS({
  "node_modules/undici/lib/core/symbols.js"(exports, module) {
    module.exports = {
      kClose: /* @__PURE__ */ Symbol("close"),
      kDestroy: /* @__PURE__ */ Symbol("destroy"),
      kDispatch: /* @__PURE__ */ Symbol("dispatch"),
      kUrl: /* @__PURE__ */ Symbol("url"),
      kWriting: /* @__PURE__ */ Symbol("writing"),
      kResuming: /* @__PURE__ */ Symbol("resuming"),
      kQueue: /* @__PURE__ */ Symbol("queue"),
      kConnect: /* @__PURE__ */ Symbol("connect"),
      kConnecting: /* @__PURE__ */ Symbol("connecting"),
      kKeepAliveDefaultTimeout: /* @__PURE__ */ Symbol("default keep alive timeout"),
      kKeepAliveMaxTimeout: /* @__PURE__ */ Symbol("max keep alive timeout"),
      kKeepAliveTimeoutThreshold: /* @__PURE__ */ Symbol("keep alive timeout threshold"),
      kKeepAliveTimeoutValue: /* @__PURE__ */ Symbol("keep alive timeout"),
      kKeepAlive: /* @__PURE__ */ Symbol("keep alive"),
      kHeadersTimeout: /* @__PURE__ */ Symbol("headers timeout"),
      kBodyTimeout: /* @__PURE__ */ Symbol("body timeout"),
      kServerName: /* @__PURE__ */ Symbol("server name"),
      kLocalAddress: /* @__PURE__ */ Symbol("local address"),
      kHost: /* @__PURE__ */ Symbol("host"),
      kNoRef: /* @__PURE__ */ Symbol("no ref"),
      kBodyUsed: /* @__PURE__ */ Symbol("used"),
      kBody: /* @__PURE__ */ Symbol("abstracted request body"),
      kRunning: /* @__PURE__ */ Symbol("running"),
      kBlocking: /* @__PURE__ */ Symbol("blocking"),
      kPending: /* @__PURE__ */ Symbol("pending"),
      kSize: /* @__PURE__ */ Symbol("size"),
      kBusy: /* @__PURE__ */ Symbol("busy"),
      kQueued: /* @__PURE__ */ Symbol("queued"),
      kFree: /* @__PURE__ */ Symbol("free"),
      kConnected: /* @__PURE__ */ Symbol("connected"),
      kClosed: /* @__PURE__ */ Symbol("closed"),
      kNeedDrain: /* @__PURE__ */ Symbol("need drain"),
      kReset: /* @__PURE__ */ Symbol("reset"),
      kDestroyed: /* @__PURE__ */ Symbol.for("nodejs.stream.destroyed"),
      kResume: /* @__PURE__ */ Symbol("resume"),
      kOnError: /* @__PURE__ */ Symbol("on error"),
      kMaxHeadersSize: /* @__PURE__ */ Symbol("max headers size"),
      kRunningIdx: /* @__PURE__ */ Symbol("running index"),
      kPendingIdx: /* @__PURE__ */ Symbol("pending index"),
      kError: /* @__PURE__ */ Symbol("error"),
      kClients: /* @__PURE__ */ Symbol("clients"),
      kClient: /* @__PURE__ */ Symbol("client"),
      kParser: /* @__PURE__ */ Symbol("parser"),
      kOnDestroyed: /* @__PURE__ */ Symbol("destroy callbacks"),
      kPipelining: /* @__PURE__ */ Symbol("pipelining"),
      kSocket: /* @__PURE__ */ Symbol("socket"),
      kHostHeader: /* @__PURE__ */ Symbol("host header"),
      kConnector: /* @__PURE__ */ Symbol("connector"),
      kStrictContentLength: /* @__PURE__ */ Symbol("strict content length"),
      kMaxRedirections: /* @__PURE__ */ Symbol("maxRedirections"),
      kMaxRequests: /* @__PURE__ */ Symbol("maxRequestsPerClient"),
      kProxy: /* @__PURE__ */ Symbol("proxy agent options"),
      kCounter: /* @__PURE__ */ Symbol("socket request counter"),
      kInterceptors: /* @__PURE__ */ Symbol("dispatch interceptors"),
      kMaxResponseSize: /* @__PURE__ */ Symbol("max response size"),
      kHTTP2Session: /* @__PURE__ */ Symbol("http2Session"),
      kHTTP2SessionState: /* @__PURE__ */ Symbol("http2Session state"),
      kRetryHandlerDefaultRetry: /* @__PURE__ */ Symbol("retry agent default retry"),
      kConstruct: /* @__PURE__ */ Symbol("constructable"),
      kListeners: /* @__PURE__ */ Symbol("listeners"),
      kHTTPContext: /* @__PURE__ */ Symbol("http context"),
      kMaxConcurrentStreams: /* @__PURE__ */ Symbol("max concurrent streams"),
      kNoProxyAgent: /* @__PURE__ */ Symbol("no proxy agent"),
      kHttpProxyAgent: /* @__PURE__ */ Symbol("http proxy agent"),
      kHttpsProxyAgent: /* @__PURE__ */ Symbol("https proxy agent")
    };
  }
});

// node_modules/undici/lib/core/errors.js
var require_errors = __commonJS({
  "node_modules/undici/lib/core/errors.js"(exports, module) {
    "use strict";
    var kUndiciError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR"), UndiciError = class extends Error {
      constructor(message) {
        super(message), this.name = "UndiciError", this.code = "UND_ERR";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kUndiciError] === !0;
      }
      [kUndiciError] = !0;
    }, kConnectTimeoutError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_CONNECT_TIMEOUT"), ConnectTimeoutError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "ConnectTimeoutError", this.message = message || "Connect Timeout Error", this.code = "UND_ERR_CONNECT_TIMEOUT";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kConnectTimeoutError] === !0;
      }
      [kConnectTimeoutError] = !0;
    }, kHeadersTimeoutError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_HEADERS_TIMEOUT"), HeadersTimeoutError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "HeadersTimeoutError", this.message = message || "Headers Timeout Error", this.code = "UND_ERR_HEADERS_TIMEOUT";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kHeadersTimeoutError] === !0;
      }
      [kHeadersTimeoutError] = !0;
    }, kHeadersOverflowError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_HEADERS_OVERFLOW"), HeadersOverflowError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "HeadersOverflowError", this.message = message || "Headers Overflow Error", this.code = "UND_ERR_HEADERS_OVERFLOW";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kHeadersOverflowError] === !0;
      }
      [kHeadersOverflowError] = !0;
    }, kBodyTimeoutError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_BODY_TIMEOUT"), BodyTimeoutError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "BodyTimeoutError", this.message = message || "Body Timeout Error", this.code = "UND_ERR_BODY_TIMEOUT";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kBodyTimeoutError] === !0;
      }
      [kBodyTimeoutError] = !0;
    }, kResponseStatusCodeError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_RESPONSE_STATUS_CODE"), ResponseStatusCodeError = class extends UndiciError {
      constructor(message, statusCode, headers, body) {
        super(message), this.name = "ResponseStatusCodeError", this.message = message || "Response Status Code Error", this.code = "UND_ERR_RESPONSE_STATUS_CODE", this.body = body, this.status = statusCode, this.statusCode = statusCode, this.headers = headers;
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kResponseStatusCodeError] === !0;
      }
      [kResponseStatusCodeError] = !0;
    }, kInvalidArgumentError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_INVALID_ARG"), InvalidArgumentError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "InvalidArgumentError", this.message = message || "Invalid Argument Error", this.code = "UND_ERR_INVALID_ARG";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kInvalidArgumentError] === !0;
      }
      [kInvalidArgumentError] = !0;
    }, kInvalidReturnValueError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_INVALID_RETURN_VALUE"), InvalidReturnValueError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "InvalidReturnValueError", this.message = message || "Invalid Return Value Error", this.code = "UND_ERR_INVALID_RETURN_VALUE";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kInvalidReturnValueError] === !0;
      }
      [kInvalidReturnValueError] = !0;
    }, kAbortError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_ABORT"), AbortError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "AbortError", this.message = message || "The operation was aborted", this.code = "UND_ERR_ABORT";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kAbortError] === !0;
      }
      [kAbortError] = !0;
    }, kRequestAbortedError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_ABORTED"), RequestAbortedError = class extends AbortError {
      constructor(message) {
        super(message), this.name = "AbortError", this.message = message || "Request aborted", this.code = "UND_ERR_ABORTED";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kRequestAbortedError] === !0;
      }
      [kRequestAbortedError] = !0;
    }, kInformationalError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_INFO"), InformationalError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "InformationalError", this.message = message || "Request information", this.code = "UND_ERR_INFO";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kInformationalError] === !0;
      }
      [kInformationalError] = !0;
    }, kRequestContentLengthMismatchError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_REQ_CONTENT_LENGTH_MISMATCH"), RequestContentLengthMismatchError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "RequestContentLengthMismatchError", this.message = message || "Request body length does not match content-length header", this.code = "UND_ERR_REQ_CONTENT_LENGTH_MISMATCH";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kRequestContentLengthMismatchError] === !0;
      }
      [kRequestContentLengthMismatchError] = !0;
    }, kResponseContentLengthMismatchError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_RES_CONTENT_LENGTH_MISMATCH"), ResponseContentLengthMismatchError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "ResponseContentLengthMismatchError", this.message = message || "Response body length does not match content-length header", this.code = "UND_ERR_RES_CONTENT_LENGTH_MISMATCH";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kResponseContentLengthMismatchError] === !0;
      }
      [kResponseContentLengthMismatchError] = !0;
    }, kClientDestroyedError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_DESTROYED"), ClientDestroyedError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "ClientDestroyedError", this.message = message || "The client is destroyed", this.code = "UND_ERR_DESTROYED";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kClientDestroyedError] === !0;
      }
      [kClientDestroyedError] = !0;
    }, kClientClosedError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_CLOSED"), ClientClosedError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "ClientClosedError", this.message = message || "The client is closed", this.code = "UND_ERR_CLOSED";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kClientClosedError] === !0;
      }
      [kClientClosedError] = !0;
    }, kSocketError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_SOCKET"), SocketError = class extends UndiciError {
      constructor(message, socket) {
        super(message), this.name = "SocketError", this.message = message || "Socket error", this.code = "UND_ERR_SOCKET", this.socket = socket;
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kSocketError] === !0;
      }
      [kSocketError] = !0;
    }, kNotSupportedError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_NOT_SUPPORTED"), NotSupportedError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "NotSupportedError", this.message = message || "Not supported error", this.code = "UND_ERR_NOT_SUPPORTED";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kNotSupportedError] === !0;
      }
      [kNotSupportedError] = !0;
    }, kBalancedPoolMissingUpstreamError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_BPL_MISSING_UPSTREAM"), BalancedPoolMissingUpstreamError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "MissingUpstreamError", this.message = message || "No upstream has been added to the BalancedPool", this.code = "UND_ERR_BPL_MISSING_UPSTREAM";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kBalancedPoolMissingUpstreamError] === !0;
      }
      [kBalancedPoolMissingUpstreamError] = !0;
    }, kHTTPParserError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_HTTP_PARSER"), HTTPParserError = class extends Error {
      constructor(message, code, data) {
        super(message), this.name = "HTTPParserError", this.code = code ? `HPE_${code}` : void 0, this.data = data ? data.toString() : void 0;
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kHTTPParserError] === !0;
      }
      [kHTTPParserError] = !0;
    }, kResponseExceededMaxSizeError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_RES_EXCEEDED_MAX_SIZE"), ResponseExceededMaxSizeError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "ResponseExceededMaxSizeError", this.message = message || "Response content exceeded max size", this.code = "UND_ERR_RES_EXCEEDED_MAX_SIZE";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kResponseExceededMaxSizeError] === !0;
      }
      [kResponseExceededMaxSizeError] = !0;
    }, kRequestRetryError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_REQ_RETRY"), RequestRetryError = class extends UndiciError {
      constructor(message, code, { headers, data }) {
        super(message), this.name = "RequestRetryError", this.message = message || "Request retry error", this.code = "UND_ERR_REQ_RETRY", this.statusCode = code, this.data = data, this.headers = headers;
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kRequestRetryError] === !0;
      }
      [kRequestRetryError] = !0;
    }, kResponseError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_RESPONSE"), ResponseError = class extends UndiciError {
      constructor(message, code, { headers, data }) {
        super(message), this.name = "ResponseError", this.message = message || "Response error", this.code = "UND_ERR_RESPONSE", this.statusCode = code, this.data = data, this.headers = headers;
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kResponseError] === !0;
      }
      [kResponseError] = !0;
    }, kSecureProxyConnectionError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_PRX_TLS"), SecureProxyConnectionError = class extends UndiciError {
      constructor(cause, message, options) {
        super(message, { cause, ...options ?? {} }), this.name = "SecureProxyConnectionError", this.message = message || "Secure Proxy Connection failed", this.code = "UND_ERR_PRX_TLS", this.cause = cause;
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kSecureProxyConnectionError] === !0;
      }
      [kSecureProxyConnectionError] = !0;
    }, kMessageSizeExceededError = /* @__PURE__ */ Symbol.for("undici.error.UND_ERR_WS_MESSAGE_SIZE_EXCEEDED"), MessageSizeExceededError = class extends UndiciError {
      constructor(message) {
        super(message), this.name = "MessageSizeExceededError", this.message = message || "Max decompressed message size exceeded", this.code = "UND_ERR_WS_MESSAGE_SIZE_EXCEEDED";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kMessageSizeExceededError] === !0;
      }
      get [kMessageSizeExceededError]() {
        return !0;
      }
    };
    module.exports = {
      AbortError,
      HTTPParserError,
      UndiciError,
      HeadersTimeoutError,
      HeadersOverflowError,
      BodyTimeoutError,
      RequestContentLengthMismatchError,
      ConnectTimeoutError,
      ResponseStatusCodeError,
      InvalidArgumentError,
      InvalidReturnValueError,
      RequestAbortedError,
      ClientDestroyedError,
      ClientClosedError,
      InformationalError,
      SocketError,
      NotSupportedError,
      ResponseContentLengthMismatchError,
      BalancedPoolMissingUpstreamError,
      ResponseExceededMaxSizeError,
      RequestRetryError,
      ResponseError,
      SecureProxyConnectionError,
      MessageSizeExceededError
    };
  }
});

// node_modules/undici/lib/core/constants.js
var require_constants = __commonJS({
  "node_modules/undici/lib/core/constants.js"(exports, module) {
    "use strict";
    var headerNameLowerCasedRecord = {}, wellknownHeaderNames = [
      "Accept",
      "Accept-Encoding",
      "Accept-Language",
      "Accept-Ranges",
      "Access-Control-Allow-Credentials",
      "Access-Control-Allow-Headers",
      "Access-Control-Allow-Methods",
      "Access-Control-Allow-Origin",
      "Access-Control-Expose-Headers",
      "Access-Control-Max-Age",
      "Access-Control-Request-Headers",
      "Access-Control-Request-Method",
      "Age",
      "Allow",
      "Alt-Svc",
      "Alt-Used",
      "Authorization",
      "Cache-Control",
      "Clear-Site-Data",
      "Connection",
      "Content-Disposition",
      "Content-Encoding",
      "Content-Language",
      "Content-Length",
      "Content-Location",
      "Content-Range",
      "Content-Security-Policy",
      "Content-Security-Policy-Report-Only",
      "Content-Type",
      "Cookie",
      "Cross-Origin-Embedder-Policy",
      "Cross-Origin-Opener-Policy",
      "Cross-Origin-Resource-Policy",
      "Date",
      "Device-Memory",
      "Downlink",
      "ECT",
      "ETag",
      "Expect",
      "Expect-CT",
      "Expires",
      "Forwarded",
      "From",
      "Host",
      "If-Match",
      "If-Modified-Since",
      "If-None-Match",
      "If-Range",
      "If-Unmodified-Since",
      "Keep-Alive",
      "Last-Modified",
      "Link",
      "Location",
      "Max-Forwards",
      "Origin",
      "Permissions-Policy",
      "Pragma",
      "Proxy-Authenticate",
      "Proxy-Authorization",
      "RTT",
      "Range",
      "Referer",
      "Referrer-Policy",
      "Refresh",
      "Retry-After",
      "Sec-WebSocket-Accept",
      "Sec-WebSocket-Extensions",
      "Sec-WebSocket-Key",
      "Sec-WebSocket-Protocol",
      "Sec-WebSocket-Version",
      "Server",
      "Server-Timing",
      "Service-Worker-Allowed",
      "Service-Worker-Navigation-Preload",
      "Set-Cookie",
      "SourceMap",
      "Strict-Transport-Security",
      "Supports-Loading-Mode",
      "TE",
      "Timing-Allow-Origin",
      "Trailer",
      "Transfer-Encoding",
      "Upgrade",
      "Upgrade-Insecure-Requests",
      "User-Agent",
      "Vary",
      "Via",
      "WWW-Authenticate",
      "X-Content-Type-Options",
      "X-DNS-Prefetch-Control",
      "X-Frame-Options",
      "X-Permitted-Cross-Domain-Policies",
      "X-Powered-By",
      "X-Requested-With",
      "X-XSS-Protection"
    ];
    for (let i = 0; i < wellknownHeaderNames.length; ++i) {
      let key = wellknownHeaderNames[i], lowerCasedKey = key.toLowerCase();
      headerNameLowerCasedRecord[key] = headerNameLowerCasedRecord[lowerCasedKey] = lowerCasedKey;
    }
    Object.setPrototypeOf(headerNameLowerCasedRecord, null);
    module.exports = {
      wellknownHeaderNames,
      headerNameLowerCasedRecord
    };
  }
});

// node_modules/undici/lib/core/tree.js
var require_tree = __commonJS({
  "node_modules/undici/lib/core/tree.js"(exports, module) {
    "use strict";
    var {
      wellknownHeaderNames,
      headerNameLowerCasedRecord
    } = require_constants(), TstNode = class _TstNode {
      /** @type {any} */
      value = null;
      /** @type {null | TstNode} */
      left = null;
      /** @type {null | TstNode} */
      middle = null;
      /** @type {null | TstNode} */
      right = null;
      /** @type {number} */
      code;
      /**
       * @param {string} key
       * @param {any} value
       * @param {number} index
       */
      constructor(key, value, index) {
        if (index === void 0 || index >= key.length)
          throw new TypeError("Unreachable");
        if ((this.code = key.charCodeAt(index)) > 127)
          throw new TypeError("key must be ascii string");
        key.length !== ++index ? this.middle = new _TstNode(key, value, index) : this.value = value;
      }
      /**
       * @param {string} key
       * @param {any} value
       */
      add(key, value) {
        let length = key.length;
        if (length === 0)
          throw new TypeError("Unreachable");
        let index = 0, node = this;
        for (; ; ) {
          let code = key.charCodeAt(index);
          if (code > 127)
            throw new TypeError("key must be ascii string");
          if (node.code === code)
            if (length === ++index) {
              node.value = value;
              break;
            } else if (node.middle !== null)
              node = node.middle;
            else {
              node.middle = new _TstNode(key, value, index);
              break;
            }
          else if (node.code < code)
            if (node.left !== null)
              node = node.left;
            else {
              node.left = new _TstNode(key, value, index);
              break;
            }
          else if (node.right !== null)
            node = node.right;
          else {
            node.right = new _TstNode(key, value, index);
            break;
          }
        }
      }
      /**
       * @param {Uint8Array} key
       * @return {TstNode | null}
       */
      search(key) {
        let keylength = key.length, index = 0, node = this;
        for (; node !== null && index < keylength; ) {
          let code = key[index];
          for (code <= 90 && code >= 65 && (code |= 32); node !== null; ) {
            if (code === node.code) {
              if (keylength === ++index)
                return node;
              node = node.middle;
              break;
            }
            node = node.code < code ? node.left : node.right;
          }
        }
        return null;
      }
    }, TernarySearchTree = class {
      /** @type {TstNode | null} */
      node = null;
      /**
       * @param {string} key
       * @param {any} value
       * */
      insert(key, value) {
        this.node === null ? this.node = new TstNode(key, value, 0) : this.node.add(key, value);
      }
      /**
       * @param {Uint8Array} key
       * @return {any}
       */
      lookup(key) {
        return this.node?.search(key)?.value ?? null;
      }
    }, tree = new TernarySearchTree();
    for (let i = 0; i < wellknownHeaderNames.length; ++i) {
      let key = headerNameLowerCasedRecord[wellknownHeaderNames[i]];
      tree.insert(key, key);
    }
    module.exports = {
      TernarySearchTree,
      tree
    };
  }
});

// node_modules/undici/lib/core/util.js
var require_util = __commonJS({
  "node_modules/undici/lib/core/util.js"(exports, module) {
    "use strict";
    var assert = __require("node:assert"), { kDestroyed, kBodyUsed, kListeners, kBody } = require_symbols(), { IncomingMessage } = __require("node:http"), stream = __require("node:stream"), net = __require("node:net"), { Blob: Blob2 } = __require("node:buffer"), nodeUtil = __require("node:util"), { stringify } = __require("node:querystring"), { EventEmitter: EE } = __require("node:events"), { InvalidArgumentError } = require_errors(), { headerNameLowerCasedRecord } = require_constants(), { tree } = require_tree(), [nodeMajor, nodeMinor] = process.versions.node.split(".").map((v) => Number(v)), BodyAsyncIterable = class {
      constructor(body) {
        this[kBody] = body, this[kBodyUsed] = !1;
      }
      async *[Symbol.asyncIterator]() {
        assert(!this[kBodyUsed], "disturbed"), this[kBodyUsed] = !0, yield* this[kBody];
      }
    };
    function wrapRequestBody(body) {
      return isStream(body) ? (bodyLength(body) === 0 && body.on("data", function() {
        assert(!1);
      }), typeof body.readableDidRead != "boolean" && (body[kBodyUsed] = !1, EE.prototype.on.call(body, "data", function() {
        this[kBodyUsed] = !0;
      })), body) : body && typeof body.pipeTo == "function" ? new BodyAsyncIterable(body) : body && typeof body != "string" && !ArrayBuffer.isView(body) && isIterable(body) ? new BodyAsyncIterable(body) : body;
    }
    function nop() {
    }
    function isStream(obj) {
      return obj && typeof obj == "object" && typeof obj.pipe == "function" && typeof obj.on == "function";
    }
    function isBlobLike(object) {
      if (object === null)
        return !1;
      if (object instanceof Blob2)
        return !0;
      if (typeof object != "object")
        return !1;
      {
        let sTag = object[Symbol.toStringTag];
        return (sTag === "Blob" || sTag === "File") && ("stream" in object && typeof object.stream == "function" || "arrayBuffer" in object && typeof object.arrayBuffer == "function");
      }
    }
    function buildURL(url, queryParams) {
      if (url.includes("?") || url.includes("#"))
        throw new Error('Query params cannot be passed when url already contains "?" or "#".');
      let stringified = stringify(queryParams);
      return stringified && (url += "?" + stringified), url;
    }
    function isValidPort(port) {
      let value = parseInt(port, 10);
      return value === Number(port) && value >= 0 && value <= 65535;
    }
    function isHttpOrHttpsPrefixed(value) {
      return value != null && value[0] === "h" && value[1] === "t" && value[2] === "t" && value[3] === "p" && (value[4] === ":" || value[4] === "s" && value[5] === ":");
    }
    function parseURL(url) {
      if (typeof url == "string") {
        if (url = new URL(url), !isHttpOrHttpsPrefixed(url.origin || url.protocol))
          throw new InvalidArgumentError("Invalid URL protocol: the URL must start with `http:` or `https:`.");
        return url;
      }
      if (!url || typeof url != "object")
        throw new InvalidArgumentError("Invalid URL: The URL argument must be a non-null object.");
      if (!(url instanceof URL)) {
        if (url.port != null && url.port !== "" && isValidPort(url.port) === !1)
          throw new InvalidArgumentError("Invalid URL: port must be a valid integer or a string representation of an integer.");
        if (url.path != null && typeof url.path != "string")
          throw new InvalidArgumentError("Invalid URL path: the path must be a string or null/undefined.");
        if (url.pathname != null && typeof url.pathname != "string")
          throw new InvalidArgumentError("Invalid URL pathname: the pathname must be a string or null/undefined.");
        if (url.hostname != null && typeof url.hostname != "string")
          throw new InvalidArgumentError("Invalid URL hostname: the hostname must be a string or null/undefined.");
        if (url.origin != null && typeof url.origin != "string")
          throw new InvalidArgumentError("Invalid URL origin: the origin must be a string or null/undefined.");
        if (!isHttpOrHttpsPrefixed(url.origin || url.protocol))
          throw new InvalidArgumentError("Invalid URL protocol: the URL must start with `http:` or `https:`.");
        let port = url.port != null ? url.port : url.protocol === "https:" ? 443 : 80, origin = url.origin != null ? url.origin : `${url.protocol || ""}//${url.hostname || ""}:${port}`, path4 = url.path != null ? url.path : `${url.pathname || ""}${url.search || ""}`;
        return origin[origin.length - 1] === "/" && (origin = origin.slice(0, origin.length - 1)), path4 && path4[0] !== "/" && (path4 = `/${path4}`), new URL(`${origin}${path4}`);
      }
      if (!isHttpOrHttpsPrefixed(url.origin || url.protocol))
        throw new InvalidArgumentError("Invalid URL protocol: the URL must start with `http:` or `https:`.");
      return url;
    }
    function parseOrigin(url) {
      if (url = parseURL(url), url.pathname !== "/" || url.search || url.hash)
        throw new InvalidArgumentError("invalid url");
      return url;
    }
    function getHostname(host) {
      if (host[0] === "[") {
        let idx2 = host.indexOf("]");
        return assert(idx2 !== -1), host.substring(1, idx2);
      }
      let idx = host.indexOf(":");
      return idx === -1 ? host : host.substring(0, idx);
    }
    function getServerName(host) {
      if (!host)
        return null;
      assert(typeof host == "string");
      let servername = getHostname(host);
      return net.isIP(servername) ? "" : servername;
    }
    function deepClone(obj) {
      return JSON.parse(JSON.stringify(obj));
    }
    function isAsyncIterable(obj) {
      return obj != null && typeof obj[Symbol.asyncIterator] == "function";
    }
    function isIterable(obj) {
      return obj != null && (typeof obj[Symbol.iterator] == "function" || typeof obj[Symbol.asyncIterator] == "function");
    }
    function bodyLength(body) {
      if (body == null)
        return 0;
      if (isStream(body)) {
        let state = body._readableState;
        return state && state.objectMode === !1 && state.ended === !0 && Number.isFinite(state.length) ? state.length : null;
      } else {
        if (isBlobLike(body))
          return body.size != null ? body.size : null;
        if (isBuffer(body))
          return body.byteLength;
      }
      return null;
    }
    function isDestroyed(body) {
      return body && !!(body.destroyed || body[kDestroyed] || stream.isDestroyed?.(body));
    }
    function destroy(stream2, err) {
      stream2 == null || !isStream(stream2) || isDestroyed(stream2) || (typeof stream2.destroy == "function" ? (Object.getPrototypeOf(stream2).constructor === IncomingMessage && (stream2.socket = null), stream2.destroy(err)) : err && queueMicrotask(() => {
        stream2.emit("error", err);
      }), stream2.destroyed !== !0 && (stream2[kDestroyed] = !0));
    }
    var KEEPALIVE_TIMEOUT_EXPR = /timeout=(\d+)/;
    function parseKeepAliveTimeout(val) {
      let m = val.toString().match(KEEPALIVE_TIMEOUT_EXPR);
      return m ? parseInt(m[1], 10) * 1e3 : null;
    }
    function headerNameToString(value) {
      return typeof value == "string" ? headerNameLowerCasedRecord[value] ?? value.toLowerCase() : tree.lookup(value) ?? value.toString("latin1").toLowerCase();
    }
    function bufferToLowerCasedHeaderName(value) {
      return tree.lookup(value) ?? value.toString("latin1").toLowerCase();
    }
    function parseHeaders(headers, obj) {
      obj === void 0 && (obj = {});
      for (let i = 0; i < headers.length; i += 2) {
        let key = headerNameToString(headers[i]), val = obj[key];
        if (val)
          typeof val == "string" && (val = [val], obj[key] = val), val.push(headers[i + 1].toString("utf8"));
        else {
          let headersValue = headers[i + 1];
          typeof headersValue == "string" ? obj[key] = headersValue : obj[key] = Array.isArray(headersValue) ? headersValue.map((x) => x.toString("utf8")) : headersValue.toString("utf8");
        }
      }
      return "content-length" in obj && "content-disposition" in obj && (obj["content-disposition"] = Buffer.from(obj["content-disposition"]).toString("latin1")), obj;
    }
    function parseRawHeaders(headers) {
      let len = headers.length, ret = new Array(len), hasContentLength = !1, contentDispositionIdx = -1, key, val, kLen = 0;
      for (let n = 0; n < headers.length; n += 2)
        key = headers[n], val = headers[n + 1], typeof key != "string" && (key = key.toString()), typeof val != "string" && (val = val.toString("utf8")), kLen = key.length, kLen === 14 && key[7] === "-" && (key === "content-length" || key.toLowerCase() === "content-length") ? hasContentLength = !0 : kLen === 19 && key[7] === "-" && (key === "content-disposition" || key.toLowerCase() === "content-disposition") && (contentDispositionIdx = n + 1), ret[n] = key, ret[n + 1] = val;
      return hasContentLength && contentDispositionIdx !== -1 && (ret[contentDispositionIdx] = Buffer.from(ret[contentDispositionIdx]).toString("latin1")), ret;
    }
    function isBuffer(buffer) {
      return buffer instanceof Uint8Array || Buffer.isBuffer(buffer);
    }
    function validateHandler(handler, method, upgrade) {
      if (!handler || typeof handler != "object")
        throw new InvalidArgumentError("handler must be an object");
      if (typeof handler.onConnect != "function")
        throw new InvalidArgumentError("invalid onConnect method");
      if (typeof handler.onError != "function")
        throw new InvalidArgumentError("invalid onError method");
      if (typeof handler.onBodySent != "function" && handler.onBodySent !== void 0)
        throw new InvalidArgumentError("invalid onBodySent method");
      if (upgrade || method === "CONNECT") {
        if (typeof handler.onUpgrade != "function")
          throw new InvalidArgumentError("invalid onUpgrade method");
      } else {
        if (typeof handler.onHeaders != "function")
          throw new InvalidArgumentError("invalid onHeaders method");
        if (typeof handler.onData != "function")
          throw new InvalidArgumentError("invalid onData method");
        if (typeof handler.onComplete != "function")
          throw new InvalidArgumentError("invalid onComplete method");
      }
    }
    function isDisturbed(body) {
      return !!(body && (stream.isDisturbed(body) || body[kBodyUsed]));
    }
    function isErrored(body) {
      return !!(body && stream.isErrored(body));
    }
    function isReadable(body) {
      return !!(body && stream.isReadable(body));
    }
    function getSocketInfo(socket) {
      return {
        localAddress: socket.localAddress,
        localPort: socket.localPort,
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
        remoteFamily: socket.remoteFamily,
        timeout: socket.timeout,
        bytesWritten: socket.bytesWritten,
        bytesRead: socket.bytesRead
      };
    }
    function ReadableStreamFrom(iterable) {
      let iterator;
      return new ReadableStream(
        {
          async start() {
            iterator = iterable[Symbol.asyncIterator]();
          },
          async pull(controller) {
            let { done, value } = await iterator.next();
            if (done)
              queueMicrotask(() => {
                controller.close(), controller.byobRequest?.respond(0);
              });
            else {
              let buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
              buf.byteLength && controller.enqueue(new Uint8Array(buf));
            }
            return controller.desiredSize > 0;
          },
          async cancel(reason) {
            await iterator.return();
          },
          type: "bytes"
        }
      );
    }
    function isFormDataLike(object) {
      return object && typeof object == "object" && typeof object.append == "function" && typeof object.delete == "function" && typeof object.get == "function" && typeof object.getAll == "function" && typeof object.has == "function" && typeof object.set == "function" && object[Symbol.toStringTag] === "FormData";
    }
    function addAbortListener(signal, listener) {
      return "addEventListener" in signal ? (signal.addEventListener("abort", listener, { once: !0 }), () => signal.removeEventListener("abort", listener)) : (signal.addListener("abort", listener), () => signal.removeListener("abort", listener));
    }
    var hasToWellFormed = typeof String.prototype.toWellFormed == "function", hasIsWellFormed = typeof String.prototype.isWellFormed == "function";
    function toUSVString(val) {
      return hasToWellFormed ? `${val}`.toWellFormed() : nodeUtil.toUSVString(val);
    }
    function isUSVString(val) {
      return hasIsWellFormed ? `${val}`.isWellFormed() : toUSVString(val) === `${val}`;
    }
    function isTokenCharCode(c) {
      switch (c) {
        case 34:
        case 40:
        case 41:
        case 44:
        case 47:
        case 58:
        case 59:
        case 60:
        case 61:
        case 62:
        case 63:
        case 64:
        case 91:
        case 92:
        case 93:
        case 123:
        case 125:
          return !1;
        default:
          return c >= 33 && c <= 126;
      }
    }
    function isValidHTTPToken(characters) {
      if (characters.length === 0)
        return !1;
      for (let i = 0; i < characters.length; ++i)
        if (!isTokenCharCode(characters.charCodeAt(i)))
          return !1;
      return !0;
    }
    var headerCharRegex = /[^\t\x20-\x7e\x80-\xff]/;
    function isValidHeaderValue(characters) {
      return !headerCharRegex.test(characters);
    }
    function parseRangeHeader(range) {
      if (range == null || range === "") return { start: 0, end: null, size: null };
      let m = range ? range.match(/^bytes (\d+)-(\d+)\/(\d+)?$/) : null;
      return m ? {
        start: parseInt(m[1]),
        end: m[2] ? parseInt(m[2]) : null,
        size: m[3] ? parseInt(m[3]) : null
      } : null;
    }
    function addListener(obj, name, listener) {
      return (obj[kListeners] ??= []).push([name, listener]), obj.on(name, listener), obj;
    }
    function removeAllListeners(obj) {
      for (let [name, listener] of obj[kListeners] ?? [])
        obj.removeListener(name, listener);
      obj[kListeners] = null;
    }
    function errorRequest(client, request, err) {
      try {
        request.onError(err), assert(request.aborted);
      } catch (err2) {
        client.emit("error", err2);
      }
    }
    var kEnumerableProperty = /* @__PURE__ */ Object.create(null);
    kEnumerableProperty.enumerable = !0;
    var normalizedMethodRecordsBase = {
      delete: "DELETE",
      DELETE: "DELETE",
      get: "GET",
      GET: "GET",
      head: "HEAD",
      HEAD: "HEAD",
      options: "OPTIONS",
      OPTIONS: "OPTIONS",
      post: "POST",
      POST: "POST",
      put: "PUT",
      PUT: "PUT"
    }, normalizedMethodRecords = {
      ...normalizedMethodRecordsBase,
      patch: "patch",
      PATCH: "PATCH"
    };
    Object.setPrototypeOf(normalizedMethodRecordsBase, null);
    Object.setPrototypeOf(normalizedMethodRecords, null);
    module.exports = {
      kEnumerableProperty,
      nop,
      isDisturbed,
      isErrored,
      isReadable,
      toUSVString,
      isUSVString,
      isBlobLike,
      parseOrigin,
      parseURL,
      getServerName,
      isStream,
      isIterable,
      isAsyncIterable,
      isDestroyed,
      headerNameToString,
      bufferToLowerCasedHeaderName,
      addListener,
      removeAllListeners,
      errorRequest,
      parseRawHeaders,
      parseHeaders,
      parseKeepAliveTimeout,
      destroy,
      bodyLength,
      deepClone,
      ReadableStreamFrom,
      isBuffer,
      validateHandler,
      getSocketInfo,
      isFormDataLike,
      buildURL,
      addAbortListener,
      isValidHTTPToken,
      isValidHeaderValue,
      isTokenCharCode,
      parseRangeHeader,
      normalizedMethodRecordsBase,
      normalizedMethodRecords,
      isValidPort,
      isHttpOrHttpsPrefixed,
      nodeMajor,
      nodeMinor,
      safeHTTPMethods: ["GET", "HEAD", "OPTIONS", "TRACE"],
      wrapRequestBody
    };
  }
});

// node_modules/undici/lib/core/diagnostics.js
var require_diagnostics = __commonJS({
  "node_modules/undici/lib/core/diagnostics.js"(exports, module) {
    "use strict";
    var diagnosticsChannel = __require("node:diagnostics_channel"), util = __require("node:util"), undiciDebugLog = util.debuglog("undici"), fetchDebuglog = util.debuglog("fetch"), websocketDebuglog = util.debuglog("websocket"), isClientSet = !1, channels = {
      // Client
      beforeConnect: diagnosticsChannel.channel("undici:client:beforeConnect"),
      connected: diagnosticsChannel.channel("undici:client:connected"),
      connectError: diagnosticsChannel.channel("undici:client:connectError"),
      sendHeaders: diagnosticsChannel.channel("undici:client:sendHeaders"),
      // Request
      create: diagnosticsChannel.channel("undici:request:create"),
      bodySent: diagnosticsChannel.channel("undici:request:bodySent"),
      headers: diagnosticsChannel.channel("undici:request:headers"),
      trailers: diagnosticsChannel.channel("undici:request:trailers"),
      error: diagnosticsChannel.channel("undici:request:error"),
      // WebSocket
      open: diagnosticsChannel.channel("undici:websocket:open"),
      close: diagnosticsChannel.channel("undici:websocket:close"),
      socketError: diagnosticsChannel.channel("undici:websocket:socket_error"),
      ping: diagnosticsChannel.channel("undici:websocket:ping"),
      pong: diagnosticsChannel.channel("undici:websocket:pong")
    };
    if (undiciDebugLog.enabled || fetchDebuglog.enabled) {
      let debuglog = fetchDebuglog.enabled ? fetchDebuglog : undiciDebugLog;
      diagnosticsChannel.channel("undici:client:beforeConnect").subscribe((evt) => {
        let {
          connectParams: { version, protocol, port, host }
        } = evt;
        debuglog(
          "connecting to %s using %s%s",
          `${host}${port ? `:${port}` : ""}`,
          protocol,
          version
        );
      }), diagnosticsChannel.channel("undici:client:connected").subscribe((evt) => {
        let {
          connectParams: { version, protocol, port, host }
        } = evt;
        debuglog(
          "connected to %s using %s%s",
          `${host}${port ? `:${port}` : ""}`,
          protocol,
          version
        );
      }), diagnosticsChannel.channel("undici:client:connectError").subscribe((evt) => {
        let {
          connectParams: { version, protocol, port, host },
          error: error2
        } = evt;
        debuglog(
          "connection to %s using %s%s errored - %s",
          `${host}${port ? `:${port}` : ""}`,
          protocol,
          version,
          error2.message
        );
      }), diagnosticsChannel.channel("undici:client:sendHeaders").subscribe((evt) => {
        let {
          request: { method, path: path4, origin }
        } = evt;
        debuglog("sending request to %s %s/%s", method, origin, path4);
      }), diagnosticsChannel.channel("undici:request:headers").subscribe((evt) => {
        let {
          request: { method, path: path4, origin },
          response: { statusCode }
        } = evt;
        debuglog(
          "received response to %s %s/%s - HTTP %d",
          method,
          origin,
          path4,
          statusCode
        );
      }), diagnosticsChannel.channel("undici:request:trailers").subscribe((evt) => {
        let {
          request: { method, path: path4, origin }
        } = evt;
        debuglog("trailers received from %s %s/%s", method, origin, path4);
      }), diagnosticsChannel.channel("undici:request:error").subscribe((evt) => {
        let {
          request: { method, path: path4, origin },
          error: error2
        } = evt;
        debuglog(
          "request to %s %s/%s errored - %s",
          method,
          origin,
          path4,
          error2.message
        );
      }), isClientSet = !0;
    }
    if (websocketDebuglog.enabled) {
      if (!isClientSet) {
        let debuglog = undiciDebugLog.enabled ? undiciDebugLog : websocketDebuglog;
        diagnosticsChannel.channel("undici:client:beforeConnect").subscribe((evt) => {
          let {
            connectParams: { version, protocol, port, host }
          } = evt;
          debuglog(
            "connecting to %s%s using %s%s",
            host,
            port ? `:${port}` : "",
            protocol,
            version
          );
        }), diagnosticsChannel.channel("undici:client:connected").subscribe((evt) => {
          let {
            connectParams: { version, protocol, port, host }
          } = evt;
          debuglog(
            "connected to %s%s using %s%s",
            host,
            port ? `:${port}` : "",
            protocol,
            version
          );
        }), diagnosticsChannel.channel("undici:client:connectError").subscribe((evt) => {
          let {
            connectParams: { version, protocol, port, host },
            error: error2
          } = evt;
          debuglog(
            "connection to %s%s using %s%s errored - %s",
            host,
            port ? `:${port}` : "",
            protocol,
            version,
            error2.message
          );
        }), diagnosticsChannel.channel("undici:client:sendHeaders").subscribe((evt) => {
          let {
            request: { method, path: path4, origin }
          } = evt;
          debuglog("sending request to %s %s/%s", method, origin, path4);
        });
      }
      diagnosticsChannel.channel("undici:websocket:open").subscribe((evt) => {
        let {
          address: { address, port }
        } = evt;
        websocketDebuglog("connection opened %s%s", address, port ? `:${port}` : "");
      }), diagnosticsChannel.channel("undici:websocket:close").subscribe((evt) => {
        let { websocket, code, reason } = evt;
        websocketDebuglog(
          "closed connection to %s - %s %s",
          websocket.url,
          code,
          reason
        );
      }), diagnosticsChannel.channel("undici:websocket:socket_error").subscribe((err) => {
        websocketDebuglog("connection errored - %s", err.message);
      }), diagnosticsChannel.channel("undici:websocket:ping").subscribe((evt) => {
        websocketDebuglog("ping received");
      }), diagnosticsChannel.channel("undici:websocket:pong").subscribe((evt) => {
        websocketDebuglog("pong received");
      });
    }
    module.exports = {
      channels
    };
  }
});

// node_modules/undici/lib/core/request.js
var require_request = __commonJS({
  "node_modules/undici/lib/core/request.js"(exports, module) {
    "use strict";
    var {
      InvalidArgumentError,
      NotSupportedError
    } = require_errors(), assert = __require("node:assert"), {
      isValidHTTPToken,
      isValidHeaderValue,
      isStream,
      destroy,
      isBuffer,
      isFormDataLike,
      isIterable,
      isBlobLike,
      buildURL,
      validateHandler,
      getServerName,
      normalizedMethodRecords
    } = require_util(), { channels } = require_diagnostics(), { headerNameLowerCasedRecord } = require_constants(), invalidPathRegex = /[^\u0021-\u00ff]/, kHandler = /* @__PURE__ */ Symbol("handler"), Request = class {
      constructor(origin, {
        path: path4,
        method,
        body,
        headers,
        query,
        idempotent,
        blocking,
        upgrade,
        headersTimeout,
        bodyTimeout,
        reset,
        throwOnError,
        expectContinue,
        servername
      }, handler) {
        if (typeof path4 != "string")
          throw new InvalidArgumentError("path must be a string");
        if (path4[0] !== "/" && !(path4.startsWith("http://") || path4.startsWith("https://")) && method !== "CONNECT")
          throw new InvalidArgumentError("path must be an absolute URL or start with a slash");
        if (invalidPathRegex.test(path4))
          throw new InvalidArgumentError("invalid request path");
        if (typeof method != "string")
          throw new InvalidArgumentError("method must be a string");
        if (normalizedMethodRecords[method] === void 0 && !isValidHTTPToken(method))
          throw new InvalidArgumentError("invalid request method");
        if (upgrade && typeof upgrade != "string")
          throw new InvalidArgumentError("upgrade must be a string");
        if (upgrade && !isValidHeaderValue(upgrade))
          throw new InvalidArgumentError("invalid upgrade header");
        if (headersTimeout != null && (!Number.isFinite(headersTimeout) || headersTimeout < 0))
          throw new InvalidArgumentError("invalid headersTimeout");
        if (bodyTimeout != null && (!Number.isFinite(bodyTimeout) || bodyTimeout < 0))
          throw new InvalidArgumentError("invalid bodyTimeout");
        if (reset != null && typeof reset != "boolean")
          throw new InvalidArgumentError("invalid reset");
        if (expectContinue != null && typeof expectContinue != "boolean")
          throw new InvalidArgumentError("invalid expectContinue");
        if (this.headersTimeout = headersTimeout, this.bodyTimeout = bodyTimeout, this.throwOnError = throwOnError === !0, this.method = method, this.abort = null, body == null)
          this.body = null;
        else if (isStream(body)) {
          this.body = body;
          let rState = this.body._readableState;
          (!rState || !rState.autoDestroy) && (this.endHandler = function() {
            destroy(this);
          }, this.body.on("end", this.endHandler)), this.errorHandler = (err) => {
            this.abort ? this.abort(err) : this.error = err;
          }, this.body.on("error", this.errorHandler);
        } else if (isBuffer(body))
          this.body = body.byteLength ? body : null;
        else if (ArrayBuffer.isView(body))
          this.body = body.buffer.byteLength ? Buffer.from(body.buffer, body.byteOffset, body.byteLength) : null;
        else if (body instanceof ArrayBuffer)
          this.body = body.byteLength ? Buffer.from(body) : null;
        else if (typeof body == "string")
          this.body = body.length ? Buffer.from(body) : null;
        else if (isFormDataLike(body) || isIterable(body) || isBlobLike(body))
          this.body = body;
        else
          throw new InvalidArgumentError("body must be a string, a Buffer, a Readable stream, an iterable, or an async iterable");
        if (this.completed = !1, this.aborted = !1, this.upgrade = upgrade || null, this.path = query ? buildURL(path4, query) : path4, this.origin = origin, this.idempotent = idempotent ?? (method === "HEAD" || method === "GET"), this.blocking = blocking ?? !1, this.reset = reset ?? null, this.host = null, this.contentLength = null, this.contentType = null, this.headers = [], this.expectContinue = expectContinue ?? !1, Array.isArray(headers)) {
          if (headers.length % 2 !== 0)
            throw new InvalidArgumentError("headers array must be even");
          for (let i = 0; i < headers.length; i += 2)
            processHeader(this, headers[i], headers[i + 1]);
        } else if (headers && typeof headers == "object")
          if (headers[Symbol.iterator])
            for (let header of headers) {
              if (!Array.isArray(header) || header.length !== 2)
                throw new InvalidArgumentError("headers must be in key-value pair format");
              processHeader(this, header[0], header[1]);
            }
          else {
            let keys = Object.keys(headers);
            for (let i = 0; i < keys.length; ++i)
              processHeader(this, keys[i], headers[keys[i]]);
          }
        else if (headers != null)
          throw new InvalidArgumentError("headers must be an object or an array");
        validateHandler(handler, method, upgrade), this.servername = servername || getServerName(this.host), this[kHandler] = handler, channels.create.hasSubscribers && channels.create.publish({ request: this });
      }
      onBodySent(chunk) {
        if (this[kHandler].onBodySent)
          try {
            return this[kHandler].onBodySent(chunk);
          } catch (err) {
            this.abort(err);
          }
      }
      onRequestSent() {
        if (channels.bodySent.hasSubscribers && channels.bodySent.publish({ request: this }), this[kHandler].onRequestSent)
          try {
            return this[kHandler].onRequestSent();
          } catch (err) {
            this.abort(err);
          }
      }
      onConnect(abort) {
        if (assert(!this.aborted), assert(!this.completed), this.error)
          abort(this.error);
        else
          return this.abort = abort, this[kHandler].onConnect(abort);
      }
      onResponseStarted() {
        return this[kHandler].onResponseStarted?.();
      }
      onHeaders(statusCode, headers, resume, statusText) {
        assert(!this.aborted), assert(!this.completed), channels.headers.hasSubscribers && channels.headers.publish({ request: this, response: { statusCode, headers, statusText } });
        try {
          return this[kHandler].onHeaders(statusCode, headers, resume, statusText);
        } catch (err) {
          this.abort(err);
        }
      }
      onData(chunk) {
        assert(!this.aborted), assert(!this.completed);
        try {
          return this[kHandler].onData(chunk);
        } catch (err) {
          return this.abort(err), !1;
        }
      }
      onUpgrade(statusCode, headers, socket) {
        return assert(!this.aborted), assert(!this.completed), this[kHandler].onUpgrade(statusCode, headers, socket);
      }
      onComplete(trailers) {
        this.onFinally(), assert(!this.aborted), this.completed = !0, channels.trailers.hasSubscribers && channels.trailers.publish({ request: this, trailers });
        try {
          return this[kHandler].onComplete(trailers);
        } catch (err) {
          this.onError(err);
        }
      }
      onError(error2) {
        if (this.onFinally(), channels.error.hasSubscribers && channels.error.publish({ request: this, error: error2 }), !this.aborted)
          return this.aborted = !0, this[kHandler].onError(error2);
      }
      onFinally() {
        this.errorHandler && (this.body.off("error", this.errorHandler), this.errorHandler = null), this.endHandler && (this.body.off("end", this.endHandler), this.endHandler = null);
      }
      addHeader(key, value) {
        return processHeader(this, key, value), this;
      }
    };
    function processHeader(request, key, val) {
      if (val && typeof val == "object" && !Array.isArray(val))
        throw new InvalidArgumentError(`invalid ${key} header`);
      if (val === void 0)
        return;
      let headerName = headerNameLowerCasedRecord[key];
      if (headerName === void 0 && (headerName = key.toLowerCase(), headerNameLowerCasedRecord[headerName] === void 0 && !isValidHTTPToken(headerName)))
        throw new InvalidArgumentError("invalid header key");
      if (Array.isArray(val)) {
        let arr = [];
        for (let i = 0; i < val.length; i++)
          if (typeof val[i] == "string") {
            if (!isValidHeaderValue(val[i]))
              throw new InvalidArgumentError(`invalid ${key} header`);
            arr.push(val[i]);
          } else if (val[i] === null)
            arr.push("");
          else {
            if (typeof val[i] == "object")
              throw new InvalidArgumentError(`invalid ${key} header`);
            arr.push(`${val[i]}`);
          }
        val = arr;
      } else if (typeof val == "string") {
        if (!isValidHeaderValue(val))
          throw new InvalidArgumentError(`invalid ${key} header`);
      } else val === null ? val = "" : val = `${val}`;
      if (headerName === "host") {
        if (request.host !== null)
          throw new InvalidArgumentError("duplicate host header");
        if (typeof val != "string")
          throw new InvalidArgumentError("invalid host header");
        request.host = val;
      } else if (headerName === "content-length") {
        if (request.contentLength !== null)
          throw new InvalidArgumentError("duplicate content-length header");
        if (request.contentLength = parseInt(val, 10), !Number.isFinite(request.contentLength))
          throw new InvalidArgumentError("invalid content-length header");
      } else if (request.contentType === null && headerName === "content-type")
        request.contentType = val, request.headers.push(key, val);
      else {
        if (headerName === "transfer-encoding" || headerName === "keep-alive" || headerName === "upgrade")
          throw new InvalidArgumentError(`invalid ${headerName} header`);
        if (headerName === "connection") {
          let value = typeof val == "string" ? val.toLowerCase() : null;
          if (value !== "close" && value !== "keep-alive")
            throw new InvalidArgumentError("invalid connection header");
          value === "close" && (request.reset = !0);
        } else {
          if (headerName === "expect")
            throw new NotSupportedError("expect header not supported");
          request.headers.push(key, val);
        }
      }
    }
    module.exports = Request;
  }
});

// node_modules/undici/lib/dispatcher/dispatcher.js
var require_dispatcher = __commonJS({
  "node_modules/undici/lib/dispatcher/dispatcher.js"(exports, module) {
    "use strict";
    var EventEmitter2 = __require("node:events"), Dispatcher = class extends EventEmitter2 {
      dispatch() {
        throw new Error("not implemented");
      }
      close() {
        throw new Error("not implemented");
      }
      destroy() {
        throw new Error("not implemented");
      }
      compose(...args) {
        let interceptors = Array.isArray(args[0]) ? args[0] : args, dispatch = this.dispatch.bind(this);
        for (let interceptor of interceptors)
          if (interceptor != null) {
            if (typeof interceptor != "function")
              throw new TypeError(`invalid interceptor, expected function received ${typeof interceptor}`);
            if (dispatch = interceptor(dispatch), dispatch == null || typeof dispatch != "function" || dispatch.length !== 2)
              throw new TypeError("invalid interceptor");
          }
        return new ComposedDispatcher(this, dispatch);
      }
    }, ComposedDispatcher = class extends Dispatcher {
      #dispatcher = null;
      #dispatch = null;
      constructor(dispatcher, dispatch) {
        super(), this.#dispatcher = dispatcher, this.#dispatch = dispatch;
      }
      dispatch(...args) {
        this.#dispatch(...args);
      }
      close(...args) {
        return this.#dispatcher.close(...args);
      }
      destroy(...args) {
        return this.#dispatcher.destroy(...args);
      }
    };
    module.exports = Dispatcher;
  }
});

// node_modules/undici/lib/dispatcher/dispatcher-base.js
var require_dispatcher_base = __commonJS({
  "node_modules/undici/lib/dispatcher/dispatcher-base.js"(exports, module) {
    "use strict";
    var Dispatcher = require_dispatcher(), {
      ClientDestroyedError,
      ClientClosedError,
      InvalidArgumentError
    } = require_errors(), { kDestroy, kClose, kClosed, kDestroyed, kDispatch, kInterceptors } = require_symbols(), kOnDestroyed = /* @__PURE__ */ Symbol("onDestroyed"), kOnClosed = /* @__PURE__ */ Symbol("onClosed"), kInterceptedDispatch = /* @__PURE__ */ Symbol("Intercepted Dispatch"), kWebSocketOptions = /* @__PURE__ */ Symbol("webSocketOptions"), DispatcherBase = class extends Dispatcher {
      constructor(opts) {
        super(), this[kDestroyed] = !1, this[kOnDestroyed] = null, this[kClosed] = !1, this[kOnClosed] = [], this[kWebSocketOptions] = opts?.webSocket ?? {};
      }
      get webSocketOptions() {
        return {
          maxPayloadSize: this[kWebSocketOptions].maxPayloadSize ?? 128 * 1024 * 1024
        };
      }
      get destroyed() {
        return this[kDestroyed];
      }
      get closed() {
        return this[kClosed];
      }
      get interceptors() {
        return this[kInterceptors];
      }
      set interceptors(newInterceptors) {
        if (newInterceptors) {
          for (let i = newInterceptors.length - 1; i >= 0; i--)
            if (typeof this[kInterceptors][i] != "function")
              throw new InvalidArgumentError("interceptor must be an function");
        }
        this[kInterceptors] = newInterceptors;
      }
      close(callback) {
        if (callback === void 0)
          return new Promise((resolve2, reject) => {
            this.close((err, data) => err ? reject(err) : resolve2(data));
          });
        if (typeof callback != "function")
          throw new InvalidArgumentError("invalid callback");
        if (this[kDestroyed]) {
          queueMicrotask(() => callback(new ClientDestroyedError(), null));
          return;
        }
        if (this[kClosed]) {
          this[kOnClosed] ? this[kOnClosed].push(callback) : queueMicrotask(() => callback(null, null));
          return;
        }
        this[kClosed] = !0, this[kOnClosed].push(callback);
        let onClosed = () => {
          let callbacks = this[kOnClosed];
          this[kOnClosed] = null;
          for (let i = 0; i < callbacks.length; i++)
            callbacks[i](null, null);
        };
        this[kClose]().then(() => this.destroy()).then(() => {
          queueMicrotask(onClosed);
        });
      }
      destroy(err, callback) {
        if (typeof err == "function" && (callback = err, err = null), callback === void 0)
          return new Promise((resolve2, reject) => {
            this.destroy(err, (err2, data) => err2 ? (
              /* istanbul ignore next: should never error */
              reject(err2)
            ) : resolve2(data));
          });
        if (typeof callback != "function")
          throw new InvalidArgumentError("invalid callback");
        if (this[kDestroyed]) {
          this[kOnDestroyed] ? this[kOnDestroyed].push(callback) : queueMicrotask(() => callback(null, null));
          return;
        }
        err || (err = new ClientDestroyedError()), this[kDestroyed] = !0, this[kOnDestroyed] = this[kOnDestroyed] || [], this[kOnDestroyed].push(callback);
        let onDestroyed = () => {
          let callbacks = this[kOnDestroyed];
          this[kOnDestroyed] = null;
          for (let i = 0; i < callbacks.length; i++)
            callbacks[i](null, null);
        };
        this[kDestroy](err).then(() => {
          queueMicrotask(onDestroyed);
        });
      }
      [kInterceptedDispatch](opts, handler) {
        if (!this[kInterceptors] || this[kInterceptors].length === 0)
          return this[kInterceptedDispatch] = this[kDispatch], this[kDispatch](opts, handler);
        let dispatch = this[kDispatch].bind(this);
        for (let i = this[kInterceptors].length - 1; i >= 0; i--)
          dispatch = this[kInterceptors][i](dispatch);
        return this[kInterceptedDispatch] = dispatch, dispatch(opts, handler);
      }
      dispatch(opts, handler) {
        if (!handler || typeof handler != "object")
          throw new InvalidArgumentError("handler must be an object");
        try {
          if (!opts || typeof opts != "object")
            throw new InvalidArgumentError("opts must be an object.");
          if (this[kDestroyed] || this[kOnDestroyed])
            throw new ClientDestroyedError();
          if (this[kClosed])
            throw new ClientClosedError();
          return this[kInterceptedDispatch](opts, handler);
        } catch (err) {
          if (typeof handler.onError != "function")
            throw new InvalidArgumentError("invalid onError method");
          return handler.onError(err), !1;
        }
      }
    };
    module.exports = DispatcherBase;
  }
});

// node_modules/undici/lib/util/timers.js
var require_timers = __commonJS({
  "node_modules/undici/lib/util/timers.js"(exports, module) {
    "use strict";
    var fastNow = 0, RESOLUTION_MS = 1e3, TICK_MS = (RESOLUTION_MS >> 1) - 1, fastNowTimeout, kFastTimer = /* @__PURE__ */ Symbol("kFastTimer"), fastTimers = [], NOT_IN_LIST = -2, TO_BE_CLEARED = -1, PENDING = 0, ACTIVE = 1;
    function onTick() {
      fastNow += TICK_MS;
      let idx = 0, len = fastTimers.length;
      for (; idx < len; ) {
        let timer = fastTimers[idx];
        timer._state === PENDING ? (timer._idleStart = fastNow - TICK_MS, timer._state = ACTIVE) : timer._state === ACTIVE && fastNow >= timer._idleStart + timer._idleTimeout && (timer._state = TO_BE_CLEARED, timer._idleStart = -1, timer._onTimeout(timer._timerArg)), timer._state === TO_BE_CLEARED ? (timer._state = NOT_IN_LIST, --len !== 0 && (fastTimers[idx] = fastTimers[len])) : ++idx;
      }
      fastTimers.length = len, fastTimers.length !== 0 && refreshTimeout();
    }
    function refreshTimeout() {
      fastNowTimeout ? fastNowTimeout.refresh() : (clearTimeout(fastNowTimeout), fastNowTimeout = setTimeout(onTick, TICK_MS), fastNowTimeout.unref && fastNowTimeout.unref());
    }
    var FastTimer = class {
      [kFastTimer] = !0;
      /**
       * The state of the timer, which can be one of the following:
       * - NOT_IN_LIST (-2)
       * - TO_BE_CLEARED (-1)
       * - PENDING (0)
       * - ACTIVE (1)
       *
       * @type {-2|-1|0|1}
       * @private
       */
      _state = NOT_IN_LIST;
      /**
       * The number of milliseconds to wait before calling the callback.
       *
       * @type {number}
       * @private
       */
      _idleTimeout = -1;
      /**
       * The time in milliseconds when the timer was started. This value is used to
       * calculate when the timer should expire.
       *
       * @type {number}
       * @default -1
       * @private
       */
      _idleStart = -1;
      /**
       * The function to be executed when the timer expires.
       * @type {Function}
       * @private
       */
      _onTimeout;
      /**
       * The argument to be passed to the callback when the timer expires.
       *
       * @type {*}
       * @private
       */
      _timerArg;
      /**
       * @constructor
       * @param {Function} callback A function to be executed after the timer
       * expires.
       * @param {number} delay The time, in milliseconds that the timer should wait
       * before the specified function or code is executed.
       * @param {*} arg
       */
      constructor(callback, delay, arg) {
        this._onTimeout = callback, this._idleTimeout = delay, this._timerArg = arg, this.refresh();
      }
      /**
       * Sets the timer's start time to the current time, and reschedules the timer
       * to call its callback at the previously specified duration adjusted to the
       * current time.
       * Using this on a timer that has already called its callback will reactivate
       * the timer.
       *
       * @returns {void}
       */
      refresh() {
        this._state === NOT_IN_LIST && fastTimers.push(this), (!fastNowTimeout || fastTimers.length === 1) && refreshTimeout(), this._state = PENDING;
      }
      /**
       * The `clear` method cancels the timer, preventing it from executing.
       *
       * @returns {void}
       * @private
       */
      clear() {
        this._state = TO_BE_CLEARED, this._idleStart = -1;
      }
    };
    module.exports = {
      /**
       * The setTimeout() method sets a timer which executes a function once the
       * timer expires.
       * @param {Function} callback A function to be executed after the timer
       * expires.
       * @param {number} delay The time, in milliseconds that the timer should
       * wait before the specified function or code is executed.
       * @param {*} [arg] An optional argument to be passed to the callback function
       * when the timer expires.
       * @returns {NodeJS.Timeout|FastTimer}
       */
      setTimeout(callback, delay, arg) {
        return delay <= RESOLUTION_MS ? setTimeout(callback, delay, arg) : new FastTimer(callback, delay, arg);
      },
      /**
       * The clearTimeout method cancels an instantiated Timer previously created
       * by calling setTimeout.
       *
       * @param {NodeJS.Timeout|FastTimer} timeout
       */
      clearTimeout(timeout) {
        timeout[kFastTimer] ? timeout.clear() : clearTimeout(timeout);
      },
      /**
       * The setFastTimeout() method sets a fastTimer which executes a function once
       * the timer expires.
       * @param {Function} callback A function to be executed after the timer
       * expires.
       * @param {number} delay The time, in milliseconds that the timer should
       * wait before the specified function or code is executed.
       * @param {*} [arg] An optional argument to be passed to the callback function
       * when the timer expires.
       * @returns {FastTimer}
       */
      setFastTimeout(callback, delay, arg) {
        return new FastTimer(callback, delay, arg);
      },
      /**
       * The clearTimeout method cancels an instantiated FastTimer previously
       * created by calling setFastTimeout.
       *
       * @param {FastTimer} timeout
       */
      clearFastTimeout(timeout) {
        timeout.clear();
      },
      /**
       * The now method returns the value of the internal fast timer clock.
       *
       * @returns {number}
       */
      now() {
        return fastNow;
      },
      /**
       * Trigger the onTick function to process the fastTimers array.
       * Exported for testing purposes only.
       * Marking as deprecated to discourage any use outside of testing.
       * @deprecated
       * @param {number} [delay=0] The delay in milliseconds to add to the now value.
       */
      tick(delay = 0) {
        fastNow += delay - RESOLUTION_MS + 1, onTick(), onTick();
      },
      /**
       * Reset FastTimers.
       * Exported for testing purposes only.
       * Marking as deprecated to discourage any use outside of testing.
       * @deprecated
       */
      reset() {
        fastNow = 0, fastTimers.length = 0, clearTimeout(fastNowTimeout), fastNowTimeout = null;
      },
      /**
       * Exporting for testing purposes only.
       * Marking as deprecated to discourage any use outside of testing.
       * @deprecated
       */
      kFastTimer
    };
  }
});

// node_modules/undici/lib/core/connect.js
var require_connect = __commonJS({
  "node_modules/undici/lib/core/connect.js"(exports, module) {
    "use strict";
    var net = __require("node:net"), assert = __require("node:assert"), util = require_util(), { InvalidArgumentError, ConnectTimeoutError } = require_errors(), timers = require_timers();
    function noop() {
    }
    var tls, SessionCache;
    global.FinalizationRegistry && !(process.env.NODE_V8_COVERAGE || process.env.UNDICI_NO_FG) ? SessionCache = class {
      constructor(maxCachedSessions) {
        this._maxCachedSessions = maxCachedSessions, this._sessionCache = /* @__PURE__ */ new Map(), this._sessionRegistry = new global.FinalizationRegistry((key) => {
          if (this._sessionCache.size < this._maxCachedSessions)
            return;
          let ref = this._sessionCache.get(key);
          ref !== void 0 && ref.deref() === void 0 && this._sessionCache.delete(key);
        });
      }
      get(sessionKey) {
        let ref = this._sessionCache.get(sessionKey);
        return ref ? ref.deref() : null;
      }
      set(sessionKey, session) {
        this._maxCachedSessions !== 0 && (this._sessionCache.set(sessionKey, new WeakRef(session)), this._sessionRegistry.register(session, sessionKey));
      }
    } : SessionCache = class {
      constructor(maxCachedSessions) {
        this._maxCachedSessions = maxCachedSessions, this._sessionCache = /* @__PURE__ */ new Map();
      }
      get(sessionKey) {
        return this._sessionCache.get(sessionKey);
      }
      set(sessionKey, session) {
        if (this._maxCachedSessions !== 0) {
          if (this._sessionCache.size >= this._maxCachedSessions) {
            let { value: oldestKey } = this._sessionCache.keys().next();
            this._sessionCache.delete(oldestKey);
          }
          this._sessionCache.set(sessionKey, session);
        }
      }
    };
    function buildConnector({ allowH2, maxCachedSessions, socketPath, timeout, session: customSession, ...opts }) {
      if (maxCachedSessions != null && (!Number.isInteger(maxCachedSessions) || maxCachedSessions < 0))
        throw new InvalidArgumentError("maxCachedSessions must be a positive integer or zero");
      let options = { path: socketPath, ...opts }, sessionCache = new SessionCache(maxCachedSessions ?? 100);
      return timeout = timeout ?? 1e4, allowH2 = allowH2 ?? !1, function({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback) {
        let socket;
        if (protocol === "https:") {
          tls || (tls = __require("node:tls")), servername = servername || options.servername || util.getServerName(host) || null;
          let sessionKey = servername || hostname;
          assert(sessionKey);
          let session = customSession || sessionCache.get(sessionKey) || null;
          port = port || 443, socket = tls.connect({
            highWaterMark: 16384,
            // TLS in node can't have bigger HWM anyway...
            ...options,
            servername,
            session,
            localAddress,
            // TODO(HTTP/2): Add support for h2c
            ALPNProtocols: allowH2 ? ["http/1.1", "h2"] : ["http/1.1"],
            socket: httpSocket,
            // upgrade socket connection
            port,
            host: hostname
          }), socket.on("session", function(session2) {
            sessionCache.set(sessionKey, session2);
          });
        } else
          assert(!httpSocket, "httpSocket can only be sent on TLS update"), port = port || 80, socket = net.connect({
            highWaterMark: 64 * 1024,
            // Same as nodejs fs streams.
            ...options,
            localAddress,
            port,
            host: hostname
          });
        if (options.keepAlive == null || options.keepAlive) {
          let keepAliveInitialDelay = options.keepAliveInitialDelay === void 0 ? 6e4 : options.keepAliveInitialDelay;
          socket.setKeepAlive(!0, keepAliveInitialDelay);
        }
        let clearConnectTimeout = setupConnectTimeout(new WeakRef(socket), { timeout, hostname, port });
        return socket.setNoDelay(!0).once(protocol === "https:" ? "secureConnect" : "connect", function() {
          if (queueMicrotask(clearConnectTimeout), callback) {
            let cb = callback;
            callback = null, cb(null, this);
          }
        }).on("error", function(err) {
          if (queueMicrotask(clearConnectTimeout), callback) {
            let cb = callback;
            callback = null, cb(err);
          }
        }), socket;
      };
    }
    var setupConnectTimeout = process.platform === "win32" ? (socketWeakRef, opts) => {
      if (!opts.timeout)
        return noop;
      let s1 = null, s2 = null, fastTimer = timers.setFastTimeout(() => {
        s1 = setImmediate(() => {
          s2 = setImmediate(() => onConnectTimeout(socketWeakRef.deref(), opts));
        });
      }, opts.timeout);
      return () => {
        timers.clearFastTimeout(fastTimer), clearImmediate(s1), clearImmediate(s2);
      };
    } : (socketWeakRef, opts) => {
      if (!opts.timeout)
        return noop;
      let s1 = null, fastTimer = timers.setFastTimeout(() => {
        s1 = setImmediate(() => {
          onConnectTimeout(socketWeakRef.deref(), opts);
        });
      }, opts.timeout);
      return () => {
        timers.clearFastTimeout(fastTimer), clearImmediate(s1);
      };
    };
    function onConnectTimeout(socket, opts) {
      if (socket == null)
        return;
      let message = "Connect Timeout Error";
      Array.isArray(socket.autoSelectFamilyAttemptedAddresses) ? message += ` (attempted addresses: ${socket.autoSelectFamilyAttemptedAddresses.join(", ")},` : message += ` (attempted address: ${opts.hostname}:${opts.port},`, message += ` timeout: ${opts.timeout}ms)`, util.destroy(socket, new ConnectTimeoutError(message));
    }
    module.exports = buildConnector;
  }
});

// node_modules/undici/lib/llhttp/utils.js
var require_utils = __commonJS({
  "node_modules/undici/lib/llhttp/utils.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.enumToMap = void 0;
    function enumToMap(obj) {
      let res = {};
      return Object.keys(obj).forEach((key) => {
        let value = obj[key];
        typeof value == "number" && (res[key] = value);
      }), res;
    }
    exports.enumToMap = enumToMap;
  }
});

// node_modules/undici/lib/llhttp/constants.js
var require_constants2 = __commonJS({
  "node_modules/undici/lib/llhttp/constants.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.SPECIAL_HEADERS = exports.HEADER_STATE = exports.MINOR = exports.MAJOR = exports.CONNECTION_TOKEN_CHARS = exports.HEADER_CHARS = exports.TOKEN = exports.STRICT_TOKEN = exports.HEX = exports.URL_CHAR = exports.STRICT_URL_CHAR = exports.USERINFO_CHARS = exports.MARK = exports.ALPHANUM = exports.NUM = exports.HEX_MAP = exports.NUM_MAP = exports.ALPHA = exports.FINISH = exports.H_METHOD_MAP = exports.METHOD_MAP = exports.METHODS_RTSP = exports.METHODS_ICE = exports.METHODS_HTTP = exports.METHODS = exports.LENIENT_FLAGS = exports.FLAGS = exports.TYPE = exports.ERROR = void 0;
    var utils_1 = require_utils(), ERROR;
    (function(ERROR2) {
      ERROR2[ERROR2.OK = 0] = "OK", ERROR2[ERROR2.INTERNAL = 1] = "INTERNAL", ERROR2[ERROR2.STRICT = 2] = "STRICT", ERROR2[ERROR2.LF_EXPECTED = 3] = "LF_EXPECTED", ERROR2[ERROR2.UNEXPECTED_CONTENT_LENGTH = 4] = "UNEXPECTED_CONTENT_LENGTH", ERROR2[ERROR2.CLOSED_CONNECTION = 5] = "CLOSED_CONNECTION", ERROR2[ERROR2.INVALID_METHOD = 6] = "INVALID_METHOD", ERROR2[ERROR2.INVALID_URL = 7] = "INVALID_URL", ERROR2[ERROR2.INVALID_CONSTANT = 8] = "INVALID_CONSTANT", ERROR2[ERROR2.INVALID_VERSION = 9] = "INVALID_VERSION", ERROR2[ERROR2.INVALID_HEADER_TOKEN = 10] = "INVALID_HEADER_TOKEN", ERROR2[ERROR2.INVALID_CONTENT_LENGTH = 11] = "INVALID_CONTENT_LENGTH", ERROR2[ERROR2.INVALID_CHUNK_SIZE = 12] = "INVALID_CHUNK_SIZE", ERROR2[ERROR2.INVALID_STATUS = 13] = "INVALID_STATUS", ERROR2[ERROR2.INVALID_EOF_STATE = 14] = "INVALID_EOF_STATE", ERROR2[ERROR2.INVALID_TRANSFER_ENCODING = 15] = "INVALID_TRANSFER_ENCODING", ERROR2[ERROR2.CB_MESSAGE_BEGIN = 16] = "CB_MESSAGE_BEGIN", ERROR2[ERROR2.CB_HEADERS_COMPLETE = 17] = "CB_HEADERS_COMPLETE", ERROR2[ERROR2.CB_MESSAGE_COMPLETE = 18] = "CB_MESSAGE_COMPLETE", ERROR2[ERROR2.CB_CHUNK_HEADER = 19] = "CB_CHUNK_HEADER", ERROR2[ERROR2.CB_CHUNK_COMPLETE = 20] = "CB_CHUNK_COMPLETE", ERROR2[ERROR2.PAUSED = 21] = "PAUSED", ERROR2[ERROR2.PAUSED_UPGRADE = 22] = "PAUSED_UPGRADE", ERROR2[ERROR2.PAUSED_H2_UPGRADE = 23] = "PAUSED_H2_UPGRADE", ERROR2[ERROR2.USER = 24] = "USER";
    })(ERROR = exports.ERROR || (exports.ERROR = {}));
    var TYPE;
    (function(TYPE2) {
      TYPE2[TYPE2.BOTH = 0] = "BOTH", TYPE2[TYPE2.REQUEST = 1] = "REQUEST", TYPE2[TYPE2.RESPONSE = 2] = "RESPONSE";
    })(TYPE = exports.TYPE || (exports.TYPE = {}));
    var FLAGS;
    (function(FLAGS2) {
      FLAGS2[FLAGS2.CONNECTION_KEEP_ALIVE = 1] = "CONNECTION_KEEP_ALIVE", FLAGS2[FLAGS2.CONNECTION_CLOSE = 2] = "CONNECTION_CLOSE", FLAGS2[FLAGS2.CONNECTION_UPGRADE = 4] = "CONNECTION_UPGRADE", FLAGS2[FLAGS2.CHUNKED = 8] = "CHUNKED", FLAGS2[FLAGS2.UPGRADE = 16] = "UPGRADE", FLAGS2[FLAGS2.CONTENT_LENGTH = 32] = "CONTENT_LENGTH", FLAGS2[FLAGS2.SKIPBODY = 64] = "SKIPBODY", FLAGS2[FLAGS2.TRAILING = 128] = "TRAILING", FLAGS2[FLAGS2.TRANSFER_ENCODING = 512] = "TRANSFER_ENCODING";
    })(FLAGS = exports.FLAGS || (exports.FLAGS = {}));
    var LENIENT_FLAGS;
    (function(LENIENT_FLAGS2) {
      LENIENT_FLAGS2[LENIENT_FLAGS2.HEADERS = 1] = "HEADERS", LENIENT_FLAGS2[LENIENT_FLAGS2.CHUNKED_LENGTH = 2] = "CHUNKED_LENGTH", LENIENT_FLAGS2[LENIENT_FLAGS2.KEEP_ALIVE = 4] = "KEEP_ALIVE";
    })(LENIENT_FLAGS = exports.LENIENT_FLAGS || (exports.LENIENT_FLAGS = {}));
    var METHODS;
    (function(METHODS2) {
      METHODS2[METHODS2.DELETE = 0] = "DELETE", METHODS2[METHODS2.GET = 1] = "GET", METHODS2[METHODS2.HEAD = 2] = "HEAD", METHODS2[METHODS2.POST = 3] = "POST", METHODS2[METHODS2.PUT = 4] = "PUT", METHODS2[METHODS2.CONNECT = 5] = "CONNECT", METHODS2[METHODS2.OPTIONS = 6] = "OPTIONS", METHODS2[METHODS2.TRACE = 7] = "TRACE", METHODS2[METHODS2.COPY = 8] = "COPY", METHODS2[METHODS2.LOCK = 9] = "LOCK", METHODS2[METHODS2.MKCOL = 10] = "MKCOL", METHODS2[METHODS2.MOVE = 11] = "MOVE", METHODS2[METHODS2.PROPFIND = 12] = "PROPFIND", METHODS2[METHODS2.PROPPATCH = 13] = "PROPPATCH", METHODS2[METHODS2.SEARCH = 14] = "SEARCH", METHODS2[METHODS2.UNLOCK = 15] = "UNLOCK", METHODS2[METHODS2.BIND = 16] = "BIND", METHODS2[METHODS2.REBIND = 17] = "REBIND", METHODS2[METHODS2.UNBIND = 18] = "UNBIND", METHODS2[METHODS2.ACL = 19] = "ACL", METHODS2[METHODS2.REPORT = 20] = "REPORT", METHODS2[METHODS2.MKACTIVITY = 21] = "MKACTIVITY", METHODS2[METHODS2.CHECKOUT = 22] = "CHECKOUT", METHODS2[METHODS2.MERGE = 23] = "MERGE", METHODS2[METHODS2["M-SEARCH"] = 24] = "M-SEARCH", METHODS2[METHODS2.NOTIFY = 25] = "NOTIFY", METHODS2[METHODS2.SUBSCRIBE = 26] = "SUBSCRIBE", METHODS2[METHODS2.UNSUBSCRIBE = 27] = "UNSUBSCRIBE", METHODS2[METHODS2.PATCH = 28] = "PATCH", METHODS2[METHODS2.PURGE = 29] = "PURGE", METHODS2[METHODS2.MKCALENDAR = 30] = "MKCALENDAR", METHODS2[METHODS2.LINK = 31] = "LINK", METHODS2[METHODS2.UNLINK = 32] = "UNLINK", METHODS2[METHODS2.SOURCE = 33] = "SOURCE", METHODS2[METHODS2.PRI = 34] = "PRI", METHODS2[METHODS2.DESCRIBE = 35] = "DESCRIBE", METHODS2[METHODS2.ANNOUNCE = 36] = "ANNOUNCE", METHODS2[METHODS2.SETUP = 37] = "SETUP", METHODS2[METHODS2.PLAY = 38] = "PLAY", METHODS2[METHODS2.PAUSE = 39] = "PAUSE", METHODS2[METHODS2.TEARDOWN = 40] = "TEARDOWN", METHODS2[METHODS2.GET_PARAMETER = 41] = "GET_PARAMETER", METHODS2[METHODS2.SET_PARAMETER = 42] = "SET_PARAMETER", METHODS2[METHODS2.REDIRECT = 43] = "REDIRECT", METHODS2[METHODS2.RECORD = 44] = "RECORD", METHODS2[METHODS2.FLUSH = 45] = "FLUSH";
    })(METHODS = exports.METHODS || (exports.METHODS = {}));
    exports.METHODS_HTTP = [
      METHODS.DELETE,
      METHODS.GET,
      METHODS.HEAD,
      METHODS.POST,
      METHODS.PUT,
      METHODS.CONNECT,
      METHODS.OPTIONS,
      METHODS.TRACE,
      METHODS.COPY,
      METHODS.LOCK,
      METHODS.MKCOL,
      METHODS.MOVE,
      METHODS.PROPFIND,
      METHODS.PROPPATCH,
      METHODS.SEARCH,
      METHODS.UNLOCK,
      METHODS.BIND,
      METHODS.REBIND,
      METHODS.UNBIND,
      METHODS.ACL,
      METHODS.REPORT,
      METHODS.MKACTIVITY,
      METHODS.CHECKOUT,
      METHODS.MERGE,
      METHODS["M-SEARCH"],
      METHODS.NOTIFY,
      METHODS.SUBSCRIBE,
      METHODS.UNSUBSCRIBE,
      METHODS.PATCH,
      METHODS.PURGE,
      METHODS.MKCALENDAR,
      METHODS.LINK,
      METHODS.UNLINK,
      METHODS.PRI,
      // TODO(indutny): should we allow it with HTTP?
      METHODS.SOURCE
    ];
    exports.METHODS_ICE = [
      METHODS.SOURCE
    ];
    exports.METHODS_RTSP = [
      METHODS.OPTIONS,
      METHODS.DESCRIBE,
      METHODS.ANNOUNCE,
      METHODS.SETUP,
      METHODS.PLAY,
      METHODS.PAUSE,
      METHODS.TEARDOWN,
      METHODS.GET_PARAMETER,
      METHODS.SET_PARAMETER,
      METHODS.REDIRECT,
      METHODS.RECORD,
      METHODS.FLUSH,
      // For AirPlay
      METHODS.GET,
      METHODS.POST
    ];
    exports.METHOD_MAP = utils_1.enumToMap(METHODS);
    exports.H_METHOD_MAP = {};
    Object.keys(exports.METHOD_MAP).forEach((key) => {
      /^H/.test(key) && (exports.H_METHOD_MAP[key] = exports.METHOD_MAP[key]);
    });
    var FINISH;
    (function(FINISH2) {
      FINISH2[FINISH2.SAFE = 0] = "SAFE", FINISH2[FINISH2.SAFE_WITH_CB = 1] = "SAFE_WITH_CB", FINISH2[FINISH2.UNSAFE = 2] = "UNSAFE";
    })(FINISH = exports.FINISH || (exports.FINISH = {}));
    exports.ALPHA = [];
    for (let i = 65; i <= 90; i++)
      exports.ALPHA.push(String.fromCharCode(i)), exports.ALPHA.push(String.fromCharCode(i + 32));
    exports.NUM_MAP = {
      0: 0,
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      8: 8,
      9: 9
    };
    exports.HEX_MAP = {
      0: 0,
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      8: 8,
      9: 9,
      A: 10,
      B: 11,
      C: 12,
      D: 13,
      E: 14,
      F: 15,
      a: 10,
      b: 11,
      c: 12,
      d: 13,
      e: 14,
      f: 15
    };
    exports.NUM = [
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9"
    ];
    exports.ALPHANUM = exports.ALPHA.concat(exports.NUM);
    exports.MARK = ["-", "_", ".", "!", "~", "*", "'", "(", ")"];
    exports.USERINFO_CHARS = exports.ALPHANUM.concat(exports.MARK).concat(["%", ";", ":", "&", "=", "+", "$", ","]);
    exports.STRICT_URL_CHAR = [
      "!",
      '"',
      "$",
      "%",
      "&",
      "'",
      "(",
      ")",
      "*",
      "+",
      ",",
      "-",
      ".",
      "/",
      ":",
      ";",
      "<",
      "=",
      ">",
      "@",
      "[",
      "\\",
      "]",
      "^",
      "_",
      "`",
      "{",
      "|",
      "}",
      "~"
    ].concat(exports.ALPHANUM);
    exports.URL_CHAR = exports.STRICT_URL_CHAR.concat(["	", "\f"]);
    for (let i = 128; i <= 255; i++)
      exports.URL_CHAR.push(i);
    exports.HEX = exports.NUM.concat(["a", "b", "c", "d", "e", "f", "A", "B", "C", "D", "E", "F"]);
    exports.STRICT_TOKEN = [
      "!",
      "#",
      "$",
      "%",
      "&",
      "'",
      "*",
      "+",
      "-",
      ".",
      "^",
      "_",
      "`",
      "|",
      "~"
    ].concat(exports.ALPHANUM);
    exports.TOKEN = exports.STRICT_TOKEN.concat([" "]);
    exports.HEADER_CHARS = ["	"];
    for (let i = 32; i <= 255; i++)
      i !== 127 && exports.HEADER_CHARS.push(i);
    exports.CONNECTION_TOKEN_CHARS = exports.HEADER_CHARS.filter((c) => c !== 44);
    exports.MAJOR = exports.NUM_MAP;
    exports.MINOR = exports.MAJOR;
    var HEADER_STATE;
    (function(HEADER_STATE2) {
      HEADER_STATE2[HEADER_STATE2.GENERAL = 0] = "GENERAL", HEADER_STATE2[HEADER_STATE2.CONNECTION = 1] = "CONNECTION", HEADER_STATE2[HEADER_STATE2.CONTENT_LENGTH = 2] = "CONTENT_LENGTH", HEADER_STATE2[HEADER_STATE2.TRANSFER_ENCODING = 3] = "TRANSFER_ENCODING", HEADER_STATE2[HEADER_STATE2.UPGRADE = 4] = "UPGRADE", HEADER_STATE2[HEADER_STATE2.CONNECTION_KEEP_ALIVE = 5] = "CONNECTION_KEEP_ALIVE", HEADER_STATE2[HEADER_STATE2.CONNECTION_CLOSE = 6] = "CONNECTION_CLOSE", HEADER_STATE2[HEADER_STATE2.CONNECTION_UPGRADE = 7] = "CONNECTION_UPGRADE", HEADER_STATE2[HEADER_STATE2.TRANSFER_ENCODING_CHUNKED = 8] = "TRANSFER_ENCODING_CHUNKED";
    })(HEADER_STATE = exports.HEADER_STATE || (exports.HEADER_STATE = {}));
    exports.SPECIAL_HEADERS = {
      connection: HEADER_STATE.CONNECTION,
      "content-length": HEADER_STATE.CONTENT_LENGTH,
      "proxy-connection": HEADER_STATE.CONNECTION,
      "transfer-encoding": HEADER_STATE.TRANSFER_ENCODING,
      upgrade: HEADER_STATE.UPGRADE
    };
  }
});

// node_modules/undici/lib/llhttp/llhttp-wasm.js
var require_llhttp_wasm = __commonJS({
  "node_modules/undici/lib/llhttp/llhttp-wasm.js"(exports, module) {
    "use strict";
    var { Buffer: Buffer2 } = __require("node:buffer");
    module.exports = Buffer2.from("AGFzbQEAAAABJwdgAX8Bf2ADf39/AX9gAX8AYAJ/fwBgBH9/f38Bf2AAAGADf39/AALLAQgDZW52GHdhc21fb25faGVhZGVyc19jb21wbGV0ZQAEA2VudhV3YXNtX29uX21lc3NhZ2VfYmVnaW4AAANlbnYLd2FzbV9vbl91cmwAAQNlbnYOd2FzbV9vbl9zdGF0dXMAAQNlbnYUd2FzbV9vbl9oZWFkZXJfZmllbGQAAQNlbnYUd2FzbV9vbl9oZWFkZXJfdmFsdWUAAQNlbnYMd2FzbV9vbl9ib2R5AAEDZW52GHdhc21fb25fbWVzc2FnZV9jb21wbGV0ZQAAAy0sBQYAAAIAAAAAAAACAQIAAgICAAADAAAAAAMDAwMBAQEBAQEBAQEAAAIAAAAEBQFwARISBQMBAAIGCAF/AUGA1AQLB9EFIgZtZW1vcnkCAAtfaW5pdGlhbGl6ZQAIGV9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGUBAAtsbGh0dHBfaW5pdAAJGGxsaHR0cF9zaG91bGRfa2VlcF9hbGl2ZQAvDGxsaHR0cF9hbGxvYwALBm1hbGxvYwAxC2xsaHR0cF9mcmVlAAwEZnJlZQAMD2xsaHR0cF9nZXRfdHlwZQANFWxsaHR0cF9nZXRfaHR0cF9tYWpvcgAOFWxsaHR0cF9nZXRfaHR0cF9taW5vcgAPEWxsaHR0cF9nZXRfbWV0aG9kABAWbGxodHRwX2dldF9zdGF0dXNfY29kZQAREmxsaHR0cF9nZXRfdXBncmFkZQASDGxsaHR0cF9yZXNldAATDmxsaHR0cF9leGVjdXRlABQUbGxodHRwX3NldHRpbmdzX2luaXQAFQ1sbGh0dHBfZmluaXNoABYMbGxodHRwX3BhdXNlABcNbGxodHRwX3Jlc3VtZQAYG2xsaHR0cF9yZXN1bWVfYWZ0ZXJfdXBncmFkZQAZEGxsaHR0cF9nZXRfZXJybm8AGhdsbGh0dHBfZ2V0X2Vycm9yX3JlYXNvbgAbF2xsaHR0cF9zZXRfZXJyb3JfcmVhc29uABwUbGxodHRwX2dldF9lcnJvcl9wb3MAHRFsbGh0dHBfZXJybm9fbmFtZQAeEmxsaHR0cF9tZXRob2RfbmFtZQAfEmxsaHR0cF9zdGF0dXNfbmFtZQAgGmxsaHR0cF9zZXRfbGVuaWVudF9oZWFkZXJzACEhbGxodHRwX3NldF9sZW5pZW50X2NodW5rZWRfbGVuZ3RoACIdbGxodHRwX3NldF9sZW5pZW50X2tlZXBfYWxpdmUAIyRsbGh0dHBfc2V0X2xlbmllbnRfdHJhbnNmZXJfZW5jb2RpbmcAJBhsbGh0dHBfbWVzc2FnZV9uZWVkc19lb2YALgkXAQBBAQsRAQIDBAUKBgcrLSwqKSglJyYK07MCLBYAQYjQACgCAARAAAtBiNAAQQE2AgALFAAgABAwIAAgAjYCOCAAIAE6ACgLFAAgACAALwEyIAAtAC4gABAvEAALHgEBf0HAABAyIgEQMCABQYAINgI4IAEgADoAKCABC48MAQd/AkAgAEUNACAAQQhrIgEgAEEEaygCACIAQXhxIgRqIQUCQCAAQQFxDQAgAEEDcUUNASABIAEoAgAiAGsiAUGc0AAoAgBJDQEgACAEaiEEAkACQEGg0AAoAgAgAUcEQCAAQf8BTQRAIABBA3YhAyABKAIIIgAgASgCDCICRgRAQYzQAEGM0AAoAgBBfiADd3E2AgAMBQsgAiAANgIIIAAgAjYCDAwECyABKAIYIQYgASABKAIMIgBHBEAgACABKAIIIgI2AgggAiAANgIMDAMLIAFBFGoiAygCACICRQRAIAEoAhAiAkUNAiABQRBqIQMLA0AgAyEHIAIiAEEUaiIDKAIAIgINACAAQRBqIQMgACgCECICDQALIAdBADYCAAwCCyAFKAIEIgBBA3FBA0cNAiAFIABBfnE2AgRBlNAAIAQ2AgAgBSAENgIAIAEgBEEBcjYCBAwDC0EAIQALIAZFDQACQCABKAIcIgJBAnRBvNIAaiIDKAIAIAFGBEAgAyAANgIAIAANAUGQ0ABBkNAAKAIAQX4gAndxNgIADAILIAZBEEEUIAYoAhAgAUYbaiAANgIAIABFDQELIAAgBjYCGCABKAIQIgIEQCAAIAI2AhAgAiAANgIYCyABQRRqKAIAIgJFDQAgAEEUaiACNgIAIAIgADYCGAsgASAFTw0AIAUoAgQiAEEBcUUNAAJAAkACQAJAIABBAnFFBEBBpNAAKAIAIAVGBEBBpNAAIAE2AgBBmNAAQZjQACgCACAEaiIANgIAIAEgAEEBcjYCBCABQaDQACgCAEcNBkGU0ABBADYCAEGg0ABBADYCAAwGC0Gg0AAoAgAgBUYEQEGg0AAgATYCAEGU0ABBlNAAKAIAIARqIgA2AgAgASAAQQFyNgIEIAAgAWogADYCAAwGCyAAQXhxIARqIQQgAEH/AU0EQCAAQQN2IQMgBSgCCCIAIAUoAgwiAkYEQEGM0ABBjNAAKAIAQX4gA3dxNgIADAULIAIgADYCCCAAIAI2AgwMBAsgBSgCGCEGIAUgBSgCDCIARwRAQZzQACgCABogACAFKAIIIgI2AgggAiAANgIMDAMLIAVBFGoiAygCACICRQRAIAUoAhAiAkUNAiAFQRBqIQMLA0AgAyEHIAIiAEEUaiIDKAIAIgINACAAQRBqIQMgACgCECICDQALIAdBADYCAAwCCyAFIABBfnE2AgQgASAEaiAENgIAIAEgBEEBcjYCBAwDC0EAIQALIAZFDQACQCAFKAIcIgJBAnRBvNIAaiIDKAIAIAVGBEAgAyAANgIAIAANAUGQ0ABBkNAAKAIAQX4gAndxNgIADAILIAZBEEEUIAYoAhAgBUYbaiAANgIAIABFDQELIAAgBjYCGCAFKAIQIgIEQCAAIAI2AhAgAiAANgIYCyAFQRRqKAIAIgJFDQAgAEEUaiACNgIAIAIgADYCGAsgASAEaiAENgIAIAEgBEEBcjYCBCABQaDQACgCAEcNAEGU0AAgBDYCAAwBCyAEQf8BTQRAIARBeHFBtNAAaiEAAn9BjNAAKAIAIgJBASAEQQN2dCIDcUUEQEGM0AAgAiADcjYCACAADAELIAAoAggLIgIgATYCDCAAIAE2AgggASAANgIMIAEgAjYCCAwBC0EfIQIgBEH///8HTQRAIARBJiAEQQh2ZyIAa3ZBAXEgAEEBdGtBPmohAgsgASACNgIcIAFCADcCECACQQJ0QbzSAGohAAJAQZDQACgCACIDQQEgAnQiB3FFBEAgACABNgIAQZDQACADIAdyNgIAIAEgADYCGCABIAE2AgggASABNgIMDAELIARBGSACQQF2a0EAIAJBH0cbdCECIAAoAgAhAAJAA0AgACIDKAIEQXhxIARGDQEgAkEddiEAIAJBAXQhAiADIABBBHFqQRBqIgcoAgAiAA0ACyAHIAE2AgAgASADNgIYIAEgATYCDCABIAE2AggMAQsgAygCCCIAIAE2AgwgAyABNgIIIAFBADYCGCABIAM2AgwgASAANgIIC0Gs0ABBrNAAKAIAQQFrIgBBfyAAGzYCAAsLBwAgAC0AKAsHACAALQAqCwcAIAAtACsLBwAgAC0AKQsHACAALwEyCwcAIAAtAC4LQAEEfyAAKAIYIQEgAC0ALSECIAAtACghAyAAKAI4IQQgABAwIAAgBDYCOCAAIAM6ACggACACOgAtIAAgATYCGAu74gECB38DfiABIAJqIQQCQCAAIgIoAgwiAA0AIAIoAgQEQCACIAE2AgQLIwBBEGsiCCQAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAIoAhwiA0EBaw7dAdoBAdkBAgMEBQYHCAkKCwwNDtgBDxDXARES1gETFBUWFxgZGhvgAd8BHB0e1QEfICEiIyQl1AEmJygpKiss0wHSAS0u0QHQAS8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRtsBR0hJSs8BzgFLzQFMzAFNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AAYEBggGDAYQBhQGGAYcBiAGJAYoBiwGMAY0BjgGPAZABkQGSAZMBlAGVAZYBlwGYAZkBmgGbAZwBnQGeAZ8BoAGhAaIBowGkAaUBpgGnAagBqQGqAasBrAGtAa4BrwGwAbEBsgGzAbQBtQG2AbcBywHKAbgByQG5AcgBugG7AbwBvQG+Ab8BwAHBAcIBwwHEAcUBxgEA3AELQQAMxgELQQ4MxQELQQ0MxAELQQ8MwwELQRAMwgELQRMMwQELQRQMwAELQRUMvwELQRYMvgELQRgMvQELQRkMvAELQRoMuwELQRsMugELQRwMuQELQR0MuAELQQgMtwELQR4MtgELQSAMtQELQR8MtAELQQcMswELQSEMsgELQSIMsQELQSMMsAELQSQMrwELQRIMrgELQREMrQELQSUMrAELQSYMqwELQScMqgELQSgMqQELQcMBDKgBC0EqDKcBC0ErDKYBC0EsDKUBC0EtDKQBC0EuDKMBC0EvDKIBC0HEAQyhAQtBMAygAQtBNAyfAQtBDAyeAQtBMQydAQtBMgycAQtBMwybAQtBOQyaAQtBNQyZAQtBxQEMmAELQQsMlwELQToMlgELQTYMlQELQQoMlAELQTcMkwELQTgMkgELQTwMkQELQTsMkAELQT0MjwELQQkMjgELQSkMjQELQT4MjAELQT8MiwELQcAADIoBC0HBAAyJAQtBwgAMiAELQcMADIcBC0HEAAyGAQtBxQAMhQELQcYADIQBC0EXDIMBC0HHAAyCAQtByAAMgQELQckADIABC0HKAAx/C0HLAAx+C0HNAAx9C0HMAAx8C0HOAAx7C0HPAAx6C0HQAAx5C0HRAAx4C0HSAAx3C0HTAAx2C0HUAAx1C0HWAAx0C0HVAAxzC0EGDHILQdcADHELQQUMcAtB2AAMbwtBBAxuC0HZAAxtC0HaAAxsC0HbAAxrC0HcAAxqC0EDDGkLQd0ADGgLQd4ADGcLQd8ADGYLQeEADGULQeAADGQLQeIADGMLQeMADGILQQIMYQtB5AAMYAtB5QAMXwtB5gAMXgtB5wAMXQtB6AAMXAtB6QAMWwtB6gAMWgtB6wAMWQtB7AAMWAtB7QAMVwtB7gAMVgtB7wAMVQtB8AAMVAtB8QAMUwtB8gAMUgtB8wAMUQtB9AAMUAtB9QAMTwtB9gAMTgtB9wAMTQtB+AAMTAtB+QAMSwtB+gAMSgtB+wAMSQtB/AAMSAtB/QAMRwtB/gAMRgtB/wAMRQtBgAEMRAtBgQEMQwtBggEMQgtBgwEMQQtBhAEMQAtBhQEMPwtBhgEMPgtBhwEMPQtBiAEMPAtBiQEMOwtBigEMOgtBiwEMOQtBjAEMOAtBjQEMNwtBjgEMNgtBjwEMNQtBkAEMNAtBkQEMMwtBkgEMMgtBkwEMMQtBlAEMMAtBlQEMLwtBlgEMLgtBlwEMLQtBmAEMLAtBmQEMKwtBmgEMKgtBmwEMKQtBnAEMKAtBnQEMJwtBngEMJgtBnwEMJQtBoAEMJAtBoQEMIwtBogEMIgtBowEMIQtBpAEMIAtBpQEMHwtBpgEMHgtBpwEMHQtBqAEMHAtBqQEMGwtBqgEMGgtBqwEMGQtBrAEMGAtBrQEMFwtBrgEMFgtBAQwVC0GvAQwUC0GwAQwTC0GxAQwSC0GzAQwRC0GyAQwQC0G0AQwPC0G1AQwOC0G2AQwNC0G3AQwMC0G4AQwLC0G5AQwKC0G6AQwJC0G7AQwIC0HGAQwHC0G8AQwGC0G9AQwFC0G+AQwEC0G/AQwDC0HAAQwCC0HCAQwBC0HBAQshAwNAAkACQAJAAkACQAJAAkACQAJAIAICfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAgJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACfwJAAkACfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAC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iQEhAwykAgtBASABLQAAQd8ARw1nGiABQQFqIQEMXgtBigEhAyABIARGDaICIAIoAgAiACAEIAFraiEFIAEgAGtBAWohBgNAIAEtAAAgAEGMzwBqLQAARw1kIABBAUYN+gEgAEEBaiEAIAQgAUEBaiIBRw0ACyACIAU2AgAMogILQYsBIQMgASAERg2hAiACKAIAIgAgBCABa2ohBSABIABrQQJqIQYCQANAIAEtAAAgAEGOzwBqLQAARw1kIABBAkYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAyiAgsgAkEANgIAIAZBAWohAUECDGULQYwBIQMgASAERg2gAiACKAIAIgAgBCABa2ohBSABIABrQQFqIQYCQANAIAEtAAAgAEHwzwBqLQAARw1jIABBAUYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAyhAgsgAkEANgIAIAZBAWohAUEfDGQLQY0BIQMgASAERg2fAiACKAIAIgAgBCABa2ohBSABIABrQQFqIQYCQANAIAEtAAAgAEHyzwBqLQAARw1iIABBAUYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAygAgsgAkEANgIAIAZBAWohAUEJDGMLIAEgBEYEQEGOASEDDJ8CCwJAAkAgAS0AAEHJAGsOBwBiYmJiYgFiCyABQQFqIQFB+AAhAwyGAgsgAUEBaiEBQfkAIQMMhQILQY8BIQMgASAERg2dAiACKAIAIgAgBCABa2ohBSABIABrQQVqIQYCQANAIAEtAAAgAEGRzwBqLQAARw1gIABBBUYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAyeAgsgAkEANgIAIAZBAWohAUEYDGELQZABIQMgASAERg2cAiACKAIAIgAgBCABa2ohBSABIABrQQJqIQYCQANAIAEtAAAgAEGXzwBqLQAARw1fIABBAkYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAydAgsgAkEANgIAIAZBAWohAUEXDGALQZEBIQMgASAERg2bAiACKAIAIgAgBCABa2ohBSABIABrQQZqIQYCQANAIAEtAAAgAEGazwBqLQAARw1eIABBBkYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAycAgsgAkEANgIAIAZBAWohAUEV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JSIARQ0RIAJB5QA2AhwgAiABNgIUIAIgADYCDEEAIQMMtAELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0gIAJB0wA2AhwgAiABNgIUIAIgADYCDEEAIQMMswELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0iIAJB0gA2AhwgAiABNgIUIAIgADYCDEEAIQMMsgELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0OIAJB5QA2AhwgAiABNgIUIAIgADYCDEEAIQMMsQELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0dIAJB0wA2AhwgAiABNgIUIAIgADYCDEEAIQMMsAELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0fIAJB0gA2AhwgAiABNgIUIAIgADYCDEEAIQMMrwELIABBP0cNASABQQFqCyEBQQUhAwyUAQtBACEDIAJBADYCHCACIAE2AhQgAkH9EjYCECACQQc2AgwMrAELIAJBADYCHCACIAE2AhQgAkHcCDYCECACQQc2AgxBACEDDKsBCyACKAIEIQAgAkEANgIEIAIgACABECUiAEUNByACQeUANgIcIAIgATYCFCACIAA2AgxBACEDDKoBCyACKAIEIQAgAkEANgIEIAIgACABECUiAEUNFiACQdMANgIcIAIgATYCFCACIAA2AgxBACEDDKkBCyACKAIEIQAgAkEANgIEIAIgACABECUiAEUNGCACQdIANgIcIAIgATYCFCACIAA2AgxBACEDDKgBCyACQQA2AhwgAiABNgIUIAJBxgo2AhAgAkEHNgIMQQAhAwynAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDQMgAkHlADYCHCACIAE2AhQgAiAANgIMQQAhAwymAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDRIgAkHTADYCHCACIAE2AhQgAiAANgIMQQAhAwylAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDRQgAkHSADYCHCACIAE2AhQgAiAANgIMQQAhAwykAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDQAgAkHlADYCHCACIAE2AhQgAiAANgIMQQAhAwyjAQtB1QAhAwyJAQsgAEEVRwRAIAJBADYCHCACIAE2AhQgAkG5DTYCECACQRo2AgxB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AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIABB5ABrDvQDY2IAAWFhYWFhYQIDBAVhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhBgcICQoLDA0OD2FhYWFhEGFhYWFhYWFhYWFhEWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYRITFBUWFxgZGhthYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2YTc4OTphYWFhYWFhYTthYWE8YWFhYT0+P2FhYWFhYWFhQGFhQWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYUJDREVGR0hJSktMTU5PUFFSU2FhYWFhYWFhVFVWV1hZWlthXF1hYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFeYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhX2BhC0HhJw8LQaQhDwtByywPC0H+MQ8LQcAkDwtBqyQPC0GNKA8LQeImDwtBgDAPC0G5Lw8LQdckDwtB7x8PC0HhHw8LQfofDwtB8iAPC0GoLw8LQa4yDwtBiDAPC0HsJw8LQYIiDwtBjh0PC0HQLg8LQcojDwtBxTIPC0HfHA8LQdIcDwtBxCAPC0HXIA8LQaIfDwtB7S4PC0GrMA8LQdQlDwtBzC4PC0H6Lg8LQfwrDwtB0jAPC0HxHQ8LQbsgDwtB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CABB3AgLii1JbnZhbGlkIGNoYXIgaW4gdXJsIHF1ZXJ5AFNwYW4gY2FsbGJhY2sgZXJyb3IgaW4gb25fYm9keQBDb250ZW50LUxlbmd0aCBvdmVyZmxvdwBDaHVuayBzaXplIG92ZXJmbG93AFJlc3BvbnNlIG92ZXJmbG93AEludmFsaWQgbWV0aG9kIGZvciBIVFRQL3gueCByZXF1ZXN0AEludmFsaWQgbWV0aG9kIGZvciBSVFNQL3gueCByZXF1ZXN0AEV4cGVjdGVkIFNPVVJDRSBtZXRob2QgZm9yIElDRS94LnggcmVxdWVzdABJbnZhbGlkIGNoYXIgaW4gdXJsIGZyYWdtZW50IHN0YXJ0AEV4cGVjdGVkIGRvdABTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX3N0YXR1cwBJbnZhbGlkIHJlc3BvbnNlIHN0YXR1cwBJbnZhbGlkIGNoYXJhY3RlciBpbiBjaHVuayBleHRlbnNpb25zAFVzZXIgY2FsbGJhY2sgZXJyb3IAYG9uX3Jlc2V0YCBjYWxsYmFjayBlcnJvcgBgb25fY2h1bmtfaGVhZGVyYCBjYWxsYmFjayBlcnJvcgBgb25fbWVzc2FnZV9iZWdpbmAgY2FsbGJhY2sgZXJyb3IAYG9uX2NodW5rX2V4dGVuc2lvbl92YWx1ZWAgY2FsbGJhY2sgZXJyb3IAYG9uX3N0YXR1c19jb21wbGV0ZWAgY2FsbGJhY2sgZXJyb3IAYG9uX3ZlcnNpb25fY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl91cmxfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl9jaHVua19jb21wbGV0ZWAgY2FsbGJhY2sgZXJyb3IAYG9uX2hlYWRlcl92YWx1ZV9jb21wbGV0ZWAgY2FsbGJhY2sgZXJyb3IAYG9uX21lc3NhZ2VfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl9tZXRob2RfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl9oZWFkZXJfZmllbGRfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl9jaHVua19leHRlbnNpb25fbmFtZWAgY2FsbGJhY2sgZXJyb3IAVW5leHBlY3RlZCBjaGFyIGluIHVybCBzZXJ2ZXIASW52YWxpZCBoZWFkZXIgdmFsdWUgY2hhcgBJbnZhbGlkIGhlYWRlciBmaWVsZCBjaGFyAFNwYW4gY2FsbGJhY2sgZXJyb3IgaW4gb25fdmVyc2lvbgBJbnZhbGlkIG1pbm9yIHZlcnNpb24ASW52YWxpZCBtYWpvciB2ZXJzaW9uAEV4cGVjdGVkIHNwYWNlIGFmdGVyIHZlcnNpb24ARXhwZWN0ZWQgQ1JMRiBhZnRlciB2ZXJzaW9uAEludmFsaWQgSFRUUCB2ZXJzaW9uAEludmFsaWQgaGVhZGVyIHRva2VuAFNwYW4gY2FsbGJhY2sgZXJyb3IgaW4gb25fdXJsAEludmFsaWQgY2hhcmFjdGVycyBpbiB1cmwAVW5leHBlY3RlZCBzdGFydCBjaGFyIGluIHVybABEb3VibGUgQCBpbiB1cmwARW1wdHkgQ29udGVudC1MZW5ndGgASW52YWxpZCBjaGFyYWN0ZXIgaW4gQ29udGVudC1MZW5ndGgARHVwbGljYXRlIENvbnRlbnQtTGVuZ3RoAEludmFsaWQgY2hhciBpbiB1cmwgcGF0aABDb250ZW50LUxlbmd0aCBjYW4ndCBiZSBwcmVzZW50IHdpdGggVHJhbnNmZXItRW5jb2RpbmcASW52YWxpZCBjaGFyYWN0ZXIgaW4gY2h1bmsgc2l6ZQBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX2hlYWRlcl92YWx1ZQBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX2NodW5rX2V4dGVuc2lvbl92YWx1ZQBJbnZhbGlkIGNoYXJhY3RlciBpbiBjaHVuayBleHRlbnNpb25zIHZhbHVlAE1pc3NpbmcgZXhwZWN0ZWQgTEYgYWZ0ZXIgaGVhZGVyIHZhbHVlAEludmFsaWQgYFRyYW5zZmVyLUVuY29kaW5nYCBoZWFkZXIgdmFsdWUASW52YWxpZCBjaGFyYWN0ZXIgaW4gY2h1bmsgZXh0ZW5zaW9ucyBxdW90ZSB2YWx1ZQBJbnZhbGlkIGNoYXJhY3RlciBpbiBjaHVuayBleHRlbnNpb25zIHF1b3RlZCB2YWx1ZQBQYXVzZWQgYnkgb25faGVhZGVyc19jb21wbGV0ZQBJbnZhbGlkIEVPRiBzdGF0ZQBvbl9yZXNldCBwYXVzZQBvbl9jaHVua19oZWFkZXIgcGF1c2UAb25fbWVzc2FnZV9iZWdpbiBwYXVzZQBvbl9jaHVua19leHRlbnNpb25fdmFsdWUgcGF1c2UAb25fc3RhdHVzX2NvbXBsZXRlIHBhdXNlAG9uX3ZlcnNpb25fY29tcGxldGUgcGF1c2UAb25fdXJsX2NvbXBsZXRlIHBhdXNlAG9uX2NodW5rX2NvbXBsZXRlIHBhdXNlAG9uX2hlYWRlcl92YWx1ZV9jb21wbGV0ZSBwYXVzZQBvbl9tZXNzYWdlX2NvbXBsZXRlIHBhdXNlAG9uX21ldGhvZF9jb21wbGV0ZSBwYXVzZQBvbl9oZWFkZXJfZmllbGRfY29tcGxldGUgcGF1c2UAb25fY2h1bmtfZXh0ZW5zaW9uX25hbWUgcGF1c2UAVW5leHBlY3RlZCBzcGFjZSBhZnRlciBzdGFydCBsaW5lAFNwYW4gY2FsbGJhY2sgZXJyb3IgaW4gb25fY2h1bmtfZXh0ZW5zaW9uX25hbWUASW52YWxpZCBjaGFyYWN0ZXIgaW4gY2h1bmsgZXh0ZW5zaW9ucyBuYW1lAFBhdXNlIG9uIENPTk5FQ1QvVXBncmFkZQBQYXVzZSBvbiBQUkkvVXBncmFkZQBFeHBlY3RlZCBIVFRQLzIgQ29ubmVjdGlvbiBQcmVmYWNlAFNwYW4gY2FsbGJhY2sgZXJyb3IgaW4gb25fbWV0aG9kAEV4cGVjdGVkIHNwYWNlIGFmdGVyIG1ldGhvZABTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX2hlYWRlcl9maWVsZABQYXVzZWQASW52YWxpZCB3b3JkIGVuY291bnRlcmVkAEludmFsaWQgbWV0aG9kIGVuY291bnRlcmVkAFVuZXhwZWN0ZWQgY2hhciBpbiB1cmwgc2NoZW1hAFJlcXVlc3QgaGFzIGludmFsaWQgYFRyYW5zZmVyLUVuY29kaW5nYABTV0lUQ0hfUFJPWFkAVVNFX1BST1hZAE1LQUNUSVZJVFkAVU5QUk9DRVNTQUJMRV9FTlRJVFkAQ09QWQBNT1ZFRF9QRVJNQU5FTlRMWQBUT09fRUFSTFkATk9USUZZAEZBSUxFRF9ERVBFTkRFTkNZAEJBRF9HQVRFV0FZAFBMQVkAUFVUAENIRUNLT1VUAEdBVEVXQVlfVElNRU9VVABSRVFVRVNUX1RJTUVPVVQATkVUV09SS19DT05ORUNUX1RJTUVPVVQAQ09OTkVDVElPTl9USU1FT1VUAExPR0lOX1RJTUVPVVQATkVUV09SS19SRUFEX1RJTUVPVVQAUE9TVABNSVNESVJFQ1RFRF9SRVFVRVNUAENMSUVOVF9DTE9TRURfUkVRVUVTVABDTElFTlRfQ0xPU0VEX0xPQURfQkFMQU5DRURfUkVRVUVTVABCQURfUkVRVUVTVABIVFRQX1JFUVVFU1RfU0VOVF9UT19IVFRQU19QT1JUAFJFUE9SVABJTV9BX1RFQVBPVABSRVNFVF9DT05URU5UAE5PX0NPTlRFTlQAUEFSVElBTF9DT05URU5UAEhQRV9JTlZBTElEX0NPTlNUQU5UAEhQRV9DQl9SRVNFVABHRVQASFBFX1NUUklDVABDT05GTElDVABURU1QT1JBUllfUkVESVJFQ1QAUEVSTUFORU5UX1JFRElSRUNUAENPTk5FQ1QATVVMVElfU1RBVFVTAEhQRV9JTlZBTElEX1NUQVRVUwBUT09fTUFOWV9SRVFVRVNUUwBFQVJMWV9ISU5UUwBVTkFWQUlMQUJMRV9GT1JfTEVHQUxfUkVBU09OUwBPUFRJT05TAFNXSVRDSElOR19QUk9UT0NPTFMAVkFSSUFOVF9BTFNPX05FR09USUFURVMATVVMVElQTEVfQ0hPSUNFUwBJTlRFUk5BTF9TRVJWRVJfRVJST1IAV0VCX1NFUlZFUl9VTktOT1dOX0VSUk9SAFJBSUxHVU5fRVJST1IASURFTlRJVFlfUFJPVklERVJfQVVUSEVOVElDQVRJT05fRVJST1IAU1NMX0NFUlRJRklDQVRFX0VSUk9SAElOVkFMSURfWF9GT1JXQVJERURfRk9SAFNFVF9QQVJBTUVURVIAR0VUX1BBUkFNRVRFUgBIUEVfVVNFUgBTRUVfT1RIRVIASFBFX0NCX0NIVU5LX0hFQURFUgBNS0NBTEVOREFSAFNFVFVQAFdFQl9TRVJWRVJfSVNfRE9XTgBURUFSRE9XTgBIUEVfQ0xPU0VEX0NPTk5FQ1RJT04ASEVVUklTVElDX0VYUElSQVRJT04ARElTQ09OTkVDVEVEX09QRVJBVElPTgBOT05fQVVUSE9SSVRBVElWRV9JTkZPUk1BVElPTgBIUEVfSU5WQUxJRF9WRVJTSU9OAEhQRV9DQl9NRVNTQUdFX0JFR0lOAFNJVEVfSVNfRlJPWkVOAEhQRV9JTlZBTElEX0hFQURFUl9UT0tFTgBJTlZBTElEX1RPS0VOAEZPUkJJRERFTgBFTkhBTkNFX1lPVVJfQ0FMTQBIUEVfSU5WQUxJRF9VUkwAQkxPQ0tFRF9CWV9QQVJFTlRBTF9DT05UUk9MAE1LQ09MAEFDTABIUEVfSU5URVJOQUwAUkVRVUVTVF9IRUFERVJfRklFTERTX1RPT19MQVJHRV9VTk9GRklDSUFMAEhQRV9PSwBVTkxJTksAVU5MT0NLAFBSSQBSRVRSWV9XSVRIAEhQRV9JTlZBTElEX0NPTlRFTlRfTEVOR1RIAEhQRV9VTkVYUEVDVEVEX0NPTlRFTlRfTEVOR1RIAEZMVVNIAFBST1BQQVRDSABNLVNFQVJDSABVUklfVE9PX0xPTkcAUFJPQ0VTU0lORwBNSVNDRUxMQU5FT1VTX1BFUlNJU1RFTlRfV0FSTklORwBNSVNDRUxMQU5FT1VTX1dBUk5JTkcASFBFX0lOVkFMSURfVFJBTlNGRVJfRU5DT0RJTkcARXhwZWN0ZWQgQ1JMRgBIUEVfSU5WQUxJRF9DSFVOS19TSVpFAE1PVkUAQ09OVElOVUUASFBFX0NCX1NUQVRVU19DT01QTEVURQBIUEVfQ0JfSEVBREVSU19DT01QTEVURQBIUEVfQ0JfVkVSU0lPTl9DT01QTEVURQBIUEVfQ0JfVVJMX0NPTVBMRVRFAEhQRV9DQl9DSFVOS19DT01QTEVURQBIUEVfQ0JfSEVBREVSX1ZBTFVFX0NPTVBMRVRFAEhQRV9DQl9DSFVOS19FWFRFTlNJT05fVkFMVUVfQ09NUExFVEUASFBFX0NCX0NIVU5LX0VYVEVOU0lPTl9OQU1FX0NPTVBMRVRFAEhQRV9DQl9NRVNTQUdFX0NPTVBMRVRFAEhQRV9DQl9NRVRIT0RfQ09NUExFVEUASFBFX0NCX0hFQURFUl9GSUVMRF9DT01QTEVURQBERUxFVEUASFBFX0lOVkFMSURfRU9GX1NUQVRFAElOVkFMSURfU1NMX0NFUlRJRklDQVRFAFBBVVNFAE5PX1JFU1BPTlNFAFVOU1VQUE9SVEVEX01FRElBX1RZUEUAR09ORQBOT1RfQUNDRVBUQUJMRQBTRVJWSUNFX1VOQVZBSUxBQkxFAFJBTkdFX05PVF9TQVRJU0ZJQUJMRQBPUklHSU5fSVNfVU5SRUFDSEFCTEUAUkVTUE9OU0VfSVNfU1RBTEUAUFVSR0UATUVSR0UAUkVRVUVTVF9IRUFERVJfRklFTERTX1RPT19MQVJHRQBSRVFVRVNUX0hFQURFUl9UT09fTEFSR0UAUEFZTE9BRF9UT09fTEFSR0UASU5TVUZGSUNJRU5UX1NUT1JBR0UASFBFX1BBVVNFRF9VUEdSQURFAEhQRV9QQVVTRURfSDJfVVBHUkFERQBTT1VSQ0UAQU5OT1VOQ0UAVFJBQ0UASFBFX1VORVhQRUNURURfU1BBQ0UAREVTQ1JJQkUAVU5TVUJTQ1JJQkUAUkVDT1JEAEhQRV9JTlZBTElEX01FVEhPRABOT1RfRk9VTkQAUFJPUEZJTkQAVU5CSU5EAFJFQklORABVTkFVVEhPUklaRUQATUVUSE9EX05PVF9BTExPV0VEAEhUVFBfVkVSU0lPTl9OT1RfU1VQUE9SVEVEAEFMUkVBRFlfUkVQT1JURUQAQUNDRVBURUQATk9UX0lNUExFTUVOVEVEAExPT1BfREVURUNURUQASFBFX0NSX0VYUEVDVEVEAEhQRV9MRl9FWFBFQ1RFRABDUkVBVEVEAElNX1VTRUQASFBFX1BBVVNFRABUSU1FT1VUX09DQ1VSRUQAUEFZTUVOVF9SRVFVSVJFRABQUkVDT05ESVRJT05fUkVRVUlSRUQAUFJPWFlfQVVUSEVOVElDQVRJT05fUkVRVUlSRUQATkVUV09SS19BVVRIRU5USUNBVElPTl9SRVFVSVJFRABMRU5HVEhfUkVRVUlSRUQAU1NMX0NFUlRJRklDQVRFX1JFUVVJUkVEAFVQR1JBREVfUkVRVUlSRUQAUEFHRV9FWFBJUkVEAFBSRUNPTkRJVElPTl9GQUlMRUQARVhQRUNUQVRJT05fRkFJTEVEAFJFVkFMSURBVElPTl9GQUlMRUQAU1NMX0hBTkRTSEFLRV9GQUlMRUQATE9DS0VEAFRSQU5TRk9STUFUSU9OX0FQUExJRUQATk9UX01PRElGSUVEAE5PVF9FWFRFTkRFRABCQU5EV0lEVEhfTElNSVRfRVhDRUVERUQAU0lURV9JU19PVkVSTE9BREVEAEhFQUQARXhwZWN0ZWQgSFRUUC8AAF4TAAAmEwAAMBAAAPAXAACdEwAAFRIAADkXAADwEgAAChAAAHUSAACtEgAAghMAAE8UAAB/EAAAoBUAACMUAACJEgAAixQAAE0VAADUEQAAzxQAABAYAADJFgAA3BYAAMERAADgFwAAuxQAAHQUAAB8FQAA5RQAAAgXAAAfEAAAZRUAAKMUAAAoFQAAAhUAAJkVAAAsEAAAixkAAE8PAADUDgAAahAAAM4QAAACFwAAiQ4AAG4TAAAcEwAAZhQAAFYXAADBEwAAzRMAAGwTAABoFwAAZhcAAF8XAAAiEwAAzg8AAGkOAADYDgAAYxYAAMsTAACqDgAAKBcAACYXAADFEwAAXRYAAOgRAABnEwAAZRMAAPIWAABzEwAAHRcAAPkWAADzEQAAzw4AAM4VAAAMEgAAsxEAAKURAABhEAAAMhcAALsTAEH5NQsBAQBBkDYL4AEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBB/TcLAQEAQZE4C14CAwICAgICAAACAgACAgACAgICAgICAgICAAQAAAAAAAICAgICAgICAgICAgICAgICAgICAgICAgICAAAAAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAgACAEH9OQsBAQBBkToLXgIAAgICAgIAAAICAAICAAICAgICAgICAgIAAwAEAAAAAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgACAAIAQfA7Cw1sb3NlZWVwLWFsaXZlAEGJPAsBAQBBoDwL4AEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBBiT4LAQEAQaA+C+cBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQFjaHVua2VkAEGwwAALXwEBAAEBAQEBAAABAQABAQABAQEBAQEBAQEBAAAAAAAAAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAAAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQABAEGQwgALIWVjdGlvbmVudC1sZW5ndGhvbnJveHktY29ubmVjdGlvbgBBwMIACy1yYW5zZmVyLWVuY29kaW5ncGdyYWRlDQoNCg0KU00NCg0KVFRQL0NFL1RTUC8AQfnCAAsFAQIAAQMAQZDDAAvgAQQBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAEH5xAALBQECAAEDAEGQxQAL4AEEAQEFAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBB+cYACwQBAAABAEGRxwAL3wEBAQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAEH6yAALBAEAAAIAQZDJAAtfAwQAAAQEBAQEBAQEBAQEBQQEBAQEBAQEBAQEBAAEAAYHBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQABAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAAAAQAQfrKAAsEAQAAAQBBkMsACwEBAEGqywALQQIAAAAAAAADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAEH6zAALBAEAAAEAQZDNAAsBAQBBms0ACwYCAAAAAAIAQbHNAAs6AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMAAAAAAAADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwBB8M4AC5YBTk9VTkNFRUNLT1VUTkVDVEVURUNSSUJFTFVTSEVURUFEU0VBUkNIUkdFQ1RJVklUWUxFTkRBUlZFT1RJRllQVElPTlNDSFNFQVlTVEFUQ0hHRU9SRElSRUNUT1JUUkNIUEFSQU1FVEVSVVJDRUJTQ1JJQkVBUkRPV05BQ0VJTkROS0NLVUJTQ1JJQkVIVFRQL0FEVFAv", "base64");
  }
});

// node_modules/undici/lib/llhttp/llhttp_simd-wasm.js
var require_llhttp_simd_wasm = __commonJS({
  "node_modules/undici/lib/llhttp/llhttp_simd-wasm.js"(exports, module) {
    "use strict";
    var { Buffer: Buffer2 } = __require("node:buffer");
    module.exports = Buffer2.from("AGFzbQEAAAABJwdgAX8Bf2ADf39/AX9gAX8AYAJ/fwBgBH9/f38Bf2AAAGADf39/AALLAQgDZW52GHdhc21fb25faGVhZGVyc19jb21wbGV0ZQAEA2VudhV3YXNtX29uX21lc3NhZ2VfYmVnaW4AAANlbnYLd2FzbV9vbl91cmwAAQNlbnYOd2FzbV9vbl9zdGF0dXMAAQNlbnYUd2FzbV9vbl9oZWFkZXJfZmllbGQAAQNlbnYUd2FzbV9vbl9oZWFkZXJfdmFsdWUAAQNlbnYMd2FzbV9vbl9ib2R5AAEDZW52GHdhc21fb25fbWVzc2FnZV9jb21wbGV0ZQAAAy0sBQYAAAIAAAAAAAACAQIAAgICAAADAAAAAAMDAwMBAQEBAQEBAQEAAAIAAAAEBQFwARISBQMBAAIGCAF/AUGA1AQLB9EFIgZtZW1vcnkCAAtfaW5pdGlhbGl6ZQAIGV9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGUBAAtsbGh0dHBfaW5pdAAJGGxsaHR0cF9zaG91bGRfa2VlcF9hbGl2ZQAvDGxsaHR0cF9hbGxvYwALBm1hbGxvYwAxC2xsaHR0cF9mcmVlAAwEZnJlZQAMD2xsaHR0cF9nZXRfdHlwZQANFWxsaHR0cF9nZXRfaHR0cF9tYWpvcgAOFWxsaHR0cF9nZXRfaHR0cF9taW5vcgAPEWxsaHR0cF9nZXRfbWV0aG9kABAWbGxodHRwX2dldF9zdGF0dXNfY29kZQAREmxsaHR0cF9nZXRfdXBncmFkZQASDGxsaHR0cF9yZXNldAATDmxsaHR0cF9leGVjdXRlABQUbGxodHRwX3NldHRpbmdzX2luaXQAFQ1sbGh0dHBfZmluaXNoABYMbGxodHRwX3BhdXNlABcNbGxodHRwX3Jlc3VtZQAYG2xsaHR0cF9yZXN1bWVfYWZ0ZXJfdXBncmFkZQAZEGxsaHR0cF9nZXRfZXJybm8AGhdsbGh0dHBfZ2V0X2Vycm9yX3JlYXNvbgAbF2xsaHR0cF9zZXRfZXJyb3JfcmVhc29uABwUbGxodHRwX2dldF9lcnJvcl9wb3MAHRFsbGh0dHBfZXJybm9fbmFtZQAeEmxsaHR0cF9tZXRob2RfbmFtZQAfEmxsaHR0cF9zdGF0dXNfbmFtZQAgGmxsaHR0cF9zZXRfbGVu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PgtBhwEMPQtBiAEMPAtBiQEMOwtBigEMOgtBiwEMOQtBjAEMOAtBjQEMNwtBjgEMNgtBjwEMNQtBkAEMNAtBkQEMMwtBkgEMMgtBkwEMMQtBlAEMMAtBlQEMLwtBlgEMLgtBlwEMLQtBmAEMLAtBmQEMKwtBmgEMKgtBmwEMKQtBnAEMKAtBnQEMJwtBngEMJgtBnwEMJQtBoAEMJAtBoQEMIwtBogEMIgtBowEMIQtBpAEMIAtBpQEMHwtBpgEMHgtBpwEMHQtBqAEMHAtBqQEMGwtBqgEMGgtBqwEMGQtBrAEMGAtBrQEMFwtBrgEMFgtBAQwVC0GvAQwUC0GwAQwTC0GxAQwSC0GzAQwRC0GyAQwQC0G0AQwPC0G1AQwOC0G2AQwNC0G3AQwMC0G4AQwLC0G5AQwKC0G6AQwJC0G7AQwIC0HGAQwHC0G8AQwGC0G9AQwFC0G+AQwEC0G/AQwDC0HAAQwCC0HCAQwBC0HBAQshAwNAAkACQAJAAkACQAJAAkACQAJAIAICfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAgJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACfwJAAkACfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAC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iQEhAwykAgtBASABLQAAQd8ARw1nGiABQQFqIQEMXgtBigEhAyABIARGDaICIAIoAgAiACAEIAFraiEFIAEgAGtBAWohBgNAIAEtAAAgAEGMzwBqLQAARw1kIABBAUYN+gEgAEEBaiEAIAQgAUEBaiIBRw0ACyACIAU2AgAMogILQYsBIQMgASAERg2hAiACKAIAIgAgBCABa2ohBSABIABrQQJqIQYCQANAIAEtAAAgAEGOzwBqLQAARw1kIABBAkYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAyiAgsgAkEANgIAIAZBAWohAUECDGULQYwBIQMgASAERg2gAiACKAIAIgAgBCABa2ohBSABIABrQQFqIQYCQANAIAEtAAAgAEHwzwBqLQAARw1jIABBAUYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAyhAgsgAkEANgIAIAZBAWohAUEfDGQLQY0BIQMgASAERg2fAiACKAIAIgAgBCABa2ohBSABIABrQQFqIQYCQANAIAEtAAAgAEHyzwBqLQAARw1iIABBAUYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAygAgsgAkEANgIAIAZBAWohAUEJDGMLIAEgBEYEQEGOASEDDJ8CCwJAAkAgAS0AAEHJAGsOBwBiYmJiYgFiCyABQQFqIQFB+AAhAwyGAgsgAUEBaiEBQfkAIQMMhQILQY8BIQMgASAERg2dAiACKAIAIgAgBCABa2ohBSABIABrQQVqIQYCQANAIAEtAAAgAEGRzwBqLQAARw1gIABBBUYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAyeAgsgAkEANgIAIAZBAWohAUEYDGELQZABIQMgASAERg2cAiACKAIAIgAgBCABa2ohBSABIABrQQJqIQYCQANAIAEtAAAgAEGXzwBqLQAARw1fIABBAkYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAydAgsgAkEANgIAIAZBAWohAUEXDGALQZEBIQMgASAERg2bAiACKAIAIgAgBCABa2ohBSABIABrQQZqIQYCQANAIAEtAAAgAEGazwBqLQAARw1eIABBBkYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAycAgsgAkEANgIAIAZBAWohAUEV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JSIARQ0RIAJB5QA2AhwgAiABNgIUIAIgADYCDEEAIQMMtAELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0gIAJB0wA2AhwgAiABNgIUIAIgADYCDEEAIQMMswELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0iIAJB0gA2AhwgAiABNgIUIAIgADYCDEEAIQMMsgELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0OIAJB5QA2AhwgAiABNgIUIAIgADYCDEEAIQMMsQELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0dIAJB0wA2AhwgAiABNgIUIAIgADYCDEEAIQMMsAELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0fIAJB0gA2AhwgAiABNgIUIAIgADYCDEEAIQMMrwELIABBP0cNASABQQFqCyEBQQUhAwyUAQtBACEDIAJBADYCHCACIAE2AhQgAkH9EjYCECACQQc2AgwMrAELIAJBADYCHCACIAE2AhQgAkHcCDYCECACQQc2AgxBACEDDKsBCyACKAIEIQAgAkEANgIEIAIgACABECUiAEUNByACQeUANgIcIAIgATYCFCACIAA2AgxBACEDDKoBCyACKAIEIQAgAkEANgIEIAIgACABECUiAEUNFiACQdMANgIcIAIgATYCFCACIAA2AgxBACEDDKkBCyACKAIEIQAgAkEANgIEIAIgACABECUiAEUNGCACQdIANgIcIAIgATYCFCACIAA2AgxBACEDDKgBCyACQQA2AhwgAiABNgIUIAJBxgo2AhAgAkEHNgIMQQAhAwynAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDQMgAkHlADYCHCACIAE2AhQgAiAANgIMQQAhAwymAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDRIgAkHTADYCHCACIAE2AhQgAiAANgIMQQAhAwylAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDRQgAkHSADYCHCACIAE2AhQgAiAANgIMQQAhAwykAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDQAgAkHlADYCHCACIAE2AhQgAiAANgIMQQAhAwyjAQtB1QAhAwyJAQsgAEEVRwRAIAJBADYCHCACIAE2AhQgAkG5DTYCECACQRo2AgxB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AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIABB5ABrDvQDY2IAAWFhYWFhYQIDBAVhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhBgcICQoLDA0OD2FhYWFhEGFhYWFhYWFhYWFhEWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYRITFBUWFxgZGhthYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2YTc4OTphYWFhYWFhYTthYWE8YWFhYT0+P2FhYWFhYWFhQGFhQWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYUJDREVGR0hJSktMTU5PUFFSU2FhYWFhYWFhVFVWV1hZWlthXF1hYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFeYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhX2BhC0HhJw8LQaQhDwtByywPC0H+MQ8LQcAkDwtBqyQPC0GNKA8LQeImDwtBgDAPC0G5Lw8LQdckDwtB7x8PC0HhHw8LQfofDwtB8iAPC0GoLw8LQa4yDwtBiDAPC0HsJw8LQYIiDwtBjh0PC0HQLg8LQcojDwtBxTIPC0HfHA8LQdIcDwtBxCAPC0HXIA8LQaIfDwtB7S4PC0GrMA8LQdQlDwtBzC4PC0H6Lg8LQfwrDwtB0jAPC0HxHQ8LQbsgDwtB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AAADAEGUCAsFBAAAAAUAQaQICwkGAAAABwAAAAgAQdwIC4otSW52YWxpZCBjaGFyIGluIHVybCBxdWVyeQBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX2JvZHkAQ29udGVudC1MZW5ndGggb3ZlcmZsb3cAQ2h1bmsgc2l6ZSBvdmVyZmxvdwBSZXNwb25zZSBvdmVyZmxvdwBJbnZhbGlkIG1ldGhvZCBmb3IgSFRUUC94LnggcmVxdWVzdABJbnZhbGlkIG1ldGhvZCBmb3IgUlRTUC94LnggcmVxdWVzdABFeHBlY3RlZCBTT1VSQ0UgbWV0aG9kIGZvciBJQ0UveC54IHJlcXVlc3QASW52YWxpZCBjaGFyIGluIHVybCBmcmFnbWVudCBzdGFydABFeHBlY3RlZCBkb3QAU3BhbiBjYWxsYmFjayBlcnJvciBpbiBvbl9zdGF0dXMASW52YWxpZCByZXNwb25zZSBzdGF0dXMASW52YWxpZCBjaGFyYWN0ZXIgaW4gY2h1bmsgZXh0ZW5zaW9ucwBVc2VyIGNhbGxiYWNrIGVycm9yAGBvbl9yZXNldGAgY2FsbGJhY2sgZXJyb3IAYG9uX2NodW5rX2hlYWRlcmAgY2FsbGJhY2sgZXJyb3IAYG9uX21lc3NhZ2VfYmVnaW5gIGNhbGxiYWNrIGVycm9yAGBvbl9jaHVua19leHRlbnNpb25fdmFsdWVgIGNhbGxiYWNrIGVycm9yAGBvbl9zdGF0dXNfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl92ZXJzaW9uX2NvbXBsZXRlYCBjYWxsYmFjayBlcnJvcgBgb25fdXJsX2NvbXBsZXRlYCBjYWxsYmFjayBlcnJvcgBgb25fY2h1bmtfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl9oZWFkZXJfdmFsdWVfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl9tZXNzYWdlX2NvbXBsZXRlYCBjYWxsYmFjayBlcnJvcgBgb25fbWV0aG9kX2NvbXBsZXRlYCBjYWxsYmFjayBlcnJvcgBgb25faGVhZGVyX2ZpZWxkX2NvbXBsZXRlYCBjYWxsYmFjayBlcnJvcgBgb25fY2h1bmtfZXh0ZW5zaW9uX25hbWVgIGNhbGxiYWNrIGVycm9yAFVuZXhwZWN0ZWQgY2hhciBpbiB1cmwgc2VydmVyAEludmFsaWQgaGVhZGVyIHZhbHVlIGNoYXIASW52YWxpZCBoZWFkZXIgZmllbGQgY2hhcgBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX3ZlcnNpb24ASW52YWxpZCBtaW5vciB2ZXJzaW9uAEludmFsaWQgbWFqb3IgdmVyc2lvbgBFeHBlY3RlZCBzcGFjZSBhZnRlciB2ZXJzaW9uAEV4cGVjdGVkIENSTEYgYWZ0ZXIgdmVyc2lvbgBJbnZhbGlkIEhUVFAgdmVyc2lvbgBJbnZhbGlkIGhlYWRlciB0b2tlbgBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX3VybABJbnZhbGlkIGNoYXJhY3RlcnMgaW4gdXJsAFVuZXhwZWN0ZWQgc3RhcnQgY2hhciBpbiB1cmwARG91YmxlIEAgaW4gdXJsAEVtcHR5IENvbnRlbnQtTGVuZ3RoAEludmFsaWQgY2hhcmFjdGVyIGluIENvbnRlbnQtTGVuZ3RoAER1cGxpY2F0ZSBDb250ZW50LUxlbmd0aABJbnZhbGlkIGNoYXIgaW4gdXJsIHBhdGgAQ29udGVudC1MZW5ndGggY2FuJ3QgYmUgcHJlc2VudCB3aXRoIFRyYW5zZmVyLUVuY29kaW5nAEludmFsaWQgY2hhcmFjdGVyIGluIGNodW5rIHNpemUAU3BhbiBjYWxsYmFjayBlcnJvciBpbiBvbl9oZWFkZXJfdmFsdWUAU3BhbiBjYWxsYmFjayBlcnJvciBpbiBvbl9jaHVua19leHRlbnNpb25fdmFsdWUASW52YWxpZCBjaGFyYWN0ZXIgaW4gY2h1bmsgZXh0ZW5zaW9ucyB2YWx1ZQBNaXNzaW5nIGV4cGVjdGVkIExGIGFmdGVyIGhlYWRlciB2YWx1ZQBJbnZhbGlkIGBUcmFuc2Zlci1FbmNvZGluZ2AgaGVhZGVyIHZhbHVlAEludmFsaWQgY2hhcmFjdGVyIGluIGNodW5rIGV4dGVuc2lvbnMgcXVvdGUgdmFsdWUASW52YWxpZCBjaGFyYWN0ZXIgaW4gY2h1bmsgZXh0ZW5zaW9ucyBxdW90ZWQgdmFsdWUAUGF1c2VkIGJ5IG9uX2hlYWRlcnNfY29tcGxldGUASW52YWxpZCBFT0Ygc3RhdGUAb25fcmVzZXQgcGF1c2UAb25fY2h1bmtfaGVhZGVyIHBhdXNlAG9uX21lc3NhZ2VfYmVnaW4gcGF1c2UAb25fY2h1bmtfZXh0ZW5zaW9uX3ZhbHVlIHBhdXNlAG9uX3N0YXR1c19jb21wbGV0ZSBwYXVzZQBvbl92ZXJzaW9uX2NvbXBsZXRlIHBhdXNlAG9uX3VybF9jb21wbGV0ZSBwYXVzZQBvbl9jaHVua19jb21wbGV0ZSBwYXVzZQBvbl9oZWFkZXJfdmFsdWVfY29tcGxldGUgcGF1c2UAb25fbWVzc2FnZV9jb21wbGV0ZSBwYXVzZQBvbl9tZXRob2RfY29tcGxldGUgcGF1c2UAb25faGVhZGVyX2ZpZWxkX2NvbXBsZXRlIHBhdXNlAG9uX2NodW5rX2V4dGVuc2lvbl9uYW1lIHBhdXNlAFVuZXhwZWN0ZWQgc3BhY2UgYWZ0ZXIgc3RhcnQgbGluZQBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX2NodW5rX2V4dGVuc2lvbl9uYW1lAEludmFsaWQgY2hhcmFjdGVyIGluIGNodW5rIGV4dGVuc2lvbnMgbmFtZQBQYXVzZSBvbiBDT05ORUNUL1VwZ3JhZGUAUGF1c2Ugb24gUFJJL1VwZ3JhZGUARXhwZWN0ZWQgSFRUUC8yIENvbm5lY3Rpb24gUHJlZmFjZQBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX21ldGhvZABFeHBlY3RlZCBzcGFjZSBhZnRlciBtZXRob2QAU3BhbiBjYWxsYmFjayBlcnJvciBpbiBvbl9oZWFkZXJfZmllbGQAUGF1c2VkAEludmFsaWQgd29yZCBlbmNvdW50ZXJlZABJbnZhbGlkIG1ldGhvZCBlbmNvdW50ZXJlZABVbmV4cGVjdGVkIGNoYXIgaW4gdXJsIHNjaGVtYQBSZXF1ZXN0IGhhcyBpbnZhbGlkIGBUcmFuc2Zlci1FbmNvZGluZ2AAU1dJVENIX1BST1hZAFVTRV9QUk9YWQBNS0FDVElWSVRZAFVOUFJPQ0VTU0FCTEVfRU5USVRZAENPUFkATU9WRURfUEVSTUFORU5UTFkAVE9PX0VBUkxZAE5PVElGWQBGQUlMRURfREVQRU5ERU5DWQBCQURfR0FURVdBWQBQTEFZAFBVVABDSEVDS09VVABHQVRFV0FZX1RJTUVPVVQAUkVRVUVTVF9USU1FT1VUAE5FVFdPUktfQ09OTkVDVF9USU1FT1VUAENPTk5FQ1RJT05fVElNRU9VVABMT0dJTl9USU1FT1VUAE5FVFdPUktfUkVBRF9USU1FT1VUAFBPU1QATUlTRElSRUNURURfUkVRVUVTVABDTElFTlRfQ0xPU0VEX1JFUVVFU1QAQ0xJRU5UX0NMT1NFRF9MT0FEX0JBTEFOQ0VEX1JFUVVFU1QAQkFEX1JFUVVFU1QASFRUUF9SRVFVRVNUX1NFTlRfVE9fSFRUUFNfUE9SVABSRVBPUlQASU1fQV9URUFQT1QAUkVTRVRfQ09OVEVOVABOT19DT05URU5UAFBBUlRJQUxfQ09OVEVOVABIUEVfSU5WQUxJRF9DT05TVEFOVABIUEVfQ0JfUkVTRVQAR0VUAEhQRV9TVFJJQ1QAQ09ORkxJQ1QAVEVNUE9SQVJZX1JFRElSRUNUAFBFUk1BTkVOVF9SRURJUkVDVABDT05ORUNUAE1VTFRJX1NUQVRVUwBIUEVfSU5WQUxJRF9TVEFUVVMAVE9PX01BTllfUkVRVUVTVFMARUFSTFlfSElOVFMAVU5BVkFJTEFCTEVfRk9SX0xFR0FMX1JFQVNPTlMAT1BUSU9OUwBTV0lUQ0hJTkdfUFJPVE9DT0xTAFZBUklBTlRfQUxTT19ORUdPVElBVEVTAE1VTFRJUExFX0NIT0lDRVMASU5URVJOQUxfU0VSVkVSX0VSUk9SAFdFQl9TRVJWRVJfVU5LTk9XTl9FUlJPUgBSQUlMR1VOX0VSUk9SAElERU5USVRZX1BST1ZJREVSX0FVVEhFTlRJQ0FUSU9OX0VSUk9SAFNTTF9DRVJUSUZJQ0FURV9FUlJPUgBJTlZBTElEX1hfRk9SV0FSREVEX0ZPUgBTRVRfUEFSQU1FVEVSAEdFVF9QQVJBTUVURVIASFBFX1VTRVIAU0VFX09USEVSAEhQRV9DQl9DSFVOS19IRUFERVIATUtDQUxFTkRBUgBTRVRVUABXRUJfU0VSVkVSX0lTX0RPV04AVEVBUkRPV04ASFBFX0NMT1NFRF9DT05ORUNUSU9OAEhFVVJJU1RJQ19FWFBJUkFUSU9OAERJU0NPTk5FQ1RFRF9PUEVSQVRJT04ATk9OX0FVVEhPUklUQVRJVkVfSU5GT1JNQVRJT04ASFBFX0lOVkFMSURfVkVSU0lPTgBIUEVfQ0JfTUVTU0FHRV9CRUdJTgBTSVRFX0lTX0ZST1pFTgBIUEVfSU5WQUxJRF9IRUFERVJfVE9LRU4ASU5WQUxJRF9UT0tFTgBGT1JCSURERU4ARU5IQU5DRV9ZT1VSX0NBTE0ASFBFX0lOVkFMSURfVVJMAEJMT0NLRURfQllfUEFSRU5UQUxfQ09OVFJPTABNS0NPTABBQ0wASFBFX0lOVEVSTkFMAFJFUVVFU1RfSEVBREVSX0ZJRUxEU19UT09fTEFSR0VfVU5PRkZJQ0lBTABIUEVfT0sAVU5MSU5LAFVOTE9DSwBQUkkAUkVUUllfV0lUSABIUEVfSU5WQUxJRF9DT05URU5UX0xFTkdUSABIUEVfVU5FWFBFQ1RFRF9DT05URU5UX0xFTkdUSABGTFVTSABQUk9QUEFUQ0gATS1TRUFSQ0gAVVJJX1RPT19MT05HAFBST0NFU1NJTkcATUlTQ0VMTEFORU9VU19QRVJTSVNURU5UX1dBUk5JTkcATUlTQ0VMTEFORU9VU19XQVJOSU5HAEhQRV9JTlZBTElEX1RSQU5TRkVSX0VOQ09ESU5HAEV4cGVjdGVkIENSTEYASFBFX0lOVkFMSURfQ0hVTktfU0laRQBNT1ZFAENPTlRJTlVFAEhQRV9DQl9TVEFUVVNfQ09NUExFVEUASFBFX0NCX0hFQURFUlNfQ09NUExFVEUASFBFX0NCX1ZFUlNJT05fQ09NUExFVEUASFBFX0NCX1VSTF9DT01QTEVURQBIUEVfQ0JfQ0hVTktfQ09NUExFVEUASFBFX0NCX0hFQURFUl9WQUxVRV9DT01QTEVURQBIUEVfQ0JfQ0hVTktfRVhURU5TSU9OX1ZBTFVFX0NPTVBMRVRFAEhQRV9DQl9DSFVOS19FWFRFTlNJT05fTkFNRV9DT01QTEVURQBIUEVfQ0JfTUVTU0FHRV9DT01QTEVURQBIUEVfQ0JfTUVUSE9EX0NPTVBMRVRFAEhQRV9DQl9IRUFERVJfRklFTERfQ09NUExFVEUAREVMRVRFAEhQRV9JTlZBTElEX0VPRl9TVEFURQBJTlZBTElEX1NTTF9DRVJUSUZJQ0FURQBQQVVTRQBOT19SRVNQT05TRQBVTlNVUFBPUlRFRF9NRURJQV9UWVBFAEdPTkUATk9UX0FDQ0VQVEFCTEUAU0VSVklDRV9VTkFWQUlMQUJMRQBSQU5HRV9OT1RfU0FUSVNGSUFCTEUAT1JJR0lOX0lTX1VOUkVBQ0hBQkxFAFJFU1BPTlNFX0lTX1NUQUxFAFBVUkdFAE1FUkdFAFJFUVVFU1RfSEVBREVSX0ZJRUxEU19UT09fTEFSR0UAUkVRVUVTVF9IRUFERVJfVE9PX0xBUkdFAFBBWUxPQURfVE9PX0xBUkdFAElOU1VGRklDSUVOVF9TVE9SQUdFAEhQRV9QQVVTRURfVVBHUkFERQBIUEVfUEFVU0VEX0gyX1VQR1JBREUAU09VUkNFAEFOTk9VTkNFAFRSQUNFAEhQRV9VTkVYUEVDVEVEX1NQQUNFAERFU0NSSUJFAFVOU1VCU0NSSUJFAFJFQ09SRABIUEVfSU5WQUxJRF9NRVRIT0QATk9UX0ZPVU5EAFBST1BGSU5EAFVOQklORABSRUJJTkQAVU5BVVRIT1JJWkVEAE1FVEhPRF9OT1RfQUxMT1dFRABIVFRQX1ZFUlNJT05fTk9UX1NVUFBPUlRFRABBTFJFQURZX1JFUE9SVEVEAEFDQ0VQVEVEAE5PVF9JTVBMRU1FTlRFRABMT09QX0RFVEVDVEVEAEhQRV9DUl9FWFBFQ1RFRABIUEVfTEZfRVhQRUNURUQAQ1JFQVRFRABJTV9VU0VEAEhQRV9QQVVTRUQAVElNRU9VVF9PQ0NVUkVEAFBBWU1FTlRfUkVRVUlSRUQAUFJFQ09ORElUSU9OX1JFUVVJUkVEAFBST1hZX0FVVEhFTlRJQ0FUSU9OX1JFUVVJUkVEAE5FVFdPUktfQVVUSEVOVElDQVRJT05fUkVRVUlSRUQATEVOR1RIX1JFUVVJUkVEAFNTTF9DRVJUSUZJQ0FURV9SRVFVSVJFRABVUEdSQURFX1JFUVVJUkVEAFBBR0VfRVhQSVJFRABQUkVDT05ESVRJT05fRkFJTEVEAEVYUEVDVEFUSU9OX0ZBSUxFRABSRVZBTElEQVRJT05fRkFJTEVEAFNTTF9IQU5EU0hBS0VfRkFJTEVEAExPQ0tFRABUUkFOU0ZPUk1BVElPTl9BUFBMSUVEAE5PVF9NT0RJRklFRABOT1RfRVhURU5ERUQAQkFORFdJRFRIX0xJTUlUX0VYQ0VFREVEAFNJVEVfSVNfT1ZFUkxPQURFRABIRUFEAEV4cGVjdGVkIEhUVFAvAABeEwAAJhMAADAQAADwFwAAnRMAABUSAAA5FwAA8BIAAAoQAAB1EgAArRIAAIITAABPFAAAfxAAAKAVAAAjFAAAiRIAAIsUAABNFQAA1BEAAM8UAAAQGAAAyRYAANwWAADBEQAA4BcAALsUAAB0FAAAfBUAAOUUAAAIFwAAHxAAAGUVAACjFAAAKBUAAAIVAACZFQAALBAAAIsZAABPDwAA1A4AAGoQAADOEAAAAhcAAIkOAABuEwAAHBMAAGYUAABWFwAAwRMAAM0TAABsEwAAaBcAAGYXAABfFwAAIhMAAM4PAABpDgAA2A4AAGMWAADLEwAAqg4AACgXAAAmFwAAxRMAAF0WAADoEQAAZxMAAGUTAADyFgAAcxMAAB0XAAD5FgAA8xEAAM8OAADOFQAADBIAALMRAAClEQAAYRAAADIXAAC7EwBB+TULAQEAQZA2C+ABAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAQf03CwEBAEGROAteAgMCAgICAgAAAgIAAgIAAgICAgICAgICAgAEAAAAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAAIAAgBB/TkLAQEAQZE6C14CAAICAgICAAACAgACAgACAgICAgICAgICAAMABAAAAAICAgICAgICAgICAgICAgICAgICAgICAgICAAAAAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAgACAEHwOwsNbG9zZWVlcC1hbGl2ZQBBiTwLAQEAQaA8C+ABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAQYk+CwEBAEGgPgvnAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBY2h1bmtlZABBsMAAC18BAQABAQEBAQAAAQEAAQEAAQEBAQEBAQEBAQAAAAAAAAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQAAAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEAAQBBkMIACyFlY3Rpb25lbnQtbGVuZ3Rob25yb3h5LWNvbm5lY3Rpb24AQcDCAAstcmFuc2Zlci1lbmNvZGluZ3BncmFkZQ0KDQoNClNNDQoNClRUUC9DRS9UU1AvAEH5wgALBQECAAEDAEGQwwAL4AEEAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBB+cQACwUBAgABAwBBkMUAC+ABBAEBBQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAQfnGAAsEAQAAAQBBkccAC98BAQEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBB+sgACwQBAAACAEGQyQALXwMEAAAEBAQEBAQEBAQEBAUEBAQEBAQEBAQEBAQABAAGBwQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEAAQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQAAAAEAEH6ygALBAEAAAEAQZDLAAsBAQBBqssAC0ECAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMAAAAAAAADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwBB+swACwQBAAABAEGQzQALAQEAQZrNAAsGAgAAAAACAEGxzQALOgMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMAQfDOAAuWAU5PVU5DRUVDS09VVE5FQ1RFVEVDUklCRUxVU0hFVEVBRFNFQVJDSFJHRUNUSVZJVFlMRU5EQVJWRU9USUZZUFRJT05TQ0hTRUFZU1RBVENIR0VPUkRJUkVDVE9SVFJDSFBBUkFNRVRFUlVSQ0VCU0NSSUJFQVJET1dOQUNFSU5ETktDS1VCU0NSSUJFSFRUUC9BRFRQLw==", "base64");
  }
});

// node_modules/undici/lib/web/fetch/constants.js
var require_constants3 = __commonJS({
  "node_modules/undici/lib/web/fetch/constants.js"(exports, module) {
    "use strict";
    var corsSafeListedMethods = (
      /** @type {const} */
      ["GET", "HEAD", "POST"]
    ), corsSafeListedMethodsSet = new Set(corsSafeListedMethods), nullBodyStatus = (
      /** @type {const} */
      [101, 204, 205, 304]
    ), redirectStatus = (
      /** @type {const} */
      [301, 302, 303, 307, 308]
    ), redirectStatusSet = new Set(redirectStatus), badPorts = (
      /** @type {const} */
      [
        "1",
        "7",
        "9",
        "11",
        "13",
        "15",
        "17",
        "19",
        "20",
        "21",
        "22",
        "23",
        "25",
        "37",
        "42",
        "43",
        "53",
        "69",
        "77",
        "79",
        "87",
        "95",
        "101",
        "102",
        "103",
        "104",
        "109",
        "110",
        "111",
        "113",
        "115",
        "117",
        "119",
        "123",
        "135",
        "137",
        "139",
        "143",
        "161",
        "179",
        "389",
        "427",
        "465",
        "512",
        "513",
        "514",
        "515",
        "526",
        "530",
        "531",
        "532",
        "540",
        "548",
        "554",
        "556",
        "563",
        "587",
        "601",
        "636",
        "989",
        "990",
        "993",
        "995",
        "1719",
        "1720",
        "1723",
        "2049",
        "3659",
        "4045",
        "4190",
        "5060",
        "5061",
        "6000",
        "6566",
        "6665",
        "6666",
        "6667",
        "6668",
        "6669",
        "6679",
        "6697",
        "10080"
      ]
    ), badPortsSet = new Set(badPorts), referrerPolicy = (
      /** @type {const} */
      [
        "",
        "no-referrer",
        "no-referrer-when-downgrade",
        "same-origin",
        "origin",
        "strict-origin",
        "origin-when-cross-origin",
        "strict-origin-when-cross-origin",
        "unsafe-url"
      ]
    ), referrerPolicySet = new Set(referrerPolicy), requestRedirect = (
      /** @type {const} */
      ["follow", "manual", "error"]
    ), safeMethods = (
      /** @type {const} */
      ["GET", "HEAD", "OPTIONS", "TRACE"]
    ), safeMethodsSet = new Set(safeMethods), requestMode = (
      /** @type {const} */
      ["navigate", "same-origin", "no-cors", "cors"]
    ), requestCredentials = (
      /** @type {const} */
      ["omit", "same-origin", "include"]
    ), requestCache = (
      /** @type {const} */
      [
        "default",
        "no-store",
        "reload",
        "no-cache",
        "force-cache",
        "only-if-cached"
      ]
    ), requestBodyHeader = (
      /** @type {const} */
      [
        "content-encoding",
        "content-language",
        "content-location",
        "content-type",
        // See https://github.com/nodejs/undici/issues/2021
        // 'Content-Length' is a forbidden header name, which is typically
        // removed in the Headers implementation. However, undici doesn't
        // filter out headers, so we add it here.
        "content-length"
      ]
    ), requestDuplex = (
      /** @type {const} */
      [
        "half"
      ]
    ), forbiddenMethods = (
      /** @type {const} */
      ["CONNECT", "TRACE", "TRACK"]
    ), forbiddenMethodsSet = new Set(forbiddenMethods), subresource = (
      /** @type {const} */
      [
        "audio",
        "audioworklet",
        "font",
        "image",
        "manifest",
        "paintworklet",
        "script",
        "style",
        "track",
        "video",
        "xslt",
        ""
      ]
    ), subresourceSet = new Set(subresource);
    module.exports = {
      subresource,
      forbiddenMethods,
      requestBodyHeader,
      referrerPolicy,
      requestRedirect,
      requestMode,
      requestCredentials,
      requestCache,
      redirectStatus,
      corsSafeListedMethods,
      nullBodyStatus,
      safeMethods,
      badPorts,
      requestDuplex,
      subresourceSet,
      badPortsSet,
      redirectStatusSet,
      corsSafeListedMethodsSet,
      safeMethodsSet,
      forbiddenMethodsSet,
      referrerPolicySet
    };
  }
});

// node_modules/undici/lib/web/fetch/global.js
var require_global = __commonJS({
  "node_modules/undici/lib/web/fetch/global.js"(exports, module) {
    "use strict";
    var globalOrigin = /* @__PURE__ */ Symbol.for("undici.globalOrigin.1");
    function getGlobalOrigin() {
      return globalThis[globalOrigin];
    }
    function setGlobalOrigin(newOrigin) {
      if (newOrigin === void 0) {
        Object.defineProperty(globalThis, globalOrigin, {
          value: void 0,
          writable: !0,
          enumerable: !1,
          configurable: !1
        });
        return;
      }
      let parsedURL = new URL(newOrigin);
      if (parsedURL.protocol !== "http:" && parsedURL.protocol !== "https:")
        throw new TypeError(`Only http & https urls are allowed, received ${parsedURL.protocol}`);
      Object.defineProperty(globalThis, globalOrigin, {
        value: parsedURL,
        writable: !0,
        enumerable: !1,
        configurable: !1
      });
    }
    module.exports = {
      getGlobalOrigin,
      setGlobalOrigin
    };
  }
});

// node_modules/undici/lib/web/fetch/data-url.js
var require_data_url = __commonJS({
  "node_modules/undici/lib/web/fetch/data-url.js"(exports, module) {
    "use strict";
    var assert = __require("node:assert"), encoder = new TextEncoder(), HTTP_TOKEN_CODEPOINTS = /^[!#$%&'*+\-.^_|~A-Za-z0-9]+$/, HTTP_WHITESPACE_REGEX = /[\u000A\u000D\u0009\u0020]/, ASCII_WHITESPACE_REPLACE_REGEX = /[\u0009\u000A\u000C\u000D\u0020]/g, HTTP_QUOTED_STRING_TOKENS = /^[\u0009\u0020-\u007E\u0080-\u00FF]+$/;
    function dataURLProcessor(dataURL) {
      assert(dataURL.protocol === "data:");
      let input = URLSerializer(dataURL, !0);
      input = input.slice(5);
      let position = { position: 0 }, mimeType = collectASequenceOfCodePointsFast(
        ",",
        input,
        position
      ), mimeTypeLength = mimeType.length;
      if (mimeType = removeASCIIWhitespace(mimeType, !0, !0), position.position >= input.length)
        return "failure";
      position.position++;
      let encodedBody = input.slice(mimeTypeLength + 1), body = stringPercentDecode(encodedBody);
      if (/;(\u0020){0,}base64$/i.test(mimeType)) {
        let stringBody = isomorphicDecode(body);
        if (body = forgivingBase64(stringBody), body === "failure")
          return "failure";
        mimeType = mimeType.slice(0, -6), mimeType = mimeType.replace(/(\u0020)+$/, ""), mimeType = mimeType.slice(0, -1);
      }
      mimeType.startsWith(";") && (mimeType = "text/plain" + mimeType);
      let mimeTypeRecord = parseMIMEType(mimeType);
      return mimeTypeRecord === "failure" && (mimeTypeRecord = parseMIMEType("text/plain;charset=US-ASCII")), { mimeType: mimeTypeRecord, body };
    }
    function URLSerializer(url, excludeFragment = !1) {
      if (!excludeFragment)
        return url.href;
      let href = url.href, hashLength = url.hash.length, serialized = hashLength === 0 ? href : href.substring(0, href.length - hashLength);
      return !hashLength && href.endsWith("#") ? serialized.slice(0, -1) : serialized;
    }
    function collectASequenceOfCodePoints(condition, input, position) {
      let result = "";
      for (; position.position < input.length && condition(input[position.position]); )
        result += input[position.position], position.position++;
      return result;
    }
    function collectASequenceOfCodePointsFast(char, input, position) {
      let idx = input.indexOf(char, position.position), start = position.position;
      return idx === -1 ? (position.position = input.length, input.slice(start)) : (position.position = idx, input.slice(start, position.position));
    }
    function stringPercentDecode(input) {
      let bytes = encoder.encode(input);
      return percentDecode(bytes);
    }
    function isHexCharByte(byte) {
      return byte >= 48 && byte <= 57 || byte >= 65 && byte <= 70 || byte >= 97 && byte <= 102;
    }
    function hexByteToNumber(byte) {
      return (
        // 0-9
        byte >= 48 && byte <= 57 ? byte - 48 : (byte & 223) - 55
      );
    }
    function percentDecode(input) {
      let length = input.length, output = new Uint8Array(length), j = 0;
      for (let i = 0; i < length; ++i) {
        let byte = input[i];
        byte !== 37 ? output[j++] = byte : byte === 37 && !(isHexCharByte(input[i + 1]) && isHexCharByte(input[i + 2])) ? output[j++] = 37 : (output[j++] = hexByteToNumber(input[i + 1]) << 4 | hexByteToNumber(input[i + 2]), i += 2);
      }
      return length === j ? output : output.subarray(0, j);
    }
    function parseMIMEType(input) {
      input = removeHTTPWhitespace(input, !0, !0);
      let position = { position: 0 }, type = collectASequenceOfCodePointsFast(
        "/",
        input,
        position
      );
      if (type.length === 0 || !HTTP_TOKEN_CODEPOINTS.test(type) || position.position > input.length)
        return "failure";
      position.position++;
      let subtype = collectASequenceOfCodePointsFast(
        ";",
        input,
        position
      );
      if (subtype = removeHTTPWhitespace(subtype, !1, !0), subtype.length === 0 || !HTTP_TOKEN_CODEPOINTS.test(subtype))
        return "failure";
      let typeLowercase = type.toLowerCase(), subtypeLowercase = subtype.toLowerCase(), mimeType = {
        type: typeLowercase,
        subtype: subtypeLowercase,
        /** @type {Map<string, string>} */
        parameters: /* @__PURE__ */ new Map(),
        // https://mimesniff.spec.whatwg.org/#mime-type-essence
        essence: `${typeLowercase}/${subtypeLowercase}`
      };
      for (; position.position < input.length; ) {
        position.position++, collectASequenceOfCodePoints(
          // https://fetch.spec.whatwg.org/#http-whitespace
          (char) => HTTP_WHITESPACE_REGEX.test(char),
          input,
          position
        );
        let parameterName = collectASequenceOfCodePoints(
          (char) => char !== ";" && char !== "=",
          input,
          position
        );
        if (parameterName = parameterName.toLowerCase(), position.position < input.length) {
          if (input[position.position] === ";")
            continue;
          position.position++;
        }
        if (position.position > input.length)
          break;
        let parameterValue = null;
        if (input[position.position] === '"')
          parameterValue = collectAnHTTPQuotedString(input, position, !0), collectASequenceOfCodePointsFast(
            ";",
            input,
            position
          );
        else if (parameterValue = collectASequenceOfCodePointsFast(
          ";",
          input,
          position
        ), parameterValue = removeHTTPWhitespace(parameterValue, !1, !0), parameterValue.length === 0)
          continue;
        parameterName.length !== 0 && HTTP_TOKEN_CODEPOINTS.test(parameterName) && (parameterValue.length === 0 || HTTP_QUOTED_STRING_TOKENS.test(parameterValue)) && !mimeType.parameters.has(parameterName) && mimeType.parameters.set(parameterName, parameterValue);
      }
      return mimeType;
    }
    function forgivingBase64(data) {
      data = data.replace(ASCII_WHITESPACE_REPLACE_REGEX, "");
      let dataLength = data.length;
      if (dataLength % 4 === 0 && data.charCodeAt(dataLength - 1) === 61 && (--dataLength, data.charCodeAt(dataLength - 1) === 61 && --dataLength), dataLength % 4 === 1 || /[^+/0-9A-Za-z]/.test(data.length === dataLength ? data : data.substring(0, dataLength)))
        return "failure";
      let buffer = Buffer.from(data, "base64");
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    function collectAnHTTPQuotedString(input, position, extractValue) {
      let positionStart = position.position, value = "";
      for (assert(input[position.position] === '"'), position.position++; value += collectASequenceOfCodePoints(
        (char) => char !== '"' && char !== "\\",
        input,
        position
      ), !(position.position >= input.length); ) {
        let quoteOrBackslash = input[position.position];
        if (position.position++, quoteOrBackslash === "\\") {
          if (position.position >= input.length) {
            value += "\\";
            break;
          }
          value += input[position.position], position.position++;
        } else {
          assert(quoteOrBackslash === '"');
          break;
        }
      }
      return extractValue ? value : input.slice(positionStart, position.position);
    }
    function serializeAMimeType(mimeType) {
      assert(mimeType !== "failure");
      let { parameters, essence } = mimeType, serialization = essence;
      for (let [name, value] of parameters.entries())
        serialization += ";", serialization += name, serialization += "=", HTTP_TOKEN_CODEPOINTS.test(value) || (value = value.replace(/(\\|")/g, "\\$1"), value = '"' + value, value += '"'), serialization += value;
      return serialization;
    }
    function isHTTPWhiteSpace(char) {
      return char === 13 || char === 10 || char === 9 || char === 32;
    }
    function removeHTTPWhitespace(str, leading = !0, trailing = !0) {
      return removeChars(str, leading, trailing, isHTTPWhiteSpace);
    }
    function isASCIIWhitespace(char) {
      return char === 13 || char === 10 || char === 9 || char === 12 || char === 32;
    }
    function removeASCIIWhitespace(str, leading = !0, trailing = !0) {
      return removeChars(str, leading, trailing, isASCIIWhitespace);
    }
    function removeChars(str, leading, trailing, predicate) {
      let lead = 0, trail = str.length - 1;
      if (leading)
        for (; lead < str.length && predicate(str.charCodeAt(lead)); ) lead++;
      if (trailing)
        for (; trail > 0 && predicate(str.charCodeAt(trail)); ) trail--;
      return lead === 0 && trail === str.length - 1 ? str : str.slice(lead, trail + 1);
    }
    function isomorphicDecode(input) {
      let length = input.length;
      if (65535 > length)
        return String.fromCharCode.apply(null, input);
      let result = "", i = 0, addition = 65535;
      for (; i < length; )
        i + addition > length && (addition = length - i), result += String.fromCharCode.apply(null, input.subarray(i, i += addition));
      return result;
    }
    function minimizeSupportedMimeType(mimeType) {
      switch (mimeType.essence) {
        case "application/ecmascript":
        case "application/javascript":
        case "application/x-ecmascript":
        case "application/x-javascript":
        case "text/ecmascript":
        case "text/javascript":
        case "text/javascript1.0":
        case "text/javascript1.1":
        case "text/javascript1.2":
        case "text/javascript1.3":
        case "text/javascript1.4":
        case "text/javascript1.5":
        case "text/jscript":
        case "text/livescript":
        case "text/x-ecmascript":
        case "text/x-javascript":
          return "text/javascript";
        case "application/json":
        case "text/json":
          return "application/json";
        case "image/svg+xml":
          return "image/svg+xml";
        case "text/xml":
        case "application/xml":
          return "application/xml";
      }
      return mimeType.subtype.endsWith("+json") ? "application/json" : mimeType.subtype.endsWith("+xml") ? "application/xml" : "";
    }
    module.exports = {
      dataURLProcessor,
      URLSerializer,
      collectASequenceOfCodePoints,
      collectASequenceOfCodePointsFast,
      stringPercentDecode,
      parseMIMEType,
      collectAnHTTPQuotedString,
      serializeAMimeType,
      removeChars,
      removeHTTPWhitespace,
      minimizeSupportedMimeType,
      HTTP_TOKEN_CODEPOINTS,
      isomorphicDecode
    };
  }
});

// node_modules/undici/lib/web/fetch/webidl.js
var require_webidl = __commonJS({
  "node_modules/undici/lib/web/fetch/webidl.js"(exports, module) {
    "use strict";
    var { types, inspect } = __require("node:util"), { markAsUncloneable } = __require("node:worker_threads"), { toUSVString } = require_util(), webidl = {};
    webidl.converters = {};
    webidl.util = {};
    webidl.errors = {};
    webidl.errors.exception = function(message) {
      return new TypeError(`${message.header}: ${message.message}`);
    };
    webidl.errors.conversionFailed = function(context) {
      let plural = context.types.length === 1 ? "" : " one of", message = `${context.argument} could not be converted to${plural}: ${context.types.join(", ")}.`;
      return webidl.errors.exception({
        header: context.prefix,
        message
      });
    };
    webidl.errors.invalidArgument = function(context) {
      return webidl.errors.exception({
        header: context.prefix,
        message: `"${context.value}" is an invalid ${context.type}.`
      });
    };
    webidl.brandCheck = function(V, I, opts) {
      if (opts?.strict !== !1) {
        if (!(V instanceof I)) {
          let err = new TypeError("Illegal invocation");
          throw err.code = "ERR_INVALID_THIS", err;
        }
      } else if (V?.[Symbol.toStringTag] !== I.prototype[Symbol.toStringTag]) {
        let err = new TypeError("Illegal invocation");
        throw err.code = "ERR_INVALID_THIS", err;
      }
    };
    webidl.argumentLengthCheck = function({ length }, min, ctx) {
      if (length < min)
        throw webidl.errors.exception({
          message: `${min} argument${min !== 1 ? "s" : ""} required, but${length ? " only" : ""} ${length} found.`,
          header: ctx
        });
    };
    webidl.illegalConstructor = function() {
      throw webidl.errors.exception({
        header: "TypeError",
        message: "Illegal constructor"
      });
    };
    webidl.util.Type = function(V) {
      switch (typeof V) {
        case "undefined":
          return "Undefined";
        case "boolean":
          return "Boolean";
        case "string":
          return "String";
        case "symbol":
          return "Symbol";
        case "number":
          return "Number";
        case "bigint":
          return "BigInt";
        case "function":
        case "object":
          return V === null ? "Null" : "Object";
      }
    };
    webidl.util.markAsUncloneable = markAsUncloneable || (() => {
    });
    webidl.util.ConvertToInt = function(V, bitLength, signedness, opts) {
      let upperBound, lowerBound;
      bitLength === 64 ? (upperBound = Math.pow(2, 53) - 1, signedness === "unsigned" ? lowerBound = 0 : lowerBound = Math.pow(-2, 53) + 1) : signedness === "unsigned" ? (lowerBound = 0, upperBound = Math.pow(2, bitLength) - 1) : (lowerBound = Math.pow(-2, bitLength) - 1, upperBound = Math.pow(2, bitLength - 1) - 1);
      let x = Number(V);
      if (x === 0 && (x = 0), opts?.enforceRange === !0) {
        if (Number.isNaN(x) || x === Number.POSITIVE_INFINITY || x === Number.NEGATIVE_INFINITY)
          throw webidl.errors.exception({
            header: "Integer conversion",
            message: `Could not convert ${webidl.util.Stringify(V)} to an integer.`
          });
        if (x = webidl.util.IntegerPart(x), x < lowerBound || x > upperBound)
          throw webidl.errors.exception({
            header: "Integer conversion",
            message: `Value must be between ${lowerBound}-${upperBound}, got ${x}.`
          });
        return x;
      }
      return !Number.isNaN(x) && opts?.clamp === !0 ? (x = Math.min(Math.max(x, lowerBound), upperBound), Math.floor(x) % 2 === 0 ? x = Math.floor(x) : x = Math.ceil(x), x) : Number.isNaN(x) || x === 0 && Object.is(0, x) || x === Number.POSITIVE_INFINITY || x === Number.NEGATIVE_INFINITY ? 0 : (x = webidl.util.IntegerPart(x), x = x % Math.pow(2, bitLength), signedness === "signed" && x >= Math.pow(2, bitLength) - 1 ? x - Math.pow(2, bitLength) : x);
    };
    webidl.util.IntegerPart = function(n) {
      let r = Math.floor(Math.abs(n));
      return n < 0 ? -1 * r : r;
    };
    webidl.util.Stringify = function(V) {
      switch (webidl.util.Type(V)) {
        case "Symbol":
          return `Symbol(${V.description})`;
        case "Object":
          return inspect(V);
        case "String":
          return `"${V}"`;
        default:
          return `${V}`;
      }
    };
    webidl.sequenceConverter = function(converter) {
      return (V, prefix, argument, Iterable) => {
        if (webidl.util.Type(V) !== "Object")
          throw webidl.errors.exception({
            header: prefix,
            message: `${argument} (${webidl.util.Stringify(V)}) is not iterable.`
          });
        let method = typeof Iterable == "function" ? Iterable() : V?.[Symbol.iterator]?.(), seq = [], index = 0;
        if (method === void 0 || typeof method.next != "function")
          throw webidl.errors.exception({
            header: prefix,
            message: `${argument} is not iterable.`
          });
        for (; ; ) {
          let { done, value } = method.next();
          if (done)
            break;
          seq.push(converter(value, prefix, `${argument}[${index++}]`));
        }
        return seq;
      };
    };
    webidl.recordConverter = function(keyConverter, valueConverter) {
      return (O, prefix, argument) => {
        if (webidl.util.Type(O) !== "Object")
          throw webidl.errors.exception({
            header: prefix,
            message: `${argument} ("${webidl.util.Type(O)}") is not an Object.`
          });
        let result = {};
        if (!types.isProxy(O)) {
          let keys2 = [...Object.getOwnPropertyNames(O), ...Object.getOwnPropertySymbols(O)];
          for (let key of keys2) {
            let typedKey = keyConverter(key, prefix, argument), typedValue = valueConverter(O[key], prefix, argument);
            result[typedKey] = typedValue;
          }
          return result;
        }
        let keys = Reflect.ownKeys(O);
        for (let key of keys)
          if (Reflect.getOwnPropertyDescriptor(O, key)?.enumerable) {
            let typedKey = keyConverter(key, prefix, argument), typedValue = valueConverter(O[key], prefix, argument);
            result[typedKey] = typedValue;
          }
        return result;
      };
    };
    webidl.interfaceConverter = function(i) {
      return (V, prefix, argument, opts) => {
        if (opts?.strict !== !1 && !(V instanceof i))
          throw webidl.errors.exception({
            header: prefix,
            message: `Expected ${argument} ("${webidl.util.Stringify(V)}") to be an instance of ${i.name}.`
          });
        return V;
      };
    };
    webidl.dictionaryConverter = function(converters) {
      return (dictionary, prefix, argument) => {
        let type = webidl.util.Type(dictionary), dict = {};
        if (type === "Null" || type === "Undefined")
          return dict;
        if (type !== "Object")
          throw webidl.errors.exception({
            header: prefix,
            message: `Expected ${dictionary} to be one of: Null, Undefined, Object.`
          });
        for (let options of converters) {
          let { key, defaultValue, required, converter } = options;
          if (required === !0 && !Object.hasOwn(dictionary, key))
            throw webidl.errors.exception({
              header: prefix,
              message: `Missing required key "${key}".`
            });
          let value = dictionary[key], hasDefault = Object.hasOwn(options, "defaultValue");
          if (hasDefault && value !== null && (value ??= defaultValue()), required || hasDefault || value !== void 0) {
            if (value = converter(value, prefix, `${argument}.${key}`), options.allowedValues && !options.allowedValues.includes(value))
              throw webidl.errors.exception({
                header: prefix,
                message: `${value} is not an accepted type. Expected one of ${options.allowedValues.join(", ")}.`
              });
            dict[key] = value;
          }
        }
        return dict;
      };
    };
    webidl.nullableConverter = function(converter) {
      return (V, prefix, argument) => V === null ? V : converter(V, prefix, argument);
    };
    webidl.converters.DOMString = function(V, prefix, argument, opts) {
      if (V === null && opts?.legacyNullToEmptyString)
        return "";
      if (typeof V == "symbol")
        throw webidl.errors.exception({
          header: prefix,
          message: `${argument} is a symbol, which cannot be converted to a DOMString.`
        });
      return String(V);
    };
    webidl.converters.ByteString = function(V, prefix, argument) {
      let x = webidl.converters.DOMString(V, prefix, argument);
      for (let index = 0; index < x.length; index++)
        if (x.charCodeAt(index) > 255)
          throw new TypeError(
            `Cannot convert argument to a ByteString because the character at index ${index} has a value of ${x.charCodeAt(index)} which is greater than 255.`
          );
      return x;
    };
    webidl.converters.USVString = toUSVString;
    webidl.converters.boolean = function(V) {
      return !!V;
    };
    webidl.converters.any = function(V) {
      return V;
    };
    webidl.converters["long long"] = function(V, prefix, argument) {
      return webidl.util.ConvertToInt(V, 64, "signed", void 0, prefix, argument);
    };
    webidl.converters["unsigned long long"] = function(V, prefix, argument) {
      return webidl.util.ConvertToInt(V, 64, "unsigned", void 0, prefix, argument);
    };
    webidl.converters["unsigned long"] = function(V, prefix, argument) {
      return webidl.util.ConvertToInt(V, 32, "unsigned", void 0, prefix, argument);
    };
    webidl.converters["unsigned short"] = function(V, prefix, argument, opts) {
      return webidl.util.ConvertToInt(V, 16, "unsigned", opts, prefix, argument);
    };
    webidl.converters.ArrayBuffer = function(V, prefix, argument, opts) {
      if (webidl.util.Type(V) !== "Object" || !types.isAnyArrayBuffer(V))
        throw webidl.errors.conversionFailed({
          prefix,
          argument: `${argument} ("${webidl.util.Stringify(V)}")`,
          types: ["ArrayBuffer"]
        });
      if (opts?.allowShared === !1 && types.isSharedArrayBuffer(V))
        throw webidl.errors.exception({
          header: "ArrayBuffer",
          message: "SharedArrayBuffer is not allowed."
        });
      if (V.resizable || V.growable)
        throw webidl.errors.exception({
          header: "ArrayBuffer",
          message: "Received a resizable ArrayBuffer."
        });
      return V;
    };
    webidl.converters.TypedArray = function(V, T, prefix, name, opts) {
      if (webidl.util.Type(V) !== "Object" || !types.isTypedArray(V) || V.constructor.name !== T.name)
        throw webidl.errors.conversionFailed({
          prefix,
          argument: `${name} ("${webidl.util.Stringify(V)}")`,
          types: [T.name]
        });
      if (opts?.allowShared === !1 && types.isSharedArrayBuffer(V.buffer))
        throw webidl.errors.exception({
          header: "ArrayBuffer",
          message: "SharedArrayBuffer is not allowed."
        });
      if (V.buffer.resizable || V.buffer.growable)
        throw webidl.errors.exception({
          header: "ArrayBuffer",
          message: "Received a resizable ArrayBuffer."
        });
      return V;
    };
    webidl.converters.DataView = function(V, prefix, name, opts) {
      if (webidl.util.Type(V) !== "Object" || !types.isDataView(V))
        throw webidl.errors.exception({
          header: prefix,
          message: `${name} is not a DataView.`
        });
      if (opts?.allowShared === !1 && types.isSharedArrayBuffer(V.buffer))
        throw webidl.errors.exception({
          header: "ArrayBuffer",
          message: "SharedArrayBuffer is not allowed."
        });
      if (V.buffer.resizable || V.buffer.growable)
        throw webidl.errors.exception({
          header: "ArrayBuffer",
          message: "Received a resizable ArrayBuffer."
        });
      return V;
    };
    webidl.converters.BufferSource = function(V, prefix, name, opts) {
      if (types.isAnyArrayBuffer(V))
        return webidl.converters.ArrayBuffer(V, prefix, name, { ...opts, allowShared: !1 });
      if (types.isTypedArray(V))
        return webidl.converters.TypedArray(V, V.constructor, prefix, name, { ...opts, allowShared: !1 });
      if (types.isDataView(V))
        return webidl.converters.DataView(V, prefix, name, { ...opts, allowShared: !1 });
      throw webidl.errors.conversionFailed({
        prefix,
        argument: `${name} ("${webidl.util.Stringify(V)}")`,
        types: ["BufferSource"]
      });
    };
    webidl.converters["sequence<ByteString>"] = webidl.sequenceConverter(
      webidl.converters.ByteString
    );
    webidl.converters["sequence<sequence<ByteString>>"] = webidl.sequenceConverter(
      webidl.converters["sequence<ByteString>"]
    );
    webidl.converters["record<ByteString, ByteString>"] = webidl.recordConverter(
      webidl.converters.ByteString,
      webidl.converters.ByteString
    );
    module.exports = {
      webidl
    };
  }
});

// node_modules/undici/lib/web/fetch/util.js
var require_util2 = __commonJS({
  "node_modules/undici/lib/web/fetch/util.js"(exports, module) {
    "use strict";
    var { Transform } = __require("node:stream"), zlib = __require("node:zlib"), { redirectStatusSet, referrerPolicySet: referrerPolicyTokens, badPortsSet } = require_constants3(), { getGlobalOrigin } = require_global(), { collectASequenceOfCodePoints, collectAnHTTPQuotedString, removeChars, parseMIMEType } = require_data_url(), { performance: performance2 } = __require("node:perf_hooks"), { isBlobLike, ReadableStreamFrom, isValidHTTPToken, normalizedMethodRecordsBase } = require_util(), assert = __require("node:assert"), { isUint8Array } = __require("node:util/types"), { webidl } = require_webidl(), supportedHashes = [], crypto2;
    try {
      crypto2 = __require("node:crypto");
      let possibleRelevantHashes = ["sha256", "sha384", "sha512"];
      supportedHashes = crypto2.getHashes().filter((hash) => possibleRelevantHashes.includes(hash));
    } catch {
    }
    function responseURL(response) {
      let urlList = response.urlList, length = urlList.length;
      return length === 0 ? null : urlList[length - 1].toString();
    }
    function responseLocationURL(response, requestFragment) {
      if (!redirectStatusSet.has(response.status))
        return null;
      let location = response.headersList.get("location", !0);
      return location !== null && isValidHeaderValue(location) && (isValidEncodedURL(location) || (location = normalizeBinaryStringToUtf8(location)), location = new URL(location, responseURL(response))), location && !location.hash && (location.hash = requestFragment), location;
    }
    function isValidEncodedURL(url) {
      for (let i = 0; i < url.length; ++i) {
        let code = url.charCodeAt(i);
        if (code > 126 || // Non-US-ASCII + DEL
        code < 32)
          return !1;
      }
      return !0;
    }
    function normalizeBinaryStringToUtf8(value) {
      return Buffer.from(value, "binary").toString("utf8");
    }
    function requestCurrentURL(request) {
      return request.urlList[request.urlList.length - 1];
    }
    function requestBadPort(request) {
      let url = requestCurrentURL(request);
      return urlIsHttpHttpsScheme(url) && badPortsSet.has(url.port) ? "blocked" : "allowed";
    }
    function isErrorLike(object) {
      return object instanceof Error || object?.constructor?.name === "Error" || object?.constructor?.name === "DOMException";
    }
    function isValidReasonPhrase(statusText) {
      for (let i = 0; i < statusText.length; ++i) {
        let c = statusText.charCodeAt(i);
        if (!(c === 9 || // HTAB
        c >= 32 && c <= 126 || // SP / VCHAR
        c >= 128 && c <= 255))
          return !1;
      }
      return !0;
    }
    var isValidHeaderName = isValidHTTPToken;
    function isValidHeaderValue(potentialValue) {
      return (potentialValue[0] === "	" || potentialValue[0] === " " || potentialValue[potentialValue.length - 1] === "	" || potentialValue[potentialValue.length - 1] === " " || potentialValue.includes(`
`) || potentialValue.includes("\r") || potentialValue.includes("\0")) === !1;
    }
    function setRequestReferrerPolicyOnRedirect(request, actualResponse) {
      let { headersList } = actualResponse, policyHeader = (headersList.get("referrer-policy", !0) ?? "").split(","), policy = "";
      if (policyHeader.length > 0)
        for (let i = policyHeader.length; i !== 0; i--) {
          let token = policyHeader[i - 1].trim();
          if (referrerPolicyTokens.has(token)) {
            policy = token;
            break;
          }
        }
      policy !== "" && (request.referrerPolicy = policy);
    }
    function crossOriginResourcePolicyCheck() {
      return "allowed";
    }
    function corsCheck() {
      return "success";
    }
    function TAOCheck() {
      return "success";
    }
    function appendFetchMetadata(httpRequest) {
      let header = null;
      header = httpRequest.mode, httpRequest.headersList.set("sec-fetch-mode", header, !0);
    }
    function appendRequestOriginHeader(request) {
      let serializedOrigin = request.origin;
      if (!(serializedOrigin === "client" || serializedOrigin === void 0)) {
        if (request.responseTainting === "cors" || request.mode === "websocket")
          request.headersList.append("origin", serializedOrigin, !0);
        else if (request.method !== "GET" && request.method !== "HEAD") {
          switch (request.referrerPolicy) {
            case "no-referrer":
              serializedOrigin = null;
              break;
            case "no-referrer-when-downgrade":
            case "strict-origin":
            case "strict-origin-when-cross-origin":
              request.origin && urlHasHttpsScheme(request.origin) && !urlHasHttpsScheme(requestCurrentURL(request)) && (serializedOrigin = null);
              break;
            case "same-origin":
              sameOrigin(request, requestCurrentURL(request)) || (serializedOrigin = null);
              break;
            default:
          }
          request.headersList.append("origin", serializedOrigin, !0);
        }
      }
    }
    function coarsenTime(timestamp, crossOriginIsolatedCapability) {
      return timestamp;
    }
    function clampAndCoarsenConnectionTimingInfo(connectionTimingInfo, defaultStartTime, crossOriginIsolatedCapability) {
      return !connectionTimingInfo?.startTime || connectionTimingInfo.startTime < defaultStartTime ? {
        domainLookupStartTime: defaultStartTime,
        domainLookupEndTime: defaultStartTime,
        connectionStartTime: defaultStartTime,
        connectionEndTime: defaultStartTime,
        secureConnectionStartTime: defaultStartTime,
        ALPNNegotiatedProtocol: connectionTimingInfo?.ALPNNegotiatedProtocol
      } : {
        domainLookupStartTime: coarsenTime(connectionTimingInfo.domainLookupStartTime, crossOriginIsolatedCapability),
        domainLookupEndTime: coarsenTime(connectionTimingInfo.domainLookupEndTime, crossOriginIsolatedCapability),
        connectionStartTime: coarsenTime(connectionTimingInfo.connectionStartTime, crossOriginIsolatedCapability),
        connectionEndTime: coarsenTime(connectionTimingInfo.connectionEndTime, crossOriginIsolatedCapability),
        secureConnectionStartTime: coarsenTime(connectionTimingInfo.secureConnectionStartTime, crossOriginIsolatedCapability),
        ALPNNegotiatedProtocol: connectionTimingInfo.ALPNNegotiatedProtocol
      };
    }
    function coarsenedSharedCurrentTime(crossOriginIsolatedCapability) {
      return coarsenTime(performance2.now(), crossOriginIsolatedCapability);
    }
    function createOpaqueTimingInfo(timingInfo) {
      return {
        startTime: timingInfo.startTime ?? 0,
        redirectStartTime: 0,
        redirectEndTime: 0,
        postRedirectStartTime: timingInfo.startTime ?? 0,
        finalServiceWorkerStartTime: 0,
        finalNetworkResponseStartTime: 0,
        finalNetworkRequestStartTime: 0,
        endTime: 0,
        encodedBodySize: 0,
        decodedBodySize: 0,
        finalConnectionTimingInfo: null
      };
    }
    function makePolicyContainer() {
      return {
        referrerPolicy: "strict-origin-when-cross-origin"
      };
    }
    function clonePolicyContainer(policyContainer) {
      return {
        referrerPolicy: policyContainer.referrerPolicy
      };
    }
    function determineRequestsReferrer(request) {
      let policy = request.referrerPolicy;
      assert(policy);
      let referrerSource = null;
      if (request.referrer === "client") {
        let globalOrigin = getGlobalOrigin();
        if (!globalOrigin || globalOrigin.origin === "null")
          return "no-referrer";
        referrerSource = new URL(globalOrigin);
      } else request.referrer instanceof URL && (referrerSource = request.referrer);
      let referrerURL = stripURLForReferrer(referrerSource), referrerOrigin = stripURLForReferrer(referrerSource, !0);
      referrerURL.toString().length > 4096 && (referrerURL = referrerOrigin);
      let areSameOrigin = sameOrigin(request, referrerURL), isNonPotentiallyTrustWorthy = isURLPotentiallyTrustworthy(referrerURL) && !isURLPotentiallyTrustworthy(request.url);
      switch (policy) {
        case "origin":
          return referrerOrigin ?? stripURLForReferrer(referrerSource, !0);
        case "unsafe-url":
          return referrerURL;
        case "same-origin":
          return areSameOrigin ? referrerOrigin : "no-referrer";
        case "origin-when-cross-origin":
          return areSameOrigin ? referrerURL : referrerOrigin;
        case "strict-origin-when-cross-origin": {
          let currentURL = requestCurrentURL(request);
          return sameOrigin(referrerURL, currentURL) ? referrerURL : isURLPotentiallyTrustworthy(referrerURL) && !isURLPotentiallyTrustworthy(currentURL) ? "no-referrer" : referrerOrigin;
        }
        // eslint-disable-line
        /**
         * 1. If referrerURL is a potentially trustworthy URL and
         * request’s current URL is not a potentially trustworthy URL,
         * then return no referrer.
         * 2. Return referrerOrigin
        */
        default:
          return isNonPotentiallyTrustWorthy ? "no-referrer" : referrerOrigin;
      }
    }
    function stripURLForReferrer(url, originOnly) {
      return assert(url instanceof URL), url = new URL(url), url.protocol === "file:" || url.protocol === "about:" || url.protocol === "blank:" ? "no-referrer" : (url.username = "", url.password = "", url.hash = "", originOnly && (url.pathname = "", url.search = ""), url);
    }
    function isURLPotentiallyTrustworthy(url) {
      if (!(url instanceof URL))
        return !1;
      if (url.href === "about:blank" || url.href === "about:srcdoc" || url.protocol === "data:" || url.protocol === "file:") return !0;
      return isOriginPotentiallyTrustworthy(url.origin);
      function isOriginPotentiallyTrustworthy(origin) {
        if (origin == null || origin === "null") return !1;
        let originAsURL = new URL(origin);
        return !!(originAsURL.protocol === "https:" || originAsURL.protocol === "wss:" || /^127(?:\.[0-9]+){0,2}\.[0-9]+$|^\[(?:0*:)*?:?0*1\]$/.test(originAsURL.hostname) || originAsURL.hostname === "localhost" || originAsURL.hostname.includes("localhost.") || originAsURL.hostname.endsWith(".localhost"));
      }
    }
    function bytesMatch(bytes, metadataList) {
      if (crypto2 === void 0)
        return !0;
      let parsedMetadata = parseMetadata(metadataList);
      if (parsedMetadata === "no metadata" || parsedMetadata.length === 0)
        return !0;
      let strongest = getStrongestMetadata(parsedMetadata), metadata = filterMetadataListByAlgorithm(parsedMetadata, strongest);
      for (let item of metadata) {
        let algorithm = item.algo, expectedValue = item.hash, actualValue = crypto2.createHash(algorithm).update(bytes).digest("base64");
        if (actualValue[actualValue.length - 1] === "=" && (actualValue[actualValue.length - 2] === "=" ? actualValue = actualValue.slice(0, -2) : actualValue = actualValue.slice(0, -1)), compareBase64Mixed(actualValue, expectedValue))
          return !0;
      }
      return !1;
    }
    var parseHashWithOptions = /(?<algo>sha256|sha384|sha512)-((?<hash>[A-Za-z0-9+/]+|[A-Za-z0-9_-]+)={0,2}(?:\s|$)( +[!-~]*)?)?/i;
    function parseMetadata(metadata) {
      let result = [], empty = !0;
      for (let token of metadata.split(" ")) {
        empty = !1;
        let parsedToken = parseHashWithOptions.exec(token);
        if (parsedToken === null || parsedToken.groups === void 0 || parsedToken.groups.algo === void 0)
          continue;
        let algorithm = parsedToken.groups.algo.toLowerCase();
        supportedHashes.includes(algorithm) && result.push(parsedToken.groups);
      }
      return empty === !0 ? "no metadata" : result;
    }
    function getStrongestMetadata(metadataList) {
      let algorithm = metadataList[0].algo;
      if (algorithm[3] === "5")
        return algorithm;
      for (let i = 1; i < metadataList.length; ++i) {
        let metadata = metadataList[i];
        if (metadata.algo[3] === "5") {
          algorithm = "sha512";
          break;
        } else {
          if (algorithm[3] === "3")
            continue;
          metadata.algo[3] === "3" && (algorithm = "sha384");
        }
      }
      return algorithm;
    }
    function filterMetadataListByAlgorithm(metadataList, algorithm) {
      if (metadataList.length === 1)
        return metadataList;
      let pos = 0;
      for (let i = 0; i < metadataList.length; ++i)
        metadataList[i].algo === algorithm && (metadataList[pos++] = metadataList[i]);
      return metadataList.length = pos, metadataList;
    }
    function compareBase64Mixed(actualValue, expectedValue) {
      if (actualValue.length !== expectedValue.length)
        return !1;
      for (let i = 0; i < actualValue.length; ++i)
        if (actualValue[i] !== expectedValue[i]) {
          if (actualValue[i] === "+" && expectedValue[i] === "-" || actualValue[i] === "/" && expectedValue[i] === "_")
            continue;
          return !1;
        }
      return !0;
    }
    function tryUpgradeRequestToAPotentiallyTrustworthyURL(request) {
    }
    function sameOrigin(A, B) {
      return A.origin === B.origin && A.origin === "null" || A.protocol === B.protocol && A.hostname === B.hostname && A.port === B.port;
    }
    function createDeferredPromise() {
      let res, rej;
      return { promise: new Promise((resolve2, reject) => {
        res = resolve2, rej = reject;
      }), resolve: res, reject: rej };
    }
    function isAborted(fetchParams) {
      return fetchParams.controller.state === "aborted";
    }
    function isCancelled(fetchParams) {
      return fetchParams.controller.state === "aborted" || fetchParams.controller.state === "terminated";
    }
    function normalizeMethod(method) {
      return normalizedMethodRecordsBase[method.toLowerCase()] ?? method;
    }
    function serializeJavascriptValueToJSONString(value) {
      let result = JSON.stringify(value);
      if (result === void 0)
        throw new TypeError("Value is not JSON serializable");
      return assert(typeof result == "string"), result;
    }
    var esIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
    function createIterator(name, kInternalIterator, keyIndex = 0, valueIndex = 1) {
      class FastIterableIterator {
        /** @type {any} */
        #target;
        /** @type {'key' | 'value' | 'key+value'} */
        #kind;
        /** @type {number} */
        #index;
        /**
         * @see https://webidl.spec.whatwg.org/#dfn-default-iterator-object
         * @param {unknown} target
         * @param {'key' | 'value' | 'key+value'} kind
         */
        constructor(target, kind) {
          this.#target = target, this.#kind = kind, this.#index = 0;
        }
        next() {
          if (typeof this != "object" || this === null || !(#target in this))
            throw new TypeError(
              `'next' called on an object that does not implement interface ${name} Iterator.`
            );
          let index = this.#index, values = this.#target[kInternalIterator], len = values.length;
          if (index >= len)
            return {
              value: void 0,
              done: !0
            };
          let { [keyIndex]: key, [valueIndex]: value } = values[index];
          this.#index = index + 1;
          let result;
          switch (this.#kind) {
            case "key":
              result = key;
              break;
            case "value":
              result = value;
              break;
            case "key+value":
              result = [key, value];
              break;
          }
          return {
            value: result,
            done: !1
          };
        }
      }
      return delete FastIterableIterator.prototype.constructor, Object.setPrototypeOf(FastIterableIterator.prototype, esIteratorPrototype), Object.defineProperties(FastIterableIterator.prototype, {
        [Symbol.toStringTag]: {
          writable: !1,
          enumerable: !1,
          configurable: !0,
          value: `${name} Iterator`
        },
        next: { writable: !0, enumerable: !0, configurable: !0 }
      }), function(target, kind) {
        return new FastIterableIterator(target, kind);
      };
    }
    function iteratorMixin(name, object, kInternalIterator, keyIndex = 0, valueIndex = 1) {
      let makeIterator = createIterator(name, kInternalIterator, keyIndex, valueIndex), properties = {
        keys: {
          writable: !0,
          enumerable: !0,
          configurable: !0,
          value: function() {
            return webidl.brandCheck(this, object), makeIterator(this, "key");
          }
        },
        values: {
          writable: !0,
          enumerable: !0,
          configurable: !0,
          value: function() {
            return webidl.brandCheck(this, object), makeIterator(this, "value");
          }
        },
        entries: {
          writable: !0,
          enumerable: !0,
          configurable: !0,
          value: function() {
            return webidl.brandCheck(this, object), makeIterator(this, "key+value");
          }
        },
        forEach: {
          writable: !0,
          enumerable: !0,
          configurable: !0,
          value: function(callbackfn, thisArg = globalThis) {
            if (webidl.brandCheck(this, object), webidl.argumentLengthCheck(arguments, 1, `${name}.forEach`), typeof callbackfn != "function")
              throw new TypeError(
                `Failed to execute 'forEach' on '${name}': parameter 1 is not of type 'Function'.`
              );
            for (let { 0: key, 1: value } of makeIterator(this, "key+value"))
              callbackfn.call(thisArg, value, key, this);
          }
        }
      };
      return Object.defineProperties(object.prototype, {
        ...properties,
        [Symbol.iterator]: {
          writable: !0,
          enumerable: !1,
          configurable: !0,
          value: properties.entries.value
        }
      });
    }
    async function fullyReadBody(body, processBody, processBodyError) {
      let successSteps = processBody, errorSteps = processBodyError, reader;
      try {
        reader = body.stream.getReader();
      } catch (e) {
        errorSteps(e);
        return;
      }
      try {
        successSteps(await readAllBytes(reader));
      } catch (e) {
        errorSteps(e);
      }
    }
    function isReadableStreamLike(stream) {
      return stream instanceof ReadableStream || stream[Symbol.toStringTag] === "ReadableStream" && typeof stream.tee == "function";
    }
    function readableStreamClose(controller) {
      try {
        controller.close(), controller.byobRequest?.respond(0);
      } catch (err) {
        if (!err.message.includes("Controller is already closed") && !err.message.includes("ReadableStream is already closed"))
          throw err;
      }
    }
    var invalidIsomorphicEncodeValueRegex = /[^\x00-\xFF]/;
    function isomorphicEncode(input) {
      return assert(!invalidIsomorphicEncodeValueRegex.test(input)), input;
    }
    async function readAllBytes(reader) {
      let bytes = [], byteLength = 0;
      for (; ; ) {
        let { done, value: chunk } = await reader.read();
        if (done)
          return Buffer.concat(bytes, byteLength);
        if (!isUint8Array(chunk))
          throw new TypeError("Received non-Uint8Array chunk");
        bytes.push(chunk), byteLength += chunk.length;
      }
    }
    function urlIsLocal(url) {
      assert("protocol" in url);
      let protocol = url.protocol;
      return protocol === "about:" || protocol === "blob:" || protocol === "data:";
    }
    function urlHasHttpsScheme(url) {
      return typeof url == "string" && url[5] === ":" && url[0] === "h" && url[1] === "t" && url[2] === "t" && url[3] === "p" && url[4] === "s" || url.protocol === "https:";
    }
    function urlIsHttpHttpsScheme(url) {
      assert("protocol" in url);
      let protocol = url.protocol;
      return protocol === "http:" || protocol === "https:";
    }
    function simpleRangeHeaderValue(value, allowWhitespace) {
      let data = value;
      if (!data.startsWith("bytes"))
        return "failure";
      let position = { position: 5 };
      if (allowWhitespace && collectASequenceOfCodePoints(
        (char) => char === "	" || char === " ",
        data,
        position
      ), data.charCodeAt(position.position) !== 61)
        return "failure";
      position.position++, allowWhitespace && collectASequenceOfCodePoints(
        (char) => char === "	" || char === " ",
        data,
        position
      );
      let rangeStart = collectASequenceOfCodePoints(
        (char) => {
          let code = char.charCodeAt(0);
          return code >= 48 && code <= 57;
        },
        data,
        position
      ), rangeStartValue = rangeStart.length ? Number(rangeStart) : null;
      if (allowWhitespace && collectASequenceOfCodePoints(
        (char) => char === "	" || char === " ",
        data,
        position
      ), data.charCodeAt(position.position) !== 45)
        return "failure";
      position.position++, allowWhitespace && collectASequenceOfCodePoints(
        (char) => char === "	" || char === " ",
        data,
        position
      );
      let rangeEnd = collectASequenceOfCodePoints(
        (char) => {
          let code = char.charCodeAt(0);
          return code >= 48 && code <= 57;
        },
        data,
        position
      ), rangeEndValue = rangeEnd.length ? Number(rangeEnd) : null;
      return position.position < data.length || rangeEndValue === null && rangeStartValue === null || rangeStartValue > rangeEndValue ? "failure" : { rangeStartValue, rangeEndValue };
    }
    function buildContentRange(rangeStart, rangeEnd, fullLength) {
      let contentRange = "bytes ";
      return contentRange += isomorphicEncode(`${rangeStart}`), contentRange += "-", contentRange += isomorphicEncode(`${rangeEnd}`), contentRange += "/", contentRange += isomorphicEncode(`${fullLength}`), contentRange;
    }
    var InflateStream = class extends Transform {
      #zlibOptions;
      /** @param {zlib.ZlibOptions} [zlibOptions] */
      constructor(zlibOptions) {
        super(), this.#zlibOptions = zlibOptions;
      }
      _transform(chunk, encoding, callback) {
        if (!this._inflateStream) {
          if (chunk.length === 0) {
            callback();
            return;
          }
          this._inflateStream = (chunk[0] & 15) === 8 ? zlib.createInflate(this.#zlibOptions) : zlib.createInflateRaw(this.#zlibOptions), this._inflateStream.on("data", this.push.bind(this)), this._inflateStream.on("end", () => this.push(null)), this._inflateStream.on("error", (err) => this.destroy(err));
        }
        this._inflateStream.write(chunk, encoding, callback);
      }
      _final(callback) {
        this._inflateStream && (this._inflateStream.end(), this._inflateStream = null), callback();
      }
    };
    function createInflate(zlibOptions) {
      return new InflateStream(zlibOptions);
    }
    function extractMimeType(headers) {
      let charset = null, essence = null, mimeType = null, values = getDecodeSplit("content-type", headers);
      if (values === null)
        return "failure";
      for (let value of values) {
        let temporaryMimeType = parseMIMEType(value);
        temporaryMimeType === "failure" || temporaryMimeType.essence === "*/*" || (mimeType = temporaryMimeType, mimeType.essence !== essence ? (charset = null, mimeType.parameters.has("charset") && (charset = mimeType.parameters.get("charset")), essence = mimeType.essence) : !mimeType.parameters.has("charset") && charset !== null && mimeType.parameters.set("charset", charset));
      }
      return mimeType ?? "failure";
    }
    function gettingDecodingSplitting(value) {
      let input = value, position = { position: 0 }, values = [], temporaryValue = "";
      for (; position.position < input.length; ) {
        if (temporaryValue += collectASequenceOfCodePoints(
          (char) => char !== '"' && char !== ",",
          input,
          position
        ), position.position < input.length)
          if (input.charCodeAt(position.position) === 34) {
            if (temporaryValue += collectAnHTTPQuotedString(
              input,
              position
            ), position.position < input.length)
              continue;
          } else
            assert(input.charCodeAt(position.position) === 44), position.position++;
        temporaryValue = removeChars(temporaryValue, !0, !0, (char) => char === 9 || char === 32), values.push(temporaryValue), temporaryValue = "";
      }
      return values;
    }
    function getDecodeSplit(name, list) {
      let value = list.get(name, !0);
      return value === null ? null : gettingDecodingSplitting(value);
    }
    var textDecoder = new TextDecoder();
    function utf8DecodeBytes(buffer) {
      return buffer.length === 0 ? "" : (buffer[0] === 239 && buffer[1] === 187 && buffer[2] === 191 && (buffer = buffer.subarray(3)), textDecoder.decode(buffer));
    }
    var EnvironmentSettingsObjectBase = class {
      get baseUrl() {
        return getGlobalOrigin();
      }
      get origin() {
        return this.baseUrl?.origin;
      }
      policyContainer = makePolicyContainer();
    }, EnvironmentSettingsObject = class {
      settingsObject = new EnvironmentSettingsObjectBase();
    }, environmentSettingsObject = new EnvironmentSettingsObject();
    module.exports = {
      isAborted,
      isCancelled,
      isValidEncodedURL,
      createDeferredPromise,
      ReadableStreamFrom,
      tryUpgradeRequestToAPotentiallyTrustworthyURL,
      clampAndCoarsenConnectionTimingInfo,
      coarsenedSharedCurrentTime,
      determineRequestsReferrer,
      makePolicyContainer,
      clonePolicyContainer,
      appendFetchMetadata,
      appendRequestOriginHeader,
      TAOCheck,
      corsCheck,
      crossOriginResourcePolicyCheck,
      createOpaqueTimingInfo,
      setRequestReferrerPolicyOnRedirect,
      isValidHTTPToken,
      requestBadPort,
      requestCurrentURL,
      responseURL,
      responseLocationURL,
      isBlobLike,
      isURLPotentiallyTrustworthy,
      isValidReasonPhrase,
      sameOrigin,
      normalizeMethod,
      serializeJavascriptValueToJSONString,
      iteratorMixin,
      createIterator,
      isValidHeaderName,
      isValidHeaderValue,
      isErrorLike,
      fullyReadBody,
      bytesMatch,
      isReadableStreamLike,
      readableStreamClose,
      isomorphicEncode,
      urlIsLocal,
      urlHasHttpsScheme,
      urlIsHttpHttpsScheme,
      readAllBytes,
      simpleRangeHeaderValue,
      buildContentRange,
      parseMetadata,
      createInflate,
      extractMimeType,
      getDecodeSplit,
      utf8DecodeBytes,
      environmentSettingsObject
    };
  }
});

// node_modules/undici/lib/web/fetch/symbols.js
var require_symbols2 = __commonJS({
  "node_modules/undici/lib/web/fetch/symbols.js"(exports, module) {
    "use strict";
    module.exports = {
      kUrl: /* @__PURE__ */ Symbol("url"),
      kHeaders: /* @__PURE__ */ Symbol("headers"),
      kSignal: /* @__PURE__ */ Symbol("signal"),
      kState: /* @__PURE__ */ Symbol("state"),
      kDispatcher: /* @__PURE__ */ Symbol("dispatcher")
    };
  }
});

// node_modules/undici/lib/web/fetch/file.js
var require_file = __commonJS({
  "node_modules/undici/lib/web/fetch/file.js"(exports, module) {
    "use strict";
    var { Blob: Blob2, File } = __require("node:buffer"), { kState } = require_symbols2(), { webidl } = require_webidl(), FileLike = class _FileLike {
      constructor(blobLike, fileName, options = {}) {
        let n = fileName, t = options.type, d = options.lastModified ?? Date.now();
        this[kState] = {
          blobLike,
          name: n,
          type: t,
          lastModified: d
        };
      }
      stream(...args) {
        return webidl.brandCheck(this, _FileLike), this[kState].blobLike.stream(...args);
      }
      arrayBuffer(...args) {
        return webidl.brandCheck(this, _FileLike), this[kState].blobLike.arrayBuffer(...args);
      }
      slice(...args) {
        return webidl.brandCheck(this, _FileLike), this[kState].blobLike.slice(...args);
      }
      text(...args) {
        return webidl.brandCheck(this, _FileLike), this[kState].blobLike.text(...args);
      }
      get size() {
        return webidl.brandCheck(this, _FileLike), this[kState].blobLike.size;
      }
      get type() {
        return webidl.brandCheck(this, _FileLike), this[kState].blobLike.type;
      }
      get name() {
        return webidl.brandCheck(this, _FileLike), this[kState].name;
      }
      get lastModified() {
        return webidl.brandCheck(this, _FileLike), this[kState].lastModified;
      }
      get [Symbol.toStringTag]() {
        return "File";
      }
    };
    webidl.converters.Blob = webidl.interfaceConverter(Blob2);
    function isFileLike(object) {
      return object instanceof File || object && (typeof object.stream == "function" || typeof object.arrayBuffer == "function") && object[Symbol.toStringTag] === "File";
    }
    module.exports = { FileLike, isFileLike };
  }
});

// node_modules/undici/lib/web/fetch/formdata.js
var require_formdata = __commonJS({
  "node_modules/undici/lib/web/fetch/formdata.js"(exports, module) {
    "use strict";
    var { isBlobLike, iteratorMixin } = require_util2(), { kState } = require_symbols2(), { kEnumerableProperty } = require_util(), { FileLike, isFileLike } = require_file(), { webidl } = require_webidl(), { File: NativeFile } = __require("node:buffer"), nodeUtil = __require("node:util"), File = globalThis.File ?? NativeFile, FormData = class _FormData {
      constructor(form) {
        if (webidl.util.markAsUncloneable(this), form !== void 0)
          throw webidl.errors.conversionFailed({
            prefix: "FormData constructor",
            argument: "Argument 1",
            types: ["undefined"]
          });
        this[kState] = [];
      }
      append(name, value, filename = void 0) {
        webidl.brandCheck(this, _FormData);
        let prefix = "FormData.append";
        if (webidl.argumentLengthCheck(arguments, 2, prefix), arguments.length === 3 && !isBlobLike(value))
          throw new TypeError(
            "Failed to execute 'append' on 'FormData': parameter 2 is not of type 'Blob'"
          );
        name = webidl.converters.USVString(name, prefix, "name"), value = isBlobLike(value) ? webidl.converters.Blob(value, prefix, "value", { strict: !1 }) : webidl.converters.USVString(value, prefix, "value"), filename = arguments.length === 3 ? webidl.converters.USVString(filename, prefix, "filename") : void 0;
        let entry = makeEntry(name, value, filename);
        this[kState].push(entry);
      }
      delete(name) {
        webidl.brandCheck(this, _FormData);
        let prefix = "FormData.delete";
        webidl.argumentLengthCheck(arguments, 1, prefix), name = webidl.converters.USVString(name, prefix, "name"), this[kState] = this[kState].filter((entry) => entry.name !== name);
      }
      get(name) {
        webidl.brandCheck(this, _FormData);
        let prefix = "FormData.get";
        webidl.argumentLengthCheck(arguments, 1, prefix), name = webidl.converters.USVString(name, prefix, "name");
        let idx = this[kState].findIndex((entry) => entry.name === name);
        return idx === -1 ? null : this[kState][idx].value;
      }
      getAll(name) {
        webidl.brandCheck(this, _FormData);
        let prefix = "FormData.getAll";
        return webidl.argumentLengthCheck(arguments, 1, prefix), name = webidl.converters.USVString(name, prefix, "name"), this[kState].filter((entry) => entry.name === name).map((entry) => entry.value);
      }
      has(name) {
        webidl.brandCheck(this, _FormData);
        let prefix = "FormData.has";
        return webidl.argumentLengthCheck(arguments, 1, prefix), name = webidl.converters.USVString(name, prefix, "name"), this[kState].findIndex((entry) => entry.name === name) !== -1;
      }
      set(name, value, filename = void 0) {
        webidl.brandCheck(this, _FormData);
        let prefix = "FormData.set";
        if (webidl.argumentLengthCheck(arguments, 2, prefix), arguments.length === 3 && !isBlobLike(value))
          throw new TypeError(
            "Failed to execute 'set' on 'FormData': parameter 2 is not of type 'Blob'"
          );
        name = webidl.converters.USVString(name, prefix, "name"), value = isBlobLike(value) ? webidl.converters.Blob(value, prefix, "name", { strict: !1 }) : webidl.converters.USVString(value, prefix, "name"), filename = arguments.length === 3 ? webidl.converters.USVString(filename, prefix, "name") : void 0;
        let entry = makeEntry(name, value, filename), idx = this[kState].findIndex((entry2) => entry2.name === name);
        idx !== -1 ? this[kState] = [
          ...this[kState].slice(0, idx),
          entry,
          ...this[kState].slice(idx + 1).filter((entry2) => entry2.name !== name)
        ] : this[kState].push(entry);
      }
      [nodeUtil.inspect.custom](depth, options) {
        let state = this[kState].reduce((a, b) => (a[b.name] ? Array.isArray(a[b.name]) ? a[b.name].push(b.value) : a[b.name] = [a[b.name], b.value] : a[b.name] = b.value, a), { __proto__: null });
        options.depth ??= depth, options.colors ??= !0;
        let output = nodeUtil.formatWithOptions(options, state);
        return `FormData ${output.slice(output.indexOf("]") + 2)}`;
      }
    };
    iteratorMixin("FormData", FormData, kState, "name", "value");
    Object.defineProperties(FormData.prototype, {
      append: kEnumerableProperty,
      delete: kEnumerableProperty,
      get: kEnumerableProperty,
      getAll: kEnumerableProperty,
      has: kEnumerableProperty,
      set: kEnumerableProperty,
      [Symbol.toStringTag]: {
        value: "FormData",
        configurable: !0
      }
    });
    function makeEntry(name, value, filename) {
      if (typeof value != "string") {
        if (isFileLike(value) || (value = value instanceof Blob ? new File([value], "blob", { type: value.type }) : new FileLike(value, "blob", { type: value.type })), filename !== void 0) {
          let options = {
            type: value.type,
            lastModified: value.lastModified
          };
          value = value instanceof NativeFile ? new File([value], filename, options) : new FileLike(value, filename, options);
        }
      }
      return { name, value };
    }
    module.exports = { FormData, makeEntry };
  }
});

// node_modules/undici/lib/web/fetch/formdata-parser.js
var require_formdata_parser = __commonJS({
  "node_modules/undici/lib/web/fetch/formdata-parser.js"(exports, module) {
    "use strict";
    var { isUSVString, bufferToLowerCasedHeaderName } = require_util(), { utf8DecodeBytes } = require_util2(), { HTTP_TOKEN_CODEPOINTS, isomorphicDecode } = require_data_url(), { isFileLike } = require_file(), { makeEntry } = require_formdata(), assert = __require("node:assert"), { File: NodeFile } = __require("node:buffer"), File = globalThis.File ?? NodeFile, formDataNameBuffer = Buffer.from('form-data; name="'), filenameBuffer = Buffer.from("; filename"), dd = Buffer.from("--"), ddcrlf = Buffer.from(`--\r
`);
    function isAsciiString(chars) {
      for (let i = 0; i < chars.length; ++i)
        if ((chars.charCodeAt(i) & -128) !== 0)
          return !1;
      return !0;
    }
    function validateBoundary(boundary) {
      let length = boundary.length;
      if (length < 27 || length > 70)
        return !1;
      for (let i = 0; i < length; ++i) {
        let cp = boundary.charCodeAt(i);
        if (!(cp >= 48 && cp <= 57 || cp >= 65 && cp <= 90 || cp >= 97 && cp <= 122 || cp === 39 || cp === 45 || cp === 95))
          return !1;
      }
      return !0;
    }
    function multipartFormDataParser(input, mimeType) {
      assert(mimeType !== "failure" && mimeType.essence === "multipart/form-data");
      let boundaryString = mimeType.parameters.get("boundary");
      if (boundaryString === void 0)
        return "failure";
      let boundary = Buffer.from(`--${boundaryString}`, "utf8"), entryList = [], position = { position: 0 };
      for (; input[position.position] === 13 && input[position.position + 1] === 10; )
        position.position += 2;
      let trailing = input.length;
      for (; input[trailing - 1] === 10 && input[trailing - 2] === 13; )
        trailing -= 2;
      for (trailing !== input.length && (input = input.subarray(0, trailing)); ; ) {
        if (input.subarray(position.position, position.position + boundary.length).equals(boundary))
          position.position += boundary.length;
        else
          return "failure";
        if (position.position === input.length - 2 && bufferStartsWith(input, dd, position) || position.position === input.length - 4 && bufferStartsWith(input, ddcrlf, position))
          return entryList;
        if (input[position.position] !== 13 || input[position.position + 1] !== 10)
          return "failure";
        position.position += 2;
        let result = parseMultipartFormDataHeaders(input, position);
        if (result === "failure")
          return "failure";
        let { name, filename, contentType, encoding } = result;
        position.position += 2;
        let body;
        {
          let boundaryIndex = input.indexOf(boundary.subarray(2), position.position);
          if (boundaryIndex === -1)
            return "failure";
          body = input.subarray(position.position, boundaryIndex - 4), position.position += body.length, encoding === "base64" && (body = Buffer.from(body.toString(), "base64"));
        }
        if (input[position.position] !== 13 || input[position.position + 1] !== 10)
          return "failure";
        position.position += 2;
        let value;
        filename !== null ? (contentType ??= "text/plain", isAsciiString(contentType) || (contentType = ""), value = new File([body], filename, { type: contentType })) : value = utf8DecodeBytes(Buffer.from(body)), assert(isUSVString(name)), assert(typeof value == "string" && isUSVString(value) || isFileLike(value)), entryList.push(makeEntry(name, value, filename));
      }
    }
    function parseMultipartFormDataHeaders(input, position) {
      let name = null, filename = null, contentType = null, encoding = null;
      for (; ; ) {
        if (input[position.position] === 13 && input[position.position + 1] === 10)
          return name === null ? "failure" : { name, filename, contentType, encoding };
        let headerName = collectASequenceOfBytes(
          (char) => char !== 10 && char !== 13 && char !== 58,
          input,
          position
        );
        if (headerName = removeChars(headerName, !0, !0, (char) => char === 9 || char === 32), !HTTP_TOKEN_CODEPOINTS.test(headerName.toString()) || input[position.position] !== 58)
          return "failure";
        switch (position.position++, collectASequenceOfBytes(
          (char) => char === 32 || char === 9,
          input,
          position
        ), bufferToLowerCasedHeaderName(headerName)) {
          case "content-disposition": {
            if (name = filename = null, !bufferStartsWith(input, formDataNameBuffer, position) || (position.position += 17, name = parseMultipartFormDataName(input, position), name === null))
              return "failure";
            if (bufferStartsWith(input, filenameBuffer, position)) {
              let check = position.position + filenameBuffer.length;
              if (input[check] === 42 && (position.position += 1, check += 1), input[check] !== 61 || input[check + 1] !== 34 || (position.position += 12, filename = parseMultipartFormDataName(input, position), filename === null))
                return "failure";
            }
            break;
          }
          case "content-type": {
            let headerValue = collectASequenceOfBytes(
              (char) => char !== 10 && char !== 13,
              input,
              position
            );
            headerValue = removeChars(headerValue, !1, !0, (char) => char === 9 || char === 32), contentType = isomorphicDecode(headerValue);
            break;
          }
          case "content-transfer-encoding": {
            let headerValue = collectASequenceOfBytes(
              (char) => char !== 10 && char !== 13,
              input,
              position
            );
            headerValue = removeChars(headerValue, !1, !0, (char) => char === 9 || char === 32), encoding = isomorphicDecode(headerValue);
            break;
          }
          default:
            collectASequenceOfBytes(
              (char) => char !== 10 && char !== 13,
              input,
              position
            );
        }
        if (input[position.position] !== 13 && input[position.position + 1] !== 10)
          return "failure";
        position.position += 2;
      }
    }
    function parseMultipartFormDataName(input, position) {
      assert(input[position.position - 1] === 34);
      let name = collectASequenceOfBytes(
        (char) => char !== 10 && char !== 13 && char !== 34,
        input,
        position
      );
      return input[position.position] !== 34 ? null : (position.position++, name = new TextDecoder().decode(name).replace(/%0A/ig, `
`).replace(/%0D/ig, "\r").replace(/%22/g, '"'), name);
    }
    function collectASequenceOfBytes(condition, input, position) {
      let start = position.position;
      for (; start < input.length && condition(input[start]); )
        ++start;
      return input.subarray(position.position, position.position = start);
    }
    function removeChars(buf, leading, trailing, predicate) {
      let lead = 0, trail = buf.length - 1;
      if (leading)
        for (; lead < buf.length && predicate(buf[lead]); ) lead++;
      if (trailing)
        for (; trail > 0 && predicate(buf[trail]); ) trail--;
      return lead === 0 && trail === buf.length - 1 ? buf : buf.subarray(lead, trail + 1);
    }
    function bufferStartsWith(buffer, start, position) {
      if (buffer.length < start.length)
        return !1;
      for (let i = 0; i < start.length; i++)
        if (start[i] !== buffer[position.position + i])
          return !1;
      return !0;
    }
    module.exports = {
      multipartFormDataParser,
      validateBoundary
    };
  }
});

// node_modules/undici/lib/web/fetch/body.js
var require_body = __commonJS({
  "node_modules/undici/lib/web/fetch/body.js"(exports, module) {
    "use strict";
    var util = require_util(), {
      ReadableStreamFrom,
      isBlobLike,
      isReadableStreamLike,
      readableStreamClose,
      createDeferredPromise,
      fullyReadBody,
      extractMimeType,
      utf8DecodeBytes
    } = require_util2(), { FormData } = require_formdata(), { kState } = require_symbols2(), { webidl } = require_webidl(), { Blob: Blob2 } = __require("node:buffer"), assert = __require("node:assert"), { isErrored, isDisturbed } = __require("node:stream"), { isArrayBuffer } = __require("node:util/types"), { serializeAMimeType } = require_data_url(), { multipartFormDataParser } = require_formdata_parser(), random;
    try {
      let crypto2 = __require("node:crypto");
      random = (max) => crypto2.randomInt(0, max);
    } catch {
      random = (max) => Math.floor(Math.random(max));
    }
    var textEncoder = new TextEncoder();
    function noop() {
    }
    var hasFinalizationRegistry = globalThis.FinalizationRegistry && process.version.indexOf("v18") !== 0, streamRegistry;
    hasFinalizationRegistry && (streamRegistry = new FinalizationRegistry((weakRef) => {
      let stream = weakRef.deref();
      stream && !stream.locked && !isDisturbed(stream) && !isErrored(stream) && stream.cancel("Response object has been garbage collected").catch(noop);
    }));
    function extractBody(object, keepalive = !1) {
      let stream = null;
      object instanceof ReadableStream ? stream = object : isBlobLike(object) ? stream = object.stream() : stream = new ReadableStream({
        async pull(controller) {
          let buffer = typeof source == "string" ? textEncoder.encode(source) : source;
          buffer.byteLength && controller.enqueue(buffer), queueMicrotask(() => readableStreamClose(controller));
        },
        start() {
        },
        type: "bytes"
      }), assert(isReadableStreamLike(stream));
      let action = null, source = null, length = null, type = null;
      if (typeof object == "string")
        source = object, type = "text/plain;charset=UTF-8";
      else if (object instanceof URLSearchParams)
        source = object.toString(), type = "application/x-www-form-urlencoded;charset=UTF-8";
      else if (isArrayBuffer(object))
        source = new Uint8Array(object.slice());
      else if (ArrayBuffer.isView(object))
        source = new Uint8Array(object.buffer.slice(object.byteOffset, object.byteOffset + object.byteLength));
      else if (util.isFormDataLike(object)) {
        let boundary = `----formdata-undici-0${`${random(1e11)}`.padStart(11, "0")}`, prefix = `--${boundary}\r
Content-Disposition: form-data`;
        /*! formdata-polyfill. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */
        let escape = (str) => str.replace(/\n/g, "%0A").replace(/\r/g, "%0D").replace(/"/g, "%22"), normalizeLinefeeds = (value) => value.replace(/\r?\n|\r/g, `\r
`), blobParts = [], rn = new Uint8Array([13, 10]);
        length = 0;
        let hasUnknownSizeValue = !1;
        for (let [name, value] of object)
          if (typeof value == "string") {
            let chunk2 = textEncoder.encode(prefix + `; name="${escape(normalizeLinefeeds(name))}"\r
\r
${normalizeLinefeeds(value)}\r
`);
            blobParts.push(chunk2), length += chunk2.byteLength;
          } else {
            let chunk2 = textEncoder.encode(`${prefix}; name="${escape(normalizeLinefeeds(name))}"` + (value.name ? `; filename="${escape(value.name)}"` : "") + `\r
Content-Type: ${value.type || "application/octet-stream"}\r
\r
`);
            blobParts.push(chunk2, value, rn), typeof value.size == "number" ? length += chunk2.byteLength + value.size + rn.byteLength : hasUnknownSizeValue = !0;
          }
        let chunk = textEncoder.encode(`--${boundary}--\r
`);
        blobParts.push(chunk), length += chunk.byteLength, hasUnknownSizeValue && (length = null), source = object, action = async function* () {
          for (let part of blobParts)
            part.stream ? yield* part.stream() : yield part;
        }, type = `multipart/form-data; boundary=${boundary}`;
      } else if (isBlobLike(object))
        source = object, length = object.size, object.type && (type = object.type);
      else if (typeof object[Symbol.asyncIterator] == "function") {
        if (keepalive)
          throw new TypeError("keepalive");
        if (util.isDisturbed(object) || object.locked)
          throw new TypeError(
            "Response body object should not be disturbed or locked"
          );
        stream = object instanceof ReadableStream ? object : ReadableStreamFrom(object);
      }
      if ((typeof source == "string" || util.isBuffer(source)) && (length = Buffer.byteLength(source)), action != null) {
        let iterator;
        stream = new ReadableStream({
          async start() {
            iterator = action(object)[Symbol.asyncIterator]();
          },
          async pull(controller) {
            let { value, done } = await iterator.next();
            if (done)
              queueMicrotask(() => {
                controller.close(), controller.byobRequest?.respond(0);
              });
            else if (!isErrored(stream)) {
              let buffer = new Uint8Array(value);
              buffer.byteLength && controller.enqueue(buffer);
            }
            return controller.desiredSize > 0;
          },
          async cancel(reason) {
            await iterator.return();
          },
          type: "bytes"
        });
      }
      return [{ stream, source, length }, type];
    }
    function safelyExtractBody(object, keepalive = !1) {
      return object instanceof ReadableStream && (assert(!util.isDisturbed(object), "The body has already been consumed."), assert(!object.locked, "The stream is locked.")), extractBody(object, keepalive);
    }
    function cloneBody(instance, body) {
      let [out1, out2] = body.stream.tee();
      return body.stream = out1, {
        stream: out2,
        length: body.length,
        source: body.source
      };
    }
    function throwIfAborted(state) {
      if (state.aborted)
        throw new DOMException("The operation was aborted.", "AbortError");
    }
    function bodyMixinMethods(instance) {
      return {
        blob() {
          return consumeBody(this, (bytes) => {
            let mimeType = bodyMimeType(this);
            return mimeType === null ? mimeType = "" : mimeType && (mimeType = serializeAMimeType(mimeType)), new Blob2([bytes], { type: mimeType });
          }, instance);
        },
        arrayBuffer() {
          return consumeBody(this, (bytes) => new Uint8Array(bytes).buffer, instance);
        },
        text() {
          return consumeBody(this, utf8DecodeBytes, instance);
        },
        json() {
          return consumeBody(this, parseJSONFromBytes, instance);
        },
        formData() {
          return consumeBody(this, (value) => {
            let mimeType = bodyMimeType(this);
            if (mimeType !== null)
              switch (mimeType.essence) {
                case "multipart/form-data": {
                  let parsed = multipartFormDataParser(value, mimeType);
                  if (parsed === "failure")
                    throw new TypeError("Failed to parse body as FormData.");
                  let fd = new FormData();
                  return fd[kState] = parsed, fd;
                }
                case "application/x-www-form-urlencoded": {
                  let entries = new URLSearchParams(value.toString()), fd = new FormData();
                  for (let [name, value2] of entries)
                    fd.append(name, value2);
                  return fd;
                }
              }
            throw new TypeError(
              'Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded".'
            );
          }, instance);
        },
        bytes() {
          return consumeBody(this, (bytes) => new Uint8Array(bytes), instance);
        }
      };
    }
    function mixinBody(prototype) {
      Object.assign(prototype.prototype, bodyMixinMethods(prototype));
    }
    async function consumeBody(object, convertBytesToJSValue, instance) {
      if (webidl.brandCheck(object, instance), bodyUnusable(object))
        throw new TypeError("Body is unusable: Body has already been read");
      throwIfAborted(object[kState]);
      let promise = createDeferredPromise(), errorSteps = (error2) => promise.reject(error2), successSteps = (data) => {
        try {
          promise.resolve(convertBytesToJSValue(data));
        } catch (e) {
          errorSteps(e);
        }
      };
      return object[kState].body == null ? (successSteps(Buffer.allocUnsafe(0)), promise.promise) : (await fullyReadBody(object[kState].body, successSteps, errorSteps), promise.promise);
    }
    function bodyUnusable(object) {
      let body = object[kState].body;
      return body != null && (body.stream.locked || util.isDisturbed(body.stream));
    }
    function parseJSONFromBytes(bytes) {
      return JSON.parse(utf8DecodeBytes(bytes));
    }
    function bodyMimeType(requestOrResponse) {
      let headers = requestOrResponse[kState].headersList, mimeType = extractMimeType(headers);
      return mimeType === "failure" ? null : mimeType;
    }
    module.exports = {
      extractBody,
      safelyExtractBody,
      cloneBody,
      mixinBody,
      streamRegistry,
      hasFinalizationRegistry,
      bodyUnusable
    };
  }
});

// node_modules/undici/lib/dispatcher/client-h1.js
var require_client_h1 = __commonJS({
  "node_modules/undici/lib/dispatcher/client-h1.js"(exports, module) {
    "use strict";
    var assert = __require("node:assert"), util = require_util(), { channels } = require_diagnostics(), timers = require_timers(), {
      RequestContentLengthMismatchError,
      ResponseContentLengthMismatchError,
      RequestAbortedError,
      HeadersTimeoutError,
      HeadersOverflowError,
      SocketError,
      InformationalError,
      BodyTimeoutError,
      HTTPParserError,
      ResponseExceededMaxSizeError
    } = require_errors(), {
      kUrl,
      kReset,
      kClient,
      kParser,
      kBlocking,
      kRunning,
      kPending,
      kSize,
      kWriting,
      kQueue,
      kNoRef,
      kKeepAliveDefaultTimeout,
      kHostHeader,
      kPendingIdx,
      kRunningIdx,
      kError,
      kPipelining,
      kSocket,
      kKeepAliveTimeoutValue,
      kMaxHeadersSize,
      kKeepAliveMaxTimeout,
      kKeepAliveTimeoutThreshold,
      kHeadersTimeout,
      kBodyTimeout,
      kStrictContentLength,
      kMaxRequests,
      kCounter,
      kMaxResponseSize,
      kOnError,
      kResume,
      kHTTPContext
    } = require_symbols(), constants3 = require_constants2(), EMPTY_BUF = Buffer.alloc(0), FastBuffer = Buffer[Symbol.species], addListener = util.addListener, removeAllListeners = util.removeAllListeners, extractBody;
    async function lazyllhttp() {
      let llhttpWasmData = process.env.JEST_WORKER_ID ? require_llhttp_wasm() : void 0, mod;
      try {
        mod = await WebAssembly.compile(require_llhttp_simd_wasm());
      } catch {
        mod = await WebAssembly.compile(llhttpWasmData || require_llhttp_wasm());
      }
      return await WebAssembly.instantiate(mod, {
        env: {
          /* eslint-disable camelcase */
          wasm_on_url: (p, at, len) => 0,
          wasm_on_status: (p, at, len) => {
            assert(currentParser.ptr === p);
            let start = at - currentBufferPtr + currentBufferRef.byteOffset;
            return currentParser.onStatus(new FastBuffer(currentBufferRef.buffer, start, len)) || 0;
          },
          wasm_on_message_begin: (p) => (assert(currentParser.ptr === p), currentParser.onMessageBegin() || 0),
          wasm_on_header_field: (p, at, len) => {
            assert(currentParser.ptr === p);
            let start = at - currentBufferPtr + currentBufferRef.byteOffset;
            return currentParser.onHeaderField(new FastBuffer(currentBufferRef.buffer, start, len)) || 0;
          },
          wasm_on_header_value: (p, at, len) => {
            assert(currentParser.ptr === p);
            let start = at - currentBufferPtr + currentBufferRef.byteOffset;
            return currentParser.onHeaderValue(new FastBuffer(currentBufferRef.buffer, start, len)) || 0;
          },
          wasm_on_headers_complete: (p, statusCode, upgrade, shouldKeepAlive) => (assert(currentParser.ptr === p), currentParser.onHeadersComplete(statusCode, !!upgrade, !!shouldKeepAlive) || 0),
          wasm_on_body: (p, at, len) => {
            assert(currentParser.ptr === p);
            let start = at - currentBufferPtr + currentBufferRef.byteOffset;
            return currentParser.onBody(new FastBuffer(currentBufferRef.buffer, start, len)) || 0;
          },
          wasm_on_message_complete: (p) => (assert(currentParser.ptr === p), currentParser.onMessageComplete() || 0)
          /* eslint-enable camelcase */
        }
      });
    }
    var llhttpInstance = null, llhttpPromise = lazyllhttp();
    llhttpPromise.catch();
    var currentParser = null, currentBufferRef = null, currentBufferSize = 0, currentBufferPtr = null, USE_NATIVE_TIMER = 0, USE_FAST_TIMER = 1, TIMEOUT_HEADERS = 2 | USE_FAST_TIMER, TIMEOUT_BODY = 4 | USE_FAST_TIMER, TIMEOUT_KEEP_ALIVE = 8 | USE_NATIVE_TIMER, Parser = class {
      constructor(client, socket, { exports: exports2 }) {
        assert(Number.isFinite(client[kMaxHeadersSize]) && client[kMaxHeadersSize] > 0), this.llhttp = exports2, this.ptr = this.llhttp.llhttp_alloc(constants3.TYPE.RESPONSE), this.client = client, this.socket = socket, this.timeout = null, this.timeoutValue = null, this.timeoutType = null, this.statusCode = null, this.statusText = "", this.upgrade = !1, this.headers = [], this.headersSize = 0, this.headersMaxSize = client[kMaxHeadersSize], this.shouldKeepAlive = !1, this.paused = !1, this.resume = this.resume.bind(this), this.bytesRead = 0, this.keepAlive = "", this.contentLength = "", this.connection = "", this.maxResponseSize = client[kMaxResponseSize];
      }
      setTimeout(delay, type) {
        delay !== this.timeoutValue || type & USE_FAST_TIMER ^ this.timeoutType & USE_FAST_TIMER ? (this.timeout && (timers.clearTimeout(this.timeout), this.timeout = null), delay && (type & USE_FAST_TIMER ? this.timeout = timers.setFastTimeout(onParserTimeout, delay, new WeakRef(this)) : (this.timeout = setTimeout(onParserTimeout, delay, new WeakRef(this)), this.timeout.unref())), this.timeoutValue = delay) : this.timeout && this.timeout.refresh && this.timeout.refresh(), this.timeoutType = type;
      }
      resume() {
        this.socket.destroyed || !this.paused || (assert(this.ptr != null), assert(currentParser == null), this.llhttp.llhttp_resume(this.ptr), assert(this.timeoutType === TIMEOUT_BODY), this.timeout && this.timeout.refresh && this.timeout.refresh(), this.paused = !1, this.execute(this.socket.read() || EMPTY_BUF), this.readMore());
      }
      readMore() {
        for (; !this.paused && this.ptr; ) {
          let chunk = this.socket.read();
          if (chunk === null)
            break;
          this.execute(chunk);
        }
      }
      execute(data) {
        assert(this.ptr != null), assert(currentParser == null), assert(!this.paused);
        let { socket, llhttp } = this;
        data.length > currentBufferSize && (currentBufferPtr && llhttp.free(currentBufferPtr), currentBufferSize = Math.ceil(data.length / 4096) * 4096, currentBufferPtr = llhttp.malloc(currentBufferSize)), new Uint8Array(llhttp.memory.buffer, currentBufferPtr, currentBufferSize).set(data);
        try {
          let ret;
          try {
            currentBufferRef = data, currentParser = this, ret = llhttp.llhttp_execute(this.ptr, currentBufferPtr, data.length);
          } catch (err) {
            throw err;
          } finally {
            currentParser = null, currentBufferRef = null;
          }
          let offset = llhttp.llhttp_get_error_pos(this.ptr) - currentBufferPtr;
          if (ret === constants3.ERROR.PAUSED_UPGRADE)
            this.onUpgrade(data.slice(offset));
          else if (ret === constants3.ERROR.PAUSED)
            this.paused = !0, socket.unshift(data.slice(offset));
          else if (ret !== constants3.ERROR.OK) {
            let ptr = llhttp.llhttp_get_error_reason(this.ptr), message = "";
            if (ptr) {
              let len = new Uint8Array(llhttp.memory.buffer, ptr).indexOf(0);
              message = "Response does not match the HTTP/1.1 protocol (" + Buffer.from(llhttp.memory.buffer, ptr, len).toString() + ")";
            }
            throw new HTTPParserError(message, constants3.ERROR[ret], data.slice(offset));
          }
        } catch (err) {
          util.destroy(socket, err);
        }
      }
      destroy() {
        assert(this.ptr != null), assert(currentParser == null), this.llhttp.llhttp_free(this.ptr), this.ptr = null, this.timeout && timers.clearTimeout(this.timeout), this.timeout = null, this.timeoutValue = null, this.timeoutType = null, this.paused = !1;
      }
      onStatus(buf) {
        this.statusText = buf.toString();
      }
      onMessageBegin() {
        let { socket, client } = this;
        if (socket.destroyed)
          return -1;
        let request = client[kQueue][client[kRunningIdx]];
        if (!request)
          return -1;
        request.onResponseStarted();
      }
      onHeaderField(buf) {
        let len = this.headers.length;
        (len & 1) === 0 ? this.headers.push(buf) : this.headers[len - 1] = Buffer.concat([this.headers[len - 1], buf]), this.trackHeader(buf.length);
      }
      onHeaderValue(buf) {
        let len = this.headers.length;
        (len & 1) === 1 ? (this.headers.push(buf), len += 1) : this.headers[len - 1] = Buffer.concat([this.headers[len - 1], buf]);
        let key = this.headers[len - 2];
        if (key.length === 10) {
          let headerName = util.bufferToLowerCasedHeaderName(key);
          headerName === "keep-alive" ? this.keepAlive += buf.toString() : headerName === "connection" && (this.connection += buf.toString());
        } else key.length === 14 && util.bufferToLowerCasedHeaderName(key) === "content-length" && (this.contentLength += buf.toString());
        this.trackHeader(buf.length);
      }
      trackHeader(len) {
        this.headersSize += len, this.headersSize >= this.headersMaxSize && util.destroy(this.socket, new HeadersOverflowError());
      }
      onUpgrade(head) {
        let { upgrade, client, socket, headers, statusCode } = this;
        assert(upgrade), assert(client[kSocket] === socket), assert(!socket.destroyed), assert(!this.paused), assert((headers.length & 1) === 0);
        let request = client[kQueue][client[kRunningIdx]];
        assert(request), assert(request.upgrade || request.method === "CONNECT"), this.statusCode = null, this.statusText = "", this.shouldKeepAlive = null, this.headers = [], this.headersSize = 0, socket.unshift(head), socket[kParser].destroy(), socket[kParser] = null, socket[kClient] = null, socket[kError] = null, removeAllListeners(socket), client[kSocket] = null, client[kHTTPContext] = null, client[kQueue][client[kRunningIdx]++] = null, client.emit("disconnect", client[kUrl], [client], new InformationalError("upgrade"));
        try {
          request.onUpgrade(statusCode, headers, socket);
        } catch (err) {
          util.destroy(socket, err);
        }
        client[kResume]();
      }
      onHeadersComplete(statusCode, upgrade, shouldKeepAlive) {
        let { client, socket, headers, statusText } = this;
        if (socket.destroyed)
          return -1;
        let request = client[kQueue][client[kRunningIdx]];
        if (!request)
          return -1;
        if (assert(!this.upgrade), assert(this.statusCode < 200), statusCode === 100)
          return util.destroy(socket, new SocketError("bad response", util.getSocketInfo(socket))), -1;
        if (upgrade && !request.upgrade)
          return util.destroy(socket, new SocketError("bad upgrade", util.getSocketInfo(socket))), -1;
        if (assert(this.timeoutType === TIMEOUT_HEADERS), this.statusCode = statusCode, this.shouldKeepAlive = shouldKeepAlive || // Override llhttp value which does not allow keepAlive for HEAD.
        request.method === "HEAD" && !socket[kReset] && this.connection.toLowerCase() === "keep-alive", this.statusCode >= 200) {
          let bodyTimeout = request.bodyTimeout != null ? request.bodyTimeout : client[kBodyTimeout];
          this.setTimeout(bodyTimeout, TIMEOUT_BODY);
        } else this.timeout && this.timeout.refresh && this.timeout.refresh();
        if (request.method === "CONNECT")
          return assert(client[kRunning] === 1), this.upgrade = !0, 2;
        if (upgrade)
          return assert(client[kRunning] === 1), this.upgrade = !0, 2;
        if (assert((this.headers.length & 1) === 0), this.headers = [], this.headersSize = 0, this.shouldKeepAlive && client[kPipelining]) {
          let keepAliveTimeout = this.keepAlive ? util.parseKeepAliveTimeout(this.keepAlive) : null;
          if (keepAliveTimeout != null) {
            let timeout = Math.min(
              keepAliveTimeout - client[kKeepAliveTimeoutThreshold],
              client[kKeepAliveMaxTimeout]
            );
            timeout <= 0 ? socket[kReset] = !0 : client[kKeepAliveTimeoutValue] = timeout;
          } else
            client[kKeepAliveTimeoutValue] = client[kKeepAliveDefaultTimeout];
        } else
          socket[kReset] = !0;
        let pause = request.onHeaders(statusCode, headers, this.resume, statusText) === !1;
        return request.aborted ? -1 : request.method === "HEAD" || statusCode < 200 ? 1 : (socket[kBlocking] && (socket[kBlocking] = !1, client[kResume]()), pause ? constants3.ERROR.PAUSED : 0);
      }
      onBody(buf) {
        let { client, socket, statusCode, maxResponseSize } = this;
        if (socket.destroyed)
          return -1;
        let request = client[kQueue][client[kRunningIdx]];
        if (assert(request), assert(this.timeoutType === TIMEOUT_BODY), this.timeout && this.timeout.refresh && this.timeout.refresh(), assert(statusCode >= 200), maxResponseSize > -1 && this.bytesRead + buf.length > maxResponseSize)
          return util.destroy(socket, new ResponseExceededMaxSizeError()), -1;
        if (this.bytesRead += buf.length, request.onData(buf) === !1)
          return constants3.ERROR.PAUSED;
      }
      onMessageComplete() {
        let { client, socket, statusCode, upgrade, headers, contentLength, bytesRead, shouldKeepAlive } = this;
        if (socket.destroyed && (!statusCode || shouldKeepAlive))
          return -1;
        if (upgrade)
          return;
        assert(statusCode >= 100), assert((this.headers.length & 1) === 0);
        let request = client[kQueue][client[kRunningIdx]];
        if (assert(request), this.statusCode = null, this.statusText = "", this.bytesRead = 0, this.contentLength = "", this.keepAlive = "", this.connection = "", this.headers = [], this.headersSize = 0, !(statusCode < 200)) {
          if (request.method !== "HEAD" && contentLength && bytesRead !== parseInt(contentLength, 10))
            return util.destroy(socket, new ResponseContentLengthMismatchError()), -1;
          if (request.onComplete(headers), client[kQueue][client[kRunningIdx]++] = null, socket[kWriting])
            return assert(client[kRunning] === 0), util.destroy(socket, new InformationalError("reset")), constants3.ERROR.PAUSED;
          if (shouldKeepAlive) {
            if (socket[kReset] && client[kRunning] === 0)
              return util.destroy(socket, new InformationalError("reset")), constants3.ERROR.PAUSED;
            client[kPipelining] == null || client[kPipelining] === 1 ? setImmediate(() => client[kResume]()) : client[kResume]();
          } else return util.destroy(socket, new InformationalError("reset")), constants3.ERROR.PAUSED;
        }
      }
    };
    function onParserTimeout(parser) {
      let { socket, timeoutType, client, paused } = parser.deref();
      timeoutType === TIMEOUT_HEADERS ? (!socket[kWriting] || socket.writableNeedDrain || client[kRunning] > 1) && (assert(!paused, "cannot be paused while waiting for headers"), util.destroy(socket, new HeadersTimeoutError())) : timeoutType === TIMEOUT_BODY ? paused || util.destroy(socket, new BodyTimeoutError()) : timeoutType === TIMEOUT_KEEP_ALIVE && (assert(client[kRunning] === 0 && client[kKeepAliveTimeoutValue]), util.destroy(socket, new InformationalError("socket idle timeout")));
    }
    async function connectH1(client, socket) {
      client[kSocket] = socket, llhttpInstance || (llhttpInstance = await llhttpPromise, llhttpPromise = null), socket[kNoRef] = !1, socket[kWriting] = !1, socket[kReset] = !1, socket[kBlocking] = !1, socket[kParser] = new Parser(client, socket, llhttpInstance), addListener(socket, "error", function(err) {
        assert(err.code !== "ERR_TLS_CERT_ALTNAME_INVALID");
        let parser = this[kParser];
        if (err.code === "ECONNRESET" && parser.statusCode && !parser.shouldKeepAlive) {
          parser.onMessageComplete();
          return;
        }
        this[kError] = err, this[kClient][kOnError](err);
      }), addListener(socket, "readable", function() {
        let parser = this[kParser];
        parser && parser.readMore();
      }), addListener(socket, "end", function() {
        let parser = this[kParser];
        if (parser.statusCode && !parser.shouldKeepAlive) {
          parser.onMessageComplete();
          return;
        }
        util.destroy(this, new SocketError("other side closed", util.getSocketInfo(this)));
      }), addListener(socket, "close", function() {
        let client2 = this[kClient], parser = this[kParser];
        parser && (!this[kError] && parser.statusCode && !parser.shouldKeepAlive && parser.onMessageComplete(), this[kParser].destroy(), this[kParser] = null);
        let err = this[kError] || new SocketError("closed", util.getSocketInfo(this));
        if (client2[kSocket] = null, client2[kHTTPContext] = null, client2.destroyed) {
          assert(client2[kPending] === 0);
          let requests = client2[kQueue].splice(client2[kRunningIdx]);
          for (let i = 0; i < requests.length; i++) {
            let request = requests[i];
            util.errorRequest(client2, request, err);
          }
        } else if (client2[kRunning] > 0 && err.code !== "UND_ERR_INFO") {
          let request = client2[kQueue][client2[kRunningIdx]];
          client2[kQueue][client2[kRunningIdx]++] = null, util.errorRequest(client2, request, err);
        }
        client2[kPendingIdx] = client2[kRunningIdx], assert(client2[kRunning] === 0), client2.emit("disconnect", client2[kUrl], [client2], err), client2[kResume]();
      });
      let closed = !1;
      return socket.on("close", () => {
        closed = !0;
      }), {
        version: "h1",
        defaultPipelining: 1,
        write(...args) {
          return writeH1(client, ...args);
        },
        resume() {
          resumeH1(client);
        },
        destroy(err, callback) {
          closed ? queueMicrotask(callback) : socket.destroy(err).on("close", callback);
        },
        get destroyed() {
          return socket.destroyed;
        },
        busy(request) {
          return !!(socket[kWriting] || socket[kReset] || socket[kBlocking] || request && (client[kRunning] > 0 && !request.idempotent || client[kRunning] > 0 && (request.upgrade || request.method === "CONNECT") || client[kRunning] > 0 && util.bodyLength(request.body) !== 0 && (util.isStream(request.body) || util.isAsyncIterable(request.body) || util.isFormDataLike(request.body))));
        }
      };
    }
    function resumeH1(client) {
      let socket = client[kSocket];
      if (socket && !socket.destroyed) {
        if (client[kSize] === 0 ? !socket[kNoRef] && socket.unref && (socket.unref(), socket[kNoRef] = !0) : socket[kNoRef] && socket.ref && (socket.ref(), socket[kNoRef] = !1), client[kSize] === 0)
          socket[kParser].timeoutType !== TIMEOUT_KEEP_ALIVE && socket[kParser].setTimeout(client[kKeepAliveTimeoutValue], TIMEOUT_KEEP_ALIVE);
        else if (client[kRunning] > 0 && socket[kParser].statusCode < 200 && socket[kParser].timeoutType !== TIMEOUT_HEADERS) {
          let request = client[kQueue][client[kRunningIdx]], headersTimeout = request.headersTimeout != null ? request.headersTimeout : client[kHeadersTimeout];
          socket[kParser].setTimeout(headersTimeout, TIMEOUT_HEADERS);
        }
      }
    }
    function shouldSendContentLength(method) {
      return method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && method !== "TRACE" && method !== "CONNECT";
    }
    function writeH1(client, request) {
      let { method, path: path4, host, upgrade, blocking, reset } = request, { body, headers, contentLength } = request, expectsPayload = method === "PUT" || method === "POST" || method === "PATCH" || method === "QUERY" || method === "PROPFIND" || method === "PROPPATCH";
      if (util.isFormDataLike(body)) {
        extractBody || (extractBody = require_body().extractBody);
        let [bodyStream, contentType] = extractBody(body);
        request.contentType == null && headers.push("content-type", contentType), body = bodyStream.stream, contentLength = bodyStream.length;
      } else util.isBlobLike(body) && request.contentType == null && body.type && headers.push("content-type", body.type);
      body && typeof body.read == "function" && body.read(0);
      let bodyLength = util.bodyLength(body);
      if (contentLength = bodyLength ?? contentLength, contentLength === null && (contentLength = request.contentLength), contentLength === 0 && !expectsPayload && (contentLength = null), shouldSendContentLength(method) && contentLength > 0 && request.contentLength !== null && request.contentLength !== contentLength) {
        if (client[kStrictContentLength])
          return util.errorRequest(client, request, new RequestContentLengthMismatchError()), !1;
        process.emitWarning(new RequestContentLengthMismatchError());
      }
      let socket = client[kSocket], abort = (err) => {
        request.aborted || request.completed || (util.errorRequest(client, request, err || new RequestAbortedError()), util.destroy(body), util.destroy(socket, new InformationalError("aborted")));
      };
      try {
        request.onConnect(abort);
      } catch (err) {
        util.errorRequest(client, request, err);
      }
      if (request.aborted)
        return !1;
      method === "HEAD" && (socket[kReset] = !0), (upgrade || method === "CONNECT") && (socket[kReset] = !0), reset != null && (socket[kReset] = reset), client[kMaxRequests] && socket[kCounter]++ >= client[kMaxRequests] && (socket[kReset] = !0), blocking && (socket[kBlocking] = !0);
      let header = `${method} ${path4} HTTP/1.1\r
`;
      if (typeof host == "string" ? header += `host: ${host}\r
` : header += client[kHostHeader], upgrade ? header += `connection: upgrade\r
upgrade: ${upgrade}\r
` : client[kPipelining] && !socket[kReset] ? header += `connection: keep-alive\r
` : header += `connection: close\r
`, Array.isArray(headers))
        for (let n = 0; n < headers.length; n += 2) {
          let key = headers[n + 0], val = headers[n + 1];
          if (Array.isArray(val))
            for (let i = 0; i < val.length; i++)
              header += `${key}: ${val[i]}\r
`;
          else
            header += `${key}: ${val}\r
`;
        }
      return channels.sendHeaders.hasSubscribers && channels.sendHeaders.publish({ request, headers: header, socket }), !body || bodyLength === 0 ? writeBuffer(abort, null, client, request, socket, contentLength, header, expectsPayload) : util.isBuffer(body) ? writeBuffer(abort, body, client, request, socket, contentLength, header, expectsPayload) : util.isBlobLike(body) ? typeof body.stream == "function" ? writeIterable(abort, body.stream(), client, request, socket, contentLength, header, expectsPayload) : writeBlob(abort, body, client, request, socket, contentLength, header, expectsPayload) : util.isStream(body) ? writeStream(abort, body, client, request, socket, contentLength, header, expectsPayload) : util.isIterable(body) ? writeIterable(abort, body, client, request, socket, contentLength, header, expectsPayload) : assert(!1), !0;
    }
    function writeStream(abort, body, client, request, socket, contentLength, header, expectsPayload) {
      assert(contentLength !== 0 || client[kRunning] === 0, "stream body cannot be pipelined");
      let finished = !1, writer = new AsyncWriter({ abort, socket, request, contentLength, client, expectsPayload, header }), onData = function(chunk) {
        if (!finished)
          try {
            !writer.write(chunk) && this.pause && this.pause();
          } catch (err) {
            util.destroy(this, err);
          }
      }, onDrain = function() {
        finished || body.resume && body.resume();
      }, onClose = function() {
        if (queueMicrotask(() => {
          body.removeListener("error", onFinished);
        }), !finished) {
          let err = new RequestAbortedError();
          queueMicrotask(() => onFinished(err));
        }
      }, onFinished = function(err) {
        if (!finished) {
          if (finished = !0, assert(socket.destroyed || socket[kWriting] && client[kRunning] <= 1), socket.off("drain", onDrain).off("error", onFinished), body.removeListener("data", onData).removeListener("end", onFinished).removeListener("close", onClose), !err)
            try {
              writer.end();
            } catch (er) {
              err = er;
            }
          writer.destroy(err), err && (err.code !== "UND_ERR_INFO" || err.message !== "reset") ? util.destroy(body, err) : util.destroy(body);
        }
      };
      body.on("data", onData).on("end", onFinished).on("error", onFinished).on("close", onClose), body.resume && body.resume(), socket.on("drain", onDrain).on("error", onFinished), body.errorEmitted ?? body.errored ? setImmediate(() => onFinished(body.errored)) : (body.endEmitted ?? body.readableEnded) && setImmediate(() => onFinished(null)), (body.closeEmitted ?? body.closed) && setImmediate(onClose);
    }
    function writeBuffer(abort, body, client, request, socket, contentLength, header, expectsPayload) {
      try {
        body ? util.isBuffer(body) && (assert(contentLength === body.byteLength, "buffer body must have content length"), socket.cork(), socket.write(`${header}content-length: ${contentLength}\r
\r
`, "latin1"), socket.write(body), socket.uncork(), request.onBodySent(body), !expectsPayload && request.reset !== !1 && (socket[kReset] = !0)) : contentLength === 0 ? socket.write(`${header}content-length: 0\r
\r
`, "latin1") : (assert(contentLength === null, "no body must not have content length"), socket.write(`${header}\r
`, "latin1")), request.onRequestSent(), client[kResume]();
      } catch (err) {
        abort(err);
      }
    }
    async function writeBlob(abort, body, client, request, socket, contentLength, header, expectsPayload) {
      assert(contentLength === body.size, "blob body must have content length");
      try {
        if (contentLength != null && contentLength !== body.size)
          throw new RequestContentLengthMismatchError();
        let buffer = Buffer.from(await body.arrayBuffer());
        socket.cork(), socket.write(`${header}content-length: ${contentLength}\r
\r
`, "latin1"), socket.write(buffer), socket.uncork(), request.onBodySent(buffer), request.onRequestSent(), !expectsPayload && request.reset !== !1 && (socket[kReset] = !0), client[kResume]();
      } catch (err) {
        abort(err);
      }
    }
    async function writeIterable(abort, body, client, request, socket, contentLength, header, expectsPayload) {
      assert(contentLength !== 0 || client[kRunning] === 0, "iterator body cannot be pipelined");
      let callback = null;
      function onDrain() {
        if (callback) {
          let cb = callback;
          callback = null, cb();
        }
      }
      let waitForDrain = () => new Promise((resolve2, reject) => {
        assert(callback === null), socket[kError] ? reject(socket[kError]) : callback = resolve2;
      });
      socket.on("close", onDrain).on("drain", onDrain);
      let writer = new AsyncWriter({ abort, socket, request, contentLength, client, expectsPayload, header });
      try {
        for await (let chunk of body) {
          if (socket[kError])
            throw socket[kError];
          writer.write(chunk) || await waitForDrain();
        }
        writer.end();
      } catch (err) {
        writer.destroy(err);
      } finally {
        socket.off("close", onDrain).off("drain", onDrain);
      }
    }
    var AsyncWriter = class {
      constructor({ abort, socket, request, contentLength, client, expectsPayload, header }) {
        this.socket = socket, this.request = request, this.contentLength = contentLength, this.client = client, this.bytesWritten = 0, this.expectsPayload = expectsPayload, this.header = header, this.abort = abort, socket[kWriting] = !0;
      }
      write(chunk) {
        let { socket, request, contentLength, client, bytesWritten, expectsPayload, header } = this;
        if (socket[kError])
          throw socket[kError];
        if (socket.destroyed)
          return !1;
        let len = Buffer.byteLength(chunk);
        if (!len)
          return !0;
        if (contentLength !== null && bytesWritten + len > contentLength) {
          if (client[kStrictContentLength])
            throw new RequestContentLengthMismatchError();
          process.emitWarning(new RequestContentLengthMismatchError());
        }
        socket.cork(), bytesWritten === 0 && (!expectsPayload && request.reset !== !1 && (socket[kReset] = !0), contentLength === null ? socket.write(`${header}transfer-encoding: chunked\r
`, "latin1") : socket.write(`${header}content-length: ${contentLength}\r
\r
`, "latin1")), contentLength === null && socket.write(`\r
${len.toString(16)}\r
`, "latin1"), this.bytesWritten += len;
        let ret = socket.write(chunk);
        return socket.uncork(), request.onBodySent(chunk), ret || socket[kParser].timeout && socket[kParser].timeoutType === TIMEOUT_HEADERS && socket[kParser].timeout.refresh && socket[kParser].timeout.refresh(), ret;
      }
      end() {
        let { socket, contentLength, client, bytesWritten, expectsPayload, header, request } = this;
        if (request.onRequestSent(), socket[kWriting] = !1, socket[kError])
          throw socket[kError];
        if (!socket.destroyed) {
          if (bytesWritten === 0 ? expectsPayload ? socket.write(`${header}content-length: 0\r
\r
`, "latin1") : socket.write(`${header}\r
`, "latin1") : contentLength === null && socket.write(`\r
0\r
\r
`, "latin1"), contentLength !== null && bytesWritten !== contentLength) {
            if (client[kStrictContentLength])
              throw new RequestContentLengthMismatchError();
            process.emitWarning(new RequestContentLengthMismatchError());
          }
          socket[kParser].timeout && socket[kParser].timeoutType === TIMEOUT_HEADERS && socket[kParser].timeout.refresh && socket[kParser].timeout.refresh(), client[kResume]();
        }
      }
      destroy(err) {
        let { socket, client, abort } = this;
        socket[kWriting] = !1, err && (assert(client[kRunning] <= 1, "pipeline should only contain this request"), abort(err));
      }
    };
    module.exports = connectH1;
  }
});

// node_modules/undici/lib/dispatcher/client-h2.js
var require_client_h2 = __commonJS({
  "node_modules/undici/lib/dispatcher/client-h2.js"(exports, module) {
    "use strict";
    var assert = __require("node:assert"), { pipeline: pipeline3 } = __require("node:stream"), util = require_util(), {
      RequestContentLengthMismatchError,
      RequestAbortedError,
      SocketError,
      InformationalError
    } = require_errors(), {
      kUrl,
      kReset,
      kClient,
      kRunning,
      kPending,
      kQueue,
      kPendingIdx,
      kRunningIdx,
      kError,
      kSocket,
      kStrictContentLength,
      kOnError,
      kMaxConcurrentStreams,
      kHTTP2Session,
      kResume,
      kSize,
      kHTTPContext
    } = require_symbols(), kOpenStreams = /* @__PURE__ */ Symbol("open streams"), extractBody, h2ExperimentalWarned = !1, http2;
    try {
      http2 = __require("node:http2");
    } catch {
      http2 = { constants: {} };
    }
    var {
      constants: {
        HTTP2_HEADER_AUTHORITY,
        HTTP2_HEADER_METHOD,
        HTTP2_HEADER_PATH,
        HTTP2_HEADER_SCHEME,
        HTTP2_HEADER_CONTENT_LENGTH,
        HTTP2_HEADER_EXPECT,
        HTTP2_HEADER_STATUS
      }
    } = http2;
    function parseH2Headers(headers) {
      let result = [];
      for (let [name, value] of Object.entries(headers))
        if (Array.isArray(value))
          for (let subvalue of value)
            result.push(Buffer.from(name), Buffer.from(subvalue));
        else
          result.push(Buffer.from(name), Buffer.from(value));
      return result;
    }
    async function connectH2(client, socket) {
      client[kSocket] = socket, h2ExperimentalWarned || (h2ExperimentalWarned = !0, process.emitWarning("H2 support is experimental, expect them to change at any time.", {
        code: "UNDICI-H2"
      }));
      let session = http2.connect(client[kUrl], {
        createConnection: () => socket,
        peerMaxConcurrentStreams: client[kMaxConcurrentStreams]
      });
      session[kOpenStreams] = 0, session[kClient] = client, session[kSocket] = socket, util.addListener(session, "error", onHttp2SessionError), util.addListener(session, "frameError", onHttp2FrameError), util.addListener(session, "end", onHttp2SessionEnd), util.addListener(session, "goaway", onHTTP2GoAway), util.addListener(session, "close", function() {
        let { [kClient]: client2 } = this, { [kSocket]: socket2 } = client2, err = this[kSocket][kError] || this[kError] || new SocketError("closed", util.getSocketInfo(socket2));
        if (client2[kHTTP2Session] = null, client2.destroyed) {
          assert(client2[kPending] === 0);
          let requests = client2[kQueue].splice(client2[kRunningIdx]);
          for (let i = 0; i < requests.length; i++) {
            let request = requests[i];
            util.errorRequest(client2, request, err);
          }
        }
      }), session.unref(), client[kHTTP2Session] = session, socket[kHTTP2Session] = session, util.addListener(socket, "error", function(err) {
        assert(err.code !== "ERR_TLS_CERT_ALTNAME_INVALID"), this[kError] = err, this[kClient][kOnError](err);
      }), util.addListener(socket, "end", function() {
        util.destroy(this, new SocketError("other side closed", util.getSocketInfo(this)));
      }), util.addListener(socket, "close", function() {
        let err = this[kError] || new SocketError("closed", util.getSocketInfo(this));
        client[kSocket] = null, this[kHTTP2Session] != null && this[kHTTP2Session].destroy(err), client[kPendingIdx] = client[kRunningIdx], assert(client[kRunning] === 0), client.emit("disconnect", client[kUrl], [client], err), client[kResume]();
      });
      let closed = !1;
      return socket.on("close", () => {
        closed = !0;
      }), {
        version: "h2",
        defaultPipelining: 1 / 0,
        write(...args) {
          return writeH2(client, ...args);
        },
        resume() {
          resumeH2(client);
        },
        destroy(err, callback) {
          closed ? queueMicrotask(callback) : socket.destroy(err).on("close", callback);
        },
        get destroyed() {
          return socket.destroyed;
        },
        busy() {
          return !1;
        }
      };
    }
    function resumeH2(client) {
      let socket = client[kSocket];
      socket?.destroyed === !1 && (client[kSize] === 0 && client[kMaxConcurrentStreams] === 0 ? (socket.unref(), client[kHTTP2Session].unref()) : (socket.ref(), client[kHTTP2Session].ref()));
    }
    function onHttp2SessionError(err) {
      assert(err.code !== "ERR_TLS_CERT_ALTNAME_INVALID"), this[kSocket][kError] = err, this[kClient][kOnError](err);
    }
    function onHttp2FrameError(type, code, id) {
      if (id === 0) {
        let err = new InformationalError(`HTTP/2: "frameError" received - type ${type}, code ${code}`);
        this[kSocket][kError] = err, this[kClient][kOnError](err);
      }
    }
    function onHttp2SessionEnd() {
      let err = new SocketError("other side closed", util.getSocketInfo(this[kSocket]));
      this.destroy(err), util.destroy(this[kSocket], err);
    }
    function onHTTP2GoAway(code) {
      let err = this[kError] || new SocketError(`HTTP/2: "GOAWAY" frame received with code ${code}`, util.getSocketInfo(this)), client = this[kClient];
      if (client[kSocket] = null, client[kHTTPContext] = null, this[kHTTP2Session] != null && (this[kHTTP2Session].destroy(err), this[kHTTP2Session] = null), util.destroy(this[kSocket], err), client[kRunningIdx] < client[kQueue].length) {
        let request = client[kQueue][client[kRunningIdx]];
        client[kQueue][client[kRunningIdx]++] = null, util.errorRequest(client, request, err), client[kPendingIdx] = client[kRunningIdx];
      }
      assert(client[kRunning] === 0), client.emit("disconnect", client[kUrl], [client], err), client[kResume]();
    }
    function shouldSendContentLength(method) {
      return method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && method !== "TRACE" && method !== "CONNECT";
    }
    function writeH2(client, request) {
      let session = client[kHTTP2Session], { method, path: path4, host, upgrade, expectContinue, signal, headers: reqHeaders } = request, { body } = request;
      if (upgrade)
        return util.errorRequest(client, request, new Error("Upgrade not supported for H2")), !1;
      let headers = {};
      for (let n = 0; n < reqHeaders.length; n += 2) {
        let key = reqHeaders[n + 0], val = reqHeaders[n + 1];
        if (Array.isArray(val))
          for (let i = 0; i < val.length; i++)
            headers[key] ? headers[key] += `,${val[i]}` : headers[key] = val[i];
        else
          headers[key] = val;
      }
      let stream, { hostname, port } = client[kUrl];
      headers[HTTP2_HEADER_AUTHORITY] = host || `${hostname}${port ? `:${port}` : ""}`, headers[HTTP2_HEADER_METHOD] = method;
      let abort = (err) => {
        request.aborted || request.completed || (err = err || new RequestAbortedError(), util.errorRequest(client, request, err), stream != null && util.destroy(stream, err), util.destroy(body, err), client[kQueue][client[kRunningIdx]++] = null, client[kResume]());
      };
      try {
        request.onConnect(abort);
      } catch (err) {
        util.errorRequest(client, request, err);
      }
      if (request.aborted)
        return !1;
      if (method === "CONNECT")
        return session.ref(), stream = session.request(headers, { endStream: !1, signal }), stream.id && !stream.pending ? (request.onUpgrade(null, null, stream), ++session[kOpenStreams], client[kQueue][client[kRunningIdx]++] = null) : stream.once("ready", () => {
          request.onUpgrade(null, null, stream), ++session[kOpenStreams], client[kQueue][client[kRunningIdx]++] = null;
        }), stream.once("close", () => {
          session[kOpenStreams] -= 1, session[kOpenStreams] === 0 && session.unref();
        }), !0;
      headers[HTTP2_HEADER_PATH] = path4, headers[HTTP2_HEADER_SCHEME] = "https";
      let expectsPayload = method === "PUT" || method === "POST" || method === "PATCH";
      body && typeof body.read == "function" && body.read(0);
      let contentLength = util.bodyLength(body);
      if (util.isFormDataLike(body)) {
        extractBody ??= require_body().extractBody;
        let [bodyStream, contentType] = extractBody(body);
        headers["content-type"] = contentType, body = bodyStream.stream, contentLength = bodyStream.length;
      }
      if (contentLength == null && (contentLength = request.contentLength), (contentLength === 0 || !expectsPayload) && (contentLength = null), shouldSendContentLength(method) && contentLength > 0 && request.contentLength != null && request.contentLength !== contentLength) {
        if (client[kStrictContentLength])
          return util.errorRequest(client, request, new RequestContentLengthMismatchError()), !1;
        process.emitWarning(new RequestContentLengthMismatchError());
      }
      contentLength != null && (assert(body, "no body must not have content length"), headers[HTTP2_HEADER_CONTENT_LENGTH] = `${contentLength}`), session.ref();
      let shouldEndStream = method === "GET" || method === "HEAD" || body === null;
      return expectContinue ? (headers[HTTP2_HEADER_EXPECT] = "100-continue", stream = session.request(headers, { endStream: shouldEndStream, signal }), stream.once("continue", writeBodyH2)) : (stream = session.request(headers, {
        endStream: shouldEndStream,
        signal
      }), writeBodyH2()), ++session[kOpenStreams], stream.once("response", (headers2) => {
        let { [HTTP2_HEADER_STATUS]: statusCode, ...realHeaders } = headers2;
        if (request.onResponseStarted(), request.aborted) {
          let err = new RequestAbortedError();
          util.errorRequest(client, request, err), util.destroy(stream, err);
          return;
        }
        request.onHeaders(Number(statusCode), parseH2Headers(realHeaders), stream.resume.bind(stream), "") === !1 && stream.pause(), stream.on("data", (chunk) => {
          request.onData(chunk) === !1 && stream.pause();
        });
      }), stream.once("end", () => {
        (stream.state?.state == null || stream.state.state < 6) && request.onComplete([]), session[kOpenStreams] === 0 && session.unref(), abort(new InformationalError("HTTP/2: stream half-closed (remote)")), client[kQueue][client[kRunningIdx]++] = null, client[kPendingIdx] = client[kRunningIdx], client[kResume]();
      }), stream.once("close", () => {
        session[kOpenStreams] -= 1, session[kOpenStreams] === 0 && session.unref();
      }), stream.once("error", function(err) {
        abort(err);
      }), stream.once("frameError", (type, code) => {
        abort(new InformationalError(`HTTP/2: "frameError" received - type ${type}, code ${code}`));
      }), !0;
      function writeBodyH2() {
        !body || contentLength === 0 ? writeBuffer(
          abort,
          stream,
          null,
          client,
          request,
          client[kSocket],
          contentLength,
          expectsPayload
        ) : util.isBuffer(body) ? writeBuffer(
          abort,
          stream,
          body,
          client,
          request,
          client[kSocket],
          contentLength,
          expectsPayload
        ) : util.isBlobLike(body) ? typeof body.stream == "function" ? writeIterable(
          abort,
          stream,
          body.stream(),
          client,
          request,
          client[kSocket],
          contentLength,
          expectsPayload
        ) : writeBlob(
          abort,
          stream,
          body,
          client,
          request,
          client[kSocket],
          contentLength,
          expectsPayload
        ) : util.isStream(body) ? writeStream(
          abort,
          client[kSocket],
          expectsPayload,
          stream,
          body,
          client,
          request,
          contentLength
        ) : util.isIterable(body) ? writeIterable(
          abort,
          stream,
          body,
          client,
          request,
          client[kSocket],
          contentLength,
          expectsPayload
        ) : assert(!1);
      }
    }
    function writeBuffer(abort, h2stream, body, client, request, socket, contentLength, expectsPayload) {
      try {
        body != null && util.isBuffer(body) && (assert(contentLength === body.byteLength, "buffer body must have content length"), h2stream.cork(), h2stream.write(body), h2stream.uncork(), h2stream.end(), request.onBodySent(body)), expectsPayload || (socket[kReset] = !0), request.onRequestSent(), client[kResume]();
      } catch (error2) {
        abort(error2);
      }
    }
    function writeStream(abort, socket, expectsPayload, h2stream, body, client, request, contentLength) {
      assert(contentLength !== 0 || client[kRunning] === 0, "stream body cannot be pipelined");
      let pipe = pipeline3(
        body,
        h2stream,
        (err) => {
          err ? (util.destroy(pipe, err), abort(err)) : (util.removeAllListeners(pipe), request.onRequestSent(), expectsPayload || (socket[kReset] = !0), client[kResume]());
        }
      );
      util.addListener(pipe, "data", onPipeData);
      function onPipeData(chunk) {
        request.onBodySent(chunk);
      }
    }
    async function writeBlob(abort, h2stream, body, client, request, socket, contentLength, expectsPayload) {
      assert(contentLength === body.size, "blob body must have content length");
      try {
        if (contentLength != null && contentLength !== body.size)
          throw new RequestContentLengthMismatchError();
        let buffer = Buffer.from(await body.arrayBuffer());
        h2stream.cork(), h2stream.write(buffer), h2stream.uncork(), h2stream.end(), request.onBodySent(buffer), request.onRequestSent(), expectsPayload || (socket[kReset] = !0), client[kResume]();
      } catch (err) {
        abort(err);
      }
    }
    async function writeIterable(abort, h2stream, body, client, request, socket, contentLength, expectsPayload) {
      assert(contentLength !== 0 || client[kRunning] === 0, "iterator body cannot be pipelined");
      let callback = null;
      function onDrain() {
        if (callback) {
          let cb = callback;
          callback = null, cb();
        }
      }
      let waitForDrain = () => new Promise((resolve2, reject) => {
        assert(callback === null), socket[kError] ? reject(socket[kError]) : callback = resolve2;
      });
      h2stream.on("close", onDrain).on("drain", onDrain);
      try {
        for await (let chunk of body) {
          if (socket[kError])
            throw socket[kError];
          let res = h2stream.write(chunk);
          request.onBodySent(chunk), res || await waitForDrain();
        }
        h2stream.end(), request.onRequestSent(), expectsPayload || (socket[kReset] = !0), client[kResume]();
      } catch (err) {
        abort(err);
      } finally {
        h2stream.off("close", onDrain).off("drain", onDrain);
      }
    }
    module.exports = connectH2;
  }
});

// node_modules/undici/lib/handler/redirect-handler.js
var require_redirect_handler = __commonJS({
  "node_modules/undici/lib/handler/redirect-handler.js"(exports, module) {
    "use strict";
    var util = require_util(), { kBodyUsed } = require_symbols(), assert = __require("node:assert"), { InvalidArgumentError } = require_errors(), EE = __require("node:events"), redirectableStatusCodes = [300, 301, 302, 303, 307, 308], kBody = /* @__PURE__ */ Symbol("body"), BodyAsyncIterable = class {
      constructor(body) {
        this[kBody] = body, this[kBodyUsed] = !1;
      }
      async *[Symbol.asyncIterator]() {
        assert(!this[kBodyUsed], "disturbed"), this[kBodyUsed] = !0, yield* this[kBody];
      }
    }, RedirectHandler = class {
      constructor(dispatch, maxRedirections, opts, handler) {
        if (maxRedirections != null && (!Number.isInteger(maxRedirections) || maxRedirections < 0))
          throw new InvalidArgumentError("maxRedirections must be a positive number");
        util.validateHandler(handler, opts.method, opts.upgrade), this.dispatch = dispatch, this.location = null, this.abort = null, this.opts = { ...opts, maxRedirections: 0 }, this.maxRedirections = maxRedirections, this.handler = handler, this.history = [], this.redirectionLimitReached = !1, util.isStream(this.opts.body) ? (util.bodyLength(this.opts.body) === 0 && this.opts.body.on("data", function() {
          assert(!1);
        }), typeof this.opts.body.readableDidRead != "boolean" && (this.opts.body[kBodyUsed] = !1, EE.prototype.on.call(this.opts.body, "data", function() {
          this[kBodyUsed] = !0;
        }))) : this.opts.body && typeof this.opts.body.pipeTo == "function" ? this.opts.body = new BodyAsyncIterable(this.opts.body) : this.opts.body && typeof this.opts.body != "string" && !ArrayBuffer.isView(this.opts.body) && util.isIterable(this.opts.body) && (this.opts.body = new BodyAsyncIterable(this.opts.body));
      }
      onConnect(abort) {
        this.abort = abort, this.handler.onConnect(abort, { history: this.history });
      }
      onUpgrade(statusCode, headers, socket) {
        this.handler.onUpgrade(statusCode, headers, socket);
      }
      onError(error2) {
        this.handler.onError(error2);
      }
      onHeaders(statusCode, headers, resume, statusText) {
        if (this.location = this.history.length >= this.maxRedirections || util.isDisturbed(this.opts.body) ? null : parseLocation(statusCode, headers), this.opts.throwOnMaxRedirect && this.history.length >= this.maxRedirections) {
          this.request && this.request.abort(new Error("max redirects")), this.redirectionLimitReached = !0, this.abort(new Error("max redirects"));
          return;
        }
        if (this.opts.origin && this.history.push(new URL(this.opts.path, this.opts.origin)), !this.location)
          return this.handler.onHeaders(statusCode, headers, resume, statusText);
        let { origin, pathname, search } = util.parseURL(new URL(this.location, this.opts.origin && new URL(this.opts.path, this.opts.origin))), path4 = search ? `${pathname}${search}` : pathname;
        this.opts.headers = cleanRequestHeaders(this.opts.headers, statusCode === 303, this.opts.origin !== origin), this.opts.path = path4, this.opts.origin = origin, this.opts.maxRedirections = 0, this.opts.query = null, statusCode === 303 && this.opts.method !== "HEAD" && (this.opts.method = "GET", this.opts.body = null);
      }
      onData(chunk) {
        if (!this.location)
          return this.handler.onData(chunk);
      }
      onComplete(trailers) {
        this.location ? (this.location = null, this.abort = null, this.dispatch(this.opts, this)) : this.handler.onComplete(trailers);
      }
      onBodySent(chunk) {
        this.handler.onBodySent && this.handler.onBodySent(chunk);
      }
    };
    function parseLocation(statusCode, headers) {
      if (redirectableStatusCodes.indexOf(statusCode) === -1)
        return null;
      for (let i = 0; i < headers.length; i += 2)
        if (headers[i].length === 8 && util.headerNameToString(headers[i]) === "location")
          return headers[i + 1];
    }
    function shouldRemoveHeader(header, removeContent, unknownOrigin) {
      if (header.length === 4)
        return util.headerNameToString(header) === "host";
      if (removeContent && util.headerNameToString(header).startsWith("content-"))
        return !0;
      if (unknownOrigin && (header.length === 13 || header.length === 6 || header.length === 19)) {
        let name = util.headerNameToString(header);
        return name === "authorization" || name === "cookie" || name === "proxy-authorization";
      }
      return !1;
    }
    function cleanRequestHeaders(headers, removeContent, unknownOrigin) {
      let ret = [];
      if (Array.isArray(headers))
        for (let i = 0; i < headers.length; i += 2)
          shouldRemoveHeader(headers[i], removeContent, unknownOrigin) || ret.push(headers[i], headers[i + 1]);
      else if (headers && typeof headers == "object")
        for (let key of Object.keys(headers))
          shouldRemoveHeader(key, removeContent, unknownOrigin) || ret.push(key, headers[key]);
      else
        assert(headers == null, "headers must be an object or an array");
      return ret;
    }
    module.exports = RedirectHandler;
  }
});

// node_modules/undici/lib/interceptor/redirect-interceptor.js
var require_redirect_interceptor = __commonJS({
  "node_modules/undici/lib/interceptor/redirect-interceptor.js"(exports, module) {
    "use strict";
    var RedirectHandler = require_redirect_handler();
    function createRedirectInterceptor({ maxRedirections: defaultMaxRedirections }) {
      return (dispatch) => function(opts, handler) {
        let { maxRedirections = defaultMaxRedirections } = opts;
        if (!maxRedirections)
          return dispatch(opts, handler);
        let redirectHandler = new RedirectHandler(dispatch, maxRedirections, opts, handler);
        return opts = { ...opts, maxRedirections: 0 }, dispatch(opts, redirectHandler);
      };
    }
    module.exports = createRedirectInterceptor;
  }
});

// node_modules/undici/lib/dispatcher/client.js
var require_client = __commonJS({
  "node_modules/undici/lib/dispatcher/client.js"(exports, module) {
    "use strict";
    var assert = __require("node:assert"), net = __require("node:net"), http = __require("node:http"), util = require_util(), { channels } = require_diagnostics(), Request = require_request(), DispatcherBase = require_dispatcher_base(), {
      InvalidArgumentError,
      InformationalError,
      ClientDestroyedError
    } = require_errors(), buildConnector = require_connect(), {
      kUrl,
      kServerName,
      kClient,
      kBusy,
      kConnect,
      kResuming,
      kRunning,
      kPending,
      kSize,
      kQueue,
      kConnected,
      kConnecting,
      kNeedDrain,
      kKeepAliveDefaultTimeout,
      kHostHeader,
      kPendingIdx,
      kRunningIdx,
      kError,
      kPipelining,
      kKeepAliveTimeoutValue,
      kMaxHeadersSize,
      kKeepAliveMaxTimeout,
      kKeepAliveTimeoutThreshold,
      kHeadersTimeout,
      kBodyTimeout,
      kStrictContentLength,
      kConnector,
      kMaxRedirections,
      kMaxRequests,
      kCounter,
      kClose,
      kDestroy,
      kDispatch,
      kInterceptors,
      kLocalAddress,
      kMaxResponseSize,
      kOnError,
      kHTTPContext,
      kMaxConcurrentStreams,
      kResume
    } = require_symbols(), connectH1 = require_client_h1(), connectH2 = require_client_h2(), deprecatedInterceptorWarned = !1, kClosedResolve = /* @__PURE__ */ Symbol("kClosedResolve"), noop = () => {
    };
    function getPipelining(client) {
      return client[kPipelining] ?? client[kHTTPContext]?.defaultPipelining ?? 1;
    }
    var Client = class extends DispatcherBase {
      /**
       *
       * @param {string|URL} url
       * @param {import('../../types/client.js').Client.Options} options
       */
      constructor(url, {
        interceptors,
        maxHeaderSize,
        headersTimeout,
        socketTimeout,
        requestTimeout,
        connectTimeout,
        bodyTimeout,
        idleTimeout,
        keepAlive,
        keepAliveTimeout,
        maxKeepAliveTimeout,
        keepAliveMaxTimeout,
        keepAliveTimeoutThreshold,
        socketPath,
        pipelining,
        tls,
        strictContentLength,
        maxCachedSessions,
        maxRedirections,
        connect: connect2,
        maxRequestsPerClient,
        localAddress,
        maxResponseSize,
        autoSelectFamily,
        autoSelectFamilyAttemptTimeout,
        // h2
        maxConcurrentStreams,
        allowH2,
        webSocket
      } = {}) {
        if (super({ webSocket }), keepAlive !== void 0)
          throw new InvalidArgumentError("unsupported keepAlive, use pipelining=0 instead");
        if (socketTimeout !== void 0)
          throw new InvalidArgumentError("unsupported socketTimeout, use headersTimeout & bodyTimeout instead");
        if (requestTimeout !== void 0)
          throw new InvalidArgumentError("unsupported requestTimeout, use headersTimeout & bodyTimeout instead");
        if (idleTimeout !== void 0)
          throw new InvalidArgumentError("unsupported idleTimeout, use keepAliveTimeout instead");
        if (maxKeepAliveTimeout !== void 0)
          throw new InvalidArgumentError("unsupported maxKeepAliveTimeout, use keepAliveMaxTimeout instead");
        if (maxHeaderSize != null && !Number.isFinite(maxHeaderSize))
          throw new InvalidArgumentError("invalid maxHeaderSize");
        if (socketPath != null && typeof socketPath != "string")
          throw new InvalidArgumentError("invalid socketPath");
        if (connectTimeout != null && (!Number.isFinite(connectTimeout) || connectTimeout < 0))
          throw new InvalidArgumentError("invalid connectTimeout");
        if (keepAliveTimeout != null && (!Number.isFinite(keepAliveTimeout) || keepAliveTimeout <= 0))
          throw new InvalidArgumentError("invalid keepAliveTimeout");
        if (keepAliveMaxTimeout != null && (!Number.isFinite(keepAliveMaxTimeout) || keepAliveMaxTimeout <= 0))
          throw new InvalidArgumentError("invalid keepAliveMaxTimeout");
        if (keepAliveTimeoutThreshold != null && !Number.isFinite(keepAliveTimeoutThreshold))
          throw new InvalidArgumentError("invalid keepAliveTimeoutThreshold");
        if (headersTimeout != null && (!Number.isInteger(headersTimeout) || headersTimeout < 0))
          throw new InvalidArgumentError("headersTimeout must be a positive integer or zero");
        if (bodyTimeout != null && (!Number.isInteger(bodyTimeout) || bodyTimeout < 0))
          throw new InvalidArgumentError("bodyTimeout must be a positive integer or zero");
        if (connect2 != null && typeof connect2 != "function" && typeof connect2 != "object")
          throw new InvalidArgumentError("connect must be a function or an object");
        if (maxRedirections != null && (!Number.isInteger(maxRedirections) || maxRedirections < 0))
          throw new InvalidArgumentError("maxRedirections must be a positive number");
        if (maxRequestsPerClient != null && (!Number.isInteger(maxRequestsPerClient) || maxRequestsPerClient < 0))
          throw new InvalidArgumentError("maxRequestsPerClient must be a positive number");
        if (localAddress != null && (typeof localAddress != "string" || net.isIP(localAddress) === 0))
          throw new InvalidArgumentError("localAddress must be valid string IP address");
        if (maxResponseSize != null && (!Number.isInteger(maxResponseSize) || maxResponseSize < -1))
          throw new InvalidArgumentError("maxResponseSize must be a positive number");
        if (autoSelectFamilyAttemptTimeout != null && (!Number.isInteger(autoSelectFamilyAttemptTimeout) || autoSelectFamilyAttemptTimeout < -1))
          throw new InvalidArgumentError("autoSelectFamilyAttemptTimeout must be a positive number");
        if (allowH2 != null && typeof allowH2 != "boolean")
          throw new InvalidArgumentError("allowH2 must be a valid boolean value");
        if (maxConcurrentStreams != null && (typeof maxConcurrentStreams != "number" || maxConcurrentStreams < 1))
          throw new InvalidArgumentError("maxConcurrentStreams must be a positive integer, greater than 0");
        typeof connect2 != "function" && (connect2 = buildConnector({
          ...tls,
          maxCachedSessions,
          allowH2,
          socketPath,
          timeout: connectTimeout,
          ...autoSelectFamily ? { autoSelectFamily, autoSelectFamilyAttemptTimeout } : void 0,
          ...connect2
        })), interceptors?.Client && Array.isArray(interceptors.Client) ? (this[kInterceptors] = interceptors.Client, deprecatedInterceptorWarned || (deprecatedInterceptorWarned = !0, process.emitWarning("Client.Options#interceptor is deprecated. Use Dispatcher#compose instead.", {
          code: "UNDICI-CLIENT-INTERCEPTOR-DEPRECATED"
        }))) : this[kInterceptors] = [createRedirectInterceptor({ maxRedirections })], this[kUrl] = util.parseOrigin(url), this[kConnector] = connect2, this[kPipelining] = pipelining ?? 1, this[kMaxHeadersSize] = maxHeaderSize || http.maxHeaderSize, this[kKeepAliveDefaultTimeout] = keepAliveTimeout ?? 4e3, this[kKeepAliveMaxTimeout] = keepAliveMaxTimeout ?? 6e5, this[kKeepAliveTimeoutThreshold] = keepAliveTimeoutThreshold ?? 2e3, this[kKeepAliveTimeoutValue] = this[kKeepAliveDefaultTimeout], this[kServerName] = null, this[kLocalAddress] = localAddress ?? null, this[kResuming] = 0, this[kNeedDrain] = 0, this[kHostHeader] = `host: ${this[kUrl].hostname}${this[kUrl].port ? `:${this[kUrl].port}` : ""}\r
`, this[kBodyTimeout] = bodyTimeout ?? 3e5, this[kHeadersTimeout] = headersTimeout ?? 3e5, this[kStrictContentLength] = strictContentLength ?? !0, this[kMaxRedirections] = maxRedirections, this[kMaxRequests] = maxRequestsPerClient, this[kClosedResolve] = null, this[kMaxResponseSize] = maxResponseSize > -1 ? maxResponseSize : -1, this[kMaxConcurrentStreams] = maxConcurrentStreams ?? 100, this[kHTTPContext] = null, this[kQueue] = [], this[kRunningIdx] = 0, this[kPendingIdx] = 0, this[kResume] = (sync) => resume(this, sync), this[kOnError] = (err) => onError(this, err);
      }
      get pipelining() {
        return this[kPipelining];
      }
      set pipelining(value) {
        this[kPipelining] = value, this[kResume](!0);
      }
      get [kPending]() {
        return this[kQueue].length - this[kPendingIdx];
      }
      get [kRunning]() {
        return this[kPendingIdx] - this[kRunningIdx];
      }
      get [kSize]() {
        return this[kQueue].length - this[kRunningIdx];
      }
      get [kConnected]() {
        return !!this[kHTTPContext] && !this[kConnecting] && !this[kHTTPContext].destroyed;
      }
      get [kBusy]() {
        return !!(this[kHTTPContext]?.busy(null) || this[kSize] >= (getPipelining(this) || 1) || this[kPending] > 0);
      }
      /* istanbul ignore: only used for test */
      [kConnect](cb) {
        connect(this), this.once("connect", cb);
      }
      [kDispatch](opts, handler) {
        let origin = opts.origin || this[kUrl].origin, request = new Request(origin, opts, handler);
        return this[kQueue].push(request), this[kResuming] || (util.bodyLength(request.body) == null && util.isIterable(request.body) ? (this[kResuming] = 1, queueMicrotask(() => resume(this))) : this[kResume](!0)), this[kResuming] && this[kNeedDrain] !== 2 && this[kBusy] && (this[kNeedDrain] = 2), this[kNeedDrain] < 2;
      }
      async [kClose]() {
        return new Promise((resolve2) => {
          this[kSize] ? this[kClosedResolve] = resolve2 : resolve2(null);
        });
      }
      async [kDestroy](err) {
        return new Promise((resolve2) => {
          let requests = this[kQueue].splice(this[kPendingIdx]);
          for (let i = 0; i < requests.length; i++) {
            let request = requests[i];
            util.errorRequest(this, request, err);
          }
          let callback = () => {
            this[kClosedResolve] && (this[kClosedResolve](), this[kClosedResolve] = null), resolve2(null);
          };
          this[kHTTPContext] ? (this[kHTTPContext].destroy(err, callback), this[kHTTPContext] = null) : queueMicrotask(callback), this[kResume]();
        });
      }
    }, createRedirectInterceptor = require_redirect_interceptor();
    function onError(client, err) {
      if (client[kRunning] === 0 && err.code !== "UND_ERR_INFO" && err.code !== "UND_ERR_SOCKET") {
        assert(client[kPendingIdx] === client[kRunningIdx]);
        let requests = client[kQueue].splice(client[kRunningIdx]);
        for (let i = 0; i < requests.length; i++) {
          let request = requests[i];
          util.errorRequest(client, request, err);
        }
        assert(client[kSize] === 0);
      }
    }
    async function connect(client) {
      assert(!client[kConnecting]), assert(!client[kHTTPContext]);
      let { host, hostname, protocol, port } = client[kUrl];
      if (hostname[0] === "[") {
        let idx = hostname.indexOf("]");
        assert(idx !== -1);
        let ip = hostname.substring(1, idx);
        assert(net.isIP(ip)), hostname = ip;
      }
      client[kConnecting] = !0, channels.beforeConnect.hasSubscribers && channels.beforeConnect.publish({
        connectParams: {
          host,
          hostname,
          protocol,
          port,
          version: client[kHTTPContext]?.version,
          servername: client[kServerName],
          localAddress: client[kLocalAddress]
        },
        connector: client[kConnector]
      });
      try {
        let socket = await new Promise((resolve2, reject) => {
          client[kConnector]({
            host,
            hostname,
            protocol,
            port,
            servername: client[kServerName],
            localAddress: client[kLocalAddress]
          }, (err, socket2) => {
            err ? reject(err) : resolve2(socket2);
          });
        });
        if (client.destroyed) {
          util.destroy(socket.on("error", noop), new ClientDestroyedError());
          return;
        }
        assert(socket);
        try {
          client[kHTTPContext] = socket.alpnProtocol === "h2" ? await connectH2(client, socket) : await connectH1(client, socket);
        } catch (err) {
          throw socket.destroy().on("error", noop), err;
        }
        client[kConnecting] = !1, socket[kCounter] = 0, socket[kMaxRequests] = client[kMaxRequests], socket[kClient] = client, socket[kError] = null, channels.connected.hasSubscribers && channels.connected.publish({
          connectParams: {
            host,
            hostname,
            protocol,
            port,
            version: client[kHTTPContext]?.version,
            servername: client[kServerName],
            localAddress: client[kLocalAddress]
          },
          connector: client[kConnector],
          socket
        }), client.emit("connect", client[kUrl], [client]);
      } catch (err) {
        if (client.destroyed)
          return;
        if (client[kConnecting] = !1, channels.connectError.hasSubscribers && channels.connectError.publish({
          connectParams: {
            host,
            hostname,
            protocol,
            port,
            version: client[kHTTPContext]?.version,
            servername: client[kServerName],
            localAddress: client[kLocalAddress]
          },
          connector: client[kConnector],
          error: err
        }), err.code === "ERR_TLS_CERT_ALTNAME_INVALID")
          for (assert(client[kRunning] === 0); client[kPending] > 0 && client[kQueue][client[kPendingIdx]].servername === client[kServerName]; ) {
            let request = client[kQueue][client[kPendingIdx]++];
            util.errorRequest(client, request, err);
          }
        else
          onError(client, err);
        client.emit("connectionError", client[kUrl], [client], err);
      }
      client[kResume]();
    }
    function emitDrain(client) {
      client[kNeedDrain] = 0, client.emit("drain", client[kUrl], [client]);
    }
    function resume(client, sync) {
      client[kResuming] !== 2 && (client[kResuming] = 2, _resume(client, sync), client[kResuming] = 0, client[kRunningIdx] > 256 && (client[kQueue].splice(0, client[kRunningIdx]), client[kPendingIdx] -= client[kRunningIdx], client[kRunningIdx] = 0));
    }
    function _resume(client, sync) {
      for (; ; ) {
        if (client.destroyed) {
          assert(client[kPending] === 0);
          return;
        }
        if (client[kClosedResolve] && !client[kSize]) {
          client[kClosedResolve](), client[kClosedResolve] = null;
          return;
        }
        if (client[kHTTPContext] && client[kHTTPContext].resume(), client[kBusy])
          client[kNeedDrain] = 2;
        else if (client[kNeedDrain] === 2) {
          sync ? (client[kNeedDrain] = 1, queueMicrotask(() => emitDrain(client))) : emitDrain(client);
          continue;
        }
        if (client[kPending] === 0 || client[kRunning] >= (getPipelining(client) || 1))
          return;
        let request = client[kQueue][client[kPendingIdx]];
        if (client[kUrl].protocol === "https:" && client[kServerName] !== request.servername) {
          if (client[kRunning] > 0)
            return;
          client[kServerName] = request.servername, client[kHTTPContext]?.destroy(new InformationalError("servername changed"), () => {
            client[kHTTPContext] = null, resume(client);
          });
        }
        if (client[kConnecting])
          return;
        if (!client[kHTTPContext]) {
          connect(client);
          return;
        }
        if (client[kHTTPContext].destroyed || client[kHTTPContext].busy(request))
          return;
        !request.aborted && client[kHTTPContext].write(request) ? client[kPendingIdx]++ : client[kQueue].splice(client[kPendingIdx], 1);
      }
    }
    module.exports = Client;
  }
});

// node_modules/undici/lib/dispatcher/fixed-queue.js
var require_fixed_queue = __commonJS({
  "node_modules/undici/lib/dispatcher/fixed-queue.js"(exports, module) {
    "use strict";
    var FixedCircularBuffer = class {
      constructor() {
        this.bottom = 0, this.top = 0, this.list = new Array(2048), this.next = null;
      }
      isEmpty() {
        return this.top === this.bottom;
      }
      isFull() {
        return (this.top + 1 & 2047) === this.bottom;
      }
      push(data) {
        this.list[this.top] = data, this.top = this.top + 1 & 2047;
      }
      shift() {
        let nextItem = this.list[this.bottom];
        return nextItem === void 0 ? null : (this.list[this.bottom] = void 0, this.bottom = this.bottom + 1 & 2047, nextItem);
      }
    };
    module.exports = class {
      constructor() {
        this.head = this.tail = new FixedCircularBuffer();
      }
      isEmpty() {
        return this.head.isEmpty();
      }
      push(data) {
        this.head.isFull() && (this.head = this.head.next = new FixedCircularBuffer()), this.head.push(data);
      }
      shift() {
        let tail = this.tail, next = tail.shift();
        return tail.isEmpty() && tail.next !== null && (this.tail = tail.next), next;
      }
    };
  }
});

// node_modules/undici/lib/dispatcher/pool-stats.js
var require_pool_stats = __commonJS({
  "node_modules/undici/lib/dispatcher/pool-stats.js"(exports, module) {
    var { kFree, kConnected, kPending, kQueued, kRunning, kSize } = require_symbols(), kPool = /* @__PURE__ */ Symbol("pool"), PoolStats = class {
      constructor(pool) {
        this[kPool] = pool;
      }
      get connected() {
        return this[kPool][kConnected];
      }
      get free() {
        return this[kPool][kFree];
      }
      get pending() {
        return this[kPool][kPending];
      }
      get queued() {
        return this[kPool][kQueued];
      }
      get running() {
        return this[kPool][kRunning];
      }
      get size() {
        return this[kPool][kSize];
      }
    };
    module.exports = PoolStats;
  }
});

// node_modules/undici/lib/dispatcher/pool-base.js
var require_pool_base = __commonJS({
  "node_modules/undici/lib/dispatcher/pool-base.js"(exports, module) {
    "use strict";
    var DispatcherBase = require_dispatcher_base(), FixedQueue = require_fixed_queue(), { kConnected, kSize, kRunning, kPending, kQueued, kBusy, kFree, kUrl, kClose, kDestroy, kDispatch } = require_symbols(), PoolStats = require_pool_stats(), kClients = /* @__PURE__ */ Symbol("clients"), kNeedDrain = /* @__PURE__ */ Symbol("needDrain"), kQueue = /* @__PURE__ */ Symbol("queue"), kClosedResolve = /* @__PURE__ */ Symbol("closed resolve"), kOnDrain = /* @__PURE__ */ Symbol("onDrain"), kOnConnect = /* @__PURE__ */ Symbol("onConnect"), kOnDisconnect = /* @__PURE__ */ Symbol("onDisconnect"), kOnConnectionError = /* @__PURE__ */ Symbol("onConnectionError"), kGetDispatcher = /* @__PURE__ */ Symbol("get dispatcher"), kAddClient = /* @__PURE__ */ Symbol("add client"), kRemoveClient = /* @__PURE__ */ Symbol("remove client"), kStats = /* @__PURE__ */ Symbol("stats"), PoolBase = class extends DispatcherBase {
      constructor(opts) {
        super(opts), this[kQueue] = new FixedQueue(), this[kClients] = [], this[kQueued] = 0;
        let pool = this;
        this[kOnDrain] = function(origin, targets) {
          let queue = pool[kQueue], needDrain = !1;
          for (; !needDrain; ) {
            let item = queue.shift();
            if (!item)
              break;
            pool[kQueued]--, needDrain = !this.dispatch(item.opts, item.handler);
          }
          this[kNeedDrain] = needDrain, !this[kNeedDrain] && pool[kNeedDrain] && (pool[kNeedDrain] = !1, pool.emit("drain", origin, [pool, ...targets])), pool[kClosedResolve] && queue.isEmpty() && Promise.all(pool[kClients].map((c) => c.close())).then(pool[kClosedResolve]);
        }, this[kOnConnect] = (origin, targets) => {
          pool.emit("connect", origin, [pool, ...targets]);
        }, this[kOnDisconnect] = (origin, targets, err) => {
          pool.emit("disconnect", origin, [pool, ...targets], err);
        }, this[kOnConnectionError] = (origin, targets, err) => {
          pool.emit("connectionError", origin, [pool, ...targets], err);
        }, this[kStats] = new PoolStats(this);
      }
      get [kBusy]() {
        return this[kNeedDrain];
      }
      get [kConnected]() {
        return this[kClients].filter((client) => client[kConnected]).length;
      }
      get [kFree]() {
        return this[kClients].filter((client) => client[kConnected] && !client[kNeedDrain]).length;
      }
      get [kPending]() {
        let ret = this[kQueued];
        for (let { [kPending]: pending } of this[kClients])
          ret += pending;
        return ret;
      }
      get [kRunning]() {
        let ret = 0;
        for (let { [kRunning]: running } of this[kClients])
          ret += running;
        return ret;
      }
      get [kSize]() {
        let ret = this[kQueued];
        for (let { [kSize]: size } of this[kClients])
          ret += size;
        return ret;
      }
      get stats() {
        return this[kStats];
      }
      async [kClose]() {
        this[kQueue].isEmpty() ? await Promise.all(this[kClients].map((c) => c.close())) : await new Promise((resolve2) => {
          this[kClosedResolve] = resolve2;
        });
      }
      async [kDestroy](err) {
        for (; ; ) {
          let item = this[kQueue].shift();
          if (!item)
            break;
          item.handler.onError(err);
        }
        await Promise.all(this[kClients].map((c) => c.destroy(err)));
      }
      [kDispatch](opts, handler) {
        let dispatcher = this[kGetDispatcher]();
        return dispatcher ? dispatcher.dispatch(opts, handler) || (dispatcher[kNeedDrain] = !0, this[kNeedDrain] = !this[kGetDispatcher]()) : (this[kNeedDrain] = !0, this[kQueue].push({ opts, handler }), this[kQueued]++), !this[kNeedDrain];
      }
      [kAddClient](client) {
        return client.on("drain", this[kOnDrain]).on("connect", this[kOnConnect]).on("disconnect", this[kOnDisconnect]).on("connectionError", this[kOnConnectionError]), this[kClients].push(client), this[kNeedDrain] && queueMicrotask(() => {
          this[kNeedDrain] && this[kOnDrain](client[kUrl], [this, client]);
        }), this;
      }
      [kRemoveClient](client) {
        client.close(() => {
          let idx = this[kClients].indexOf(client);
          idx !== -1 && this[kClients].splice(idx, 1);
        }), this[kNeedDrain] = this[kClients].some((dispatcher) => !dispatcher[kNeedDrain] && dispatcher.closed !== !0 && dispatcher.destroyed !== !0);
      }
    };
    module.exports = {
      PoolBase,
      kClients,
      kNeedDrain,
      kAddClient,
      kRemoveClient,
      kGetDispatcher
    };
  }
});

// node_modules/undici/lib/dispatcher/pool.js
var require_pool = __commonJS({
  "node_modules/undici/lib/dispatcher/pool.js"(exports, module) {
    "use strict";
    var {
      PoolBase,
      kClients,
      kNeedDrain,
      kAddClient,
      kGetDispatcher
    } = require_pool_base(), Client = require_client(), {
      InvalidArgumentError
    } = require_errors(), util = require_util(), { kUrl, kInterceptors } = require_symbols(), buildConnector = require_connect(), kOptions = /* @__PURE__ */ Symbol("options"), kConnections = /* @__PURE__ */ Symbol("connections"), kFactory = /* @__PURE__ */ Symbol("factory");
    function defaultFactory(origin, opts) {
      return new Client(origin, opts);
    }
    var Pool = class extends PoolBase {
      constructor(origin, {
        connections,
        factory = defaultFactory,
        connect,
        connectTimeout,
        tls,
        maxCachedSessions,
        socketPath,
        autoSelectFamily,
        autoSelectFamilyAttemptTimeout,
        allowH2,
        ...options
      } = {}) {
        if (connections != null && (!Number.isFinite(connections) || connections < 0))
          throw new InvalidArgumentError("invalid connections");
        if (typeof factory != "function")
          throw new InvalidArgumentError("factory must be a function.");
        if (connect != null && typeof connect != "function" && typeof connect != "object")
          throw new InvalidArgumentError("connect must be a function or an object");
        typeof connect != "function" && (connect = buildConnector({
          ...tls,
          maxCachedSessions,
          allowH2,
          socketPath,
          timeout: connectTimeout,
          ...autoSelectFamily ? { autoSelectFamily, autoSelectFamilyAttemptTimeout } : void 0,
          ...connect
        })), super(options), this[kInterceptors] = options.interceptors?.Pool && Array.isArray(options.interceptors.Pool) ? options.interceptors.Pool : [], this[kConnections] = connections || null, this[kUrl] = util.parseOrigin(origin), this[kOptions] = { ...util.deepClone(options), connect, allowH2 }, this[kOptions].interceptors = options.interceptors ? { ...options.interceptors } : void 0, this[kFactory] = factory, this.on("connectionError", (origin2, targets, error2) => {
          for (let target of targets) {
            let idx = this[kClients].indexOf(target);
            idx !== -1 && this[kClients].splice(idx, 1);
          }
        });
      }
      [kGetDispatcher]() {
        for (let client of this[kClients])
          if (!client[kNeedDrain])
            return client;
        if (!this[kConnections] || this[kClients].length < this[kConnections]) {
          let dispatcher = this[kFactory](this[kUrl], this[kOptions]);
          return this[kAddClient](dispatcher), dispatcher;
        }
      }
    };
    module.exports = Pool;
  }
});

// node_modules/undici/lib/dispatcher/balanced-pool.js
var require_balanced_pool = __commonJS({
  "node_modules/undici/lib/dispatcher/balanced-pool.js"(exports, module) {
    "use strict";
    var {
      BalancedPoolMissingUpstreamError,
      InvalidArgumentError
    } = require_errors(), {
      PoolBase,
      kClients,
      kNeedDrain,
      kAddClient,
      kRemoveClient,
      kGetDispatcher
    } = require_pool_base(), Pool = require_pool(), { kUrl, kInterceptors } = require_symbols(), { parseOrigin } = require_util(), kFactory = /* @__PURE__ */ Symbol("factory"), kOptions = /* @__PURE__ */ Symbol("options"), kGreatestCommonDivisor = /* @__PURE__ */ Symbol("kGreatestCommonDivisor"), kCurrentWeight = /* @__PURE__ */ Symbol("kCurrentWeight"), kIndex = /* @__PURE__ */ Symbol("kIndex"), kWeight = /* @__PURE__ */ Symbol("kWeight"), kMaxWeightPerServer = /* @__PURE__ */ Symbol("kMaxWeightPerServer"), kErrorPenalty = /* @__PURE__ */ Symbol("kErrorPenalty");
    function getGreatestCommonDivisor(a, b) {
      if (a === 0) return b;
      for (; b !== 0; ) {
        let t = b;
        b = a % b, a = t;
      }
      return a;
    }
    function defaultFactory(origin, opts) {
      return new Pool(origin, opts);
    }
    var BalancedPool = class extends PoolBase {
      constructor(upstreams = [], { factory = defaultFactory, ...opts } = {}) {
        if (super(), this[kOptions] = opts, this[kIndex] = -1, this[kCurrentWeight] = 0, this[kMaxWeightPerServer] = this[kOptions].maxWeightPerServer || 100, this[kErrorPenalty] = this[kOptions].errorPenalty || 15, Array.isArray(upstreams) || (upstreams = [upstreams]), typeof factory != "function")
          throw new InvalidArgumentError("factory must be a function.");
        this[kInterceptors] = opts.interceptors?.BalancedPool && Array.isArray(opts.interceptors.BalancedPool) ? opts.interceptors.BalancedPool : [], this[kFactory] = factory;
        for (let upstream of upstreams)
          this.addUpstream(upstream);
        this._updateBalancedPoolStats();
      }
      addUpstream(upstream) {
        let upstreamOrigin = parseOrigin(upstream).origin;
        if (this[kClients].find((pool2) => pool2[kUrl].origin === upstreamOrigin && pool2.closed !== !0 && pool2.destroyed !== !0))
          return this;
        let pool = this[kFactory](upstreamOrigin, Object.assign({}, this[kOptions]));
        this[kAddClient](pool), pool.on("connect", () => {
          pool[kWeight] = Math.min(this[kMaxWeightPerServer], pool[kWeight] + this[kErrorPenalty]);
        }), pool.on("connectionError", () => {
          pool[kWeight] = Math.max(1, pool[kWeight] - this[kErrorPenalty]), this._updateBalancedPoolStats();
        }), pool.on("disconnect", (...args) => {
          let err = args[2];
          err && err.code === "UND_ERR_SOCKET" && (pool[kWeight] = Math.max(1, pool[kWeight] - this[kErrorPenalty]), this._updateBalancedPoolStats());
        });
        for (let client of this[kClients])
          client[kWeight] = this[kMaxWeightPerServer];
        return this._updateBalancedPoolStats(), this;
      }
      _updateBalancedPoolStats() {
        let result = 0;
        for (let i = 0; i < this[kClients].length; i++)
          result = getGreatestCommonDivisor(this[kClients][i][kWeight], result);
        this[kGreatestCommonDivisor] = result;
      }
      removeUpstream(upstream) {
        let upstreamOrigin = parseOrigin(upstream).origin, pool = this[kClients].find((pool2) => pool2[kUrl].origin === upstreamOrigin && pool2.closed !== !0 && pool2.destroyed !== !0);
        return pool && this[kRemoveClient](pool), this;
      }
      get upstreams() {
        return this[kClients].filter((dispatcher) => dispatcher.closed !== !0 && dispatcher.destroyed !== !0).map((p) => p[kUrl].origin);
      }
      [kGetDispatcher]() {
        if (this[kClients].length === 0)
          throw new BalancedPoolMissingUpstreamError();
        if (!this[kClients].find((dispatcher2) => !dispatcher2[kNeedDrain] && dispatcher2.closed !== !0 && dispatcher2.destroyed !== !0) || this[kClients].map((pool) => pool[kNeedDrain]).reduce((a, b) => a && b, !0))
          return;
        let counter = 0, maxWeightIndex = this[kClients].findIndex((pool) => !pool[kNeedDrain]);
        for (; counter++ < this[kClients].length; ) {
          this[kIndex] = (this[kIndex] + 1) % this[kClients].length;
          let pool = this[kClients][this[kIndex]];
          if (pool[kWeight] > this[kClients][maxWeightIndex][kWeight] && !pool[kNeedDrain] && (maxWeightIndex = this[kIndex]), this[kIndex] === 0 && (this[kCurrentWeight] = this[kCurrentWeight] - this[kGreatestCommonDivisor], this[kCurrentWeight] <= 0 && (this[kCurrentWeight] = this[kMaxWeightPerServer])), pool[kWeight] >= this[kCurrentWeight] && !pool[kNeedDrain])
            return pool;
        }
        return this[kCurrentWeight] = this[kClients][maxWeightIndex][kWeight], this[kIndex] = maxWeightIndex, this[kClients][maxWeightIndex];
      }
    };
    module.exports = BalancedPool;
  }
});

// node_modules/undici/lib/dispatcher/agent.js
var require_agent = __commonJS({
  "node_modules/undici/lib/dispatcher/agent.js"(exports, module) {
    "use strict";
    var { InvalidArgumentError } = require_errors(), { kClients, kRunning, kClose, kDestroy, kDispatch, kInterceptors } = require_symbols(), DispatcherBase = require_dispatcher_base(), Pool = require_pool(), Client = require_client(), util = require_util(), createRedirectInterceptor = require_redirect_interceptor(), kOnConnect = /* @__PURE__ */ Symbol("onConnect"), kOnDisconnect = /* @__PURE__ */ Symbol("onDisconnect"), kOnConnectionError = /* @__PURE__ */ Symbol("onConnectionError"), kMaxRedirections = /* @__PURE__ */ Symbol("maxRedirections"), kOnDrain = /* @__PURE__ */ Symbol("onDrain"), kFactory = /* @__PURE__ */ Symbol("factory"), kOptions = /* @__PURE__ */ Symbol("options");
    function defaultFactory(origin, opts) {
      return opts && opts.connections === 1 ? new Client(origin, opts) : new Pool(origin, opts);
    }
    var Agent = class extends DispatcherBase {
      constructor({ factory = defaultFactory, maxRedirections = 0, connect, ...options } = {}) {
        if (typeof factory != "function")
          throw new InvalidArgumentError("factory must be a function.");
        if (connect != null && typeof connect != "function" && typeof connect != "object")
          throw new InvalidArgumentError("connect must be a function or an object");
        if (!Number.isInteger(maxRedirections) || maxRedirections < 0)
          throw new InvalidArgumentError("maxRedirections must be a positive number");
        super(options), connect && typeof connect != "function" && (connect = { ...connect }), this[kInterceptors] = options.interceptors?.Agent && Array.isArray(options.interceptors.Agent) ? options.interceptors.Agent : [createRedirectInterceptor({ maxRedirections })], this[kOptions] = { ...util.deepClone(options), connect }, this[kOptions].interceptors = options.interceptors ? { ...options.interceptors } : void 0, this[kMaxRedirections] = maxRedirections, this[kFactory] = factory, this[kClients] = /* @__PURE__ */ new Map(), this[kOnDrain] = (origin, targets) => {
          this.emit("drain", origin, [this, ...targets]);
        }, this[kOnConnect] = (origin, targets) => {
          this.emit("connect", origin, [this, ...targets]);
        }, this[kOnDisconnect] = (origin, targets, err) => {
          this.emit("disconnect", origin, [this, ...targets], err);
        }, this[kOnConnectionError] = (origin, targets, err) => {
          this.emit("connectionError", origin, [this, ...targets], err);
        };
      }
      get [kRunning]() {
        let ret = 0;
        for (let client of this[kClients].values())
          ret += client[kRunning];
        return ret;
      }
      [kDispatch](opts, handler) {
        let key;
        if (opts.origin && (typeof opts.origin == "string" || opts.origin instanceof URL))
          key = String(opts.origin);
        else
          throw new InvalidArgumentError("opts.origin must be a non-empty string or URL.");
        let dispatcher = this[kClients].get(key);
        return dispatcher || (dispatcher = this[kFactory](opts.origin, this[kOptions]).on("drain", this[kOnDrain]).on("connect", this[kOnConnect]).on("disconnect", this[kOnDisconnect]).on("connectionError", this[kOnConnectionError]), this[kClients].set(key, dispatcher)), dispatcher.dispatch(opts, handler);
      }
      async [kClose]() {
        let closePromises = [];
        for (let client of this[kClients].values())
          closePromises.push(client.close());
        this[kClients].clear(), await Promise.all(closePromises);
      }
      async [kDestroy](err) {
        let destroyPromises = [];
        for (let client of this[kClients].values())
          destroyPromises.push(client.destroy(err));
        this[kClients].clear(), await Promise.all(destroyPromises);
      }
    };
    module.exports = Agent;
  }
});

// node_modules/undici/lib/dispatcher/proxy-agent.js
var require_proxy_agent = __commonJS({
  "node_modules/undici/lib/dispatcher/proxy-agent.js"(exports, module) {
    "use strict";
    var { kProxy, kClose, kDestroy, kDispatch, kInterceptors } = require_symbols(), { URL: URL2 } = __require("node:url"), Agent = require_agent(), Pool = require_pool(), DispatcherBase = require_dispatcher_base(), { InvalidArgumentError, RequestAbortedError, SecureProxyConnectionError } = require_errors(), buildConnector = require_connect(), Client = require_client(), kAgent = /* @__PURE__ */ Symbol("proxy agent"), kClient = /* @__PURE__ */ Symbol("proxy client"), kProxyHeaders = /* @__PURE__ */ Symbol("proxy headers"), kRequestTls = /* @__PURE__ */ Symbol("request tls settings"), kProxyTls = /* @__PURE__ */ Symbol("proxy tls settings"), kConnectEndpoint = /* @__PURE__ */ Symbol("connect endpoint function"), kTunnelProxy = /* @__PURE__ */ Symbol("tunnel proxy");
    function defaultProtocolPort(protocol) {
      return protocol === "https:" ? 443 : 80;
    }
    function defaultFactory(origin, opts) {
      return new Pool(origin, opts);
    }
    var noop = () => {
    };
    function defaultAgentFactory(origin, opts) {
      return opts.connections === 1 ? new Client(origin, opts) : new Pool(origin, opts);
    }
    var Http1ProxyWrapper = class extends DispatcherBase {
      #client;
      constructor(proxyUrl, { headers = {}, connect, factory }) {
        if (super(), !proxyUrl)
          throw new InvalidArgumentError("Proxy URL is mandatory");
        this[kProxyHeaders] = headers, factory ? this.#client = factory(proxyUrl, { connect }) : this.#client = new Client(proxyUrl, { connect });
      }
      [kDispatch](opts, handler) {
        let onHeaders = handler.onHeaders;
        handler.onHeaders = function(statusCode, data, resume) {
          if (statusCode === 407) {
            typeof handler.onError == "function" && handler.onError(new InvalidArgumentError("Proxy Authentication Required (407)"));
            return;
          }
          onHeaders && onHeaders.call(this, statusCode, data, resume);
        };
        let {
          origin,
          path: path4 = "/",
          headers = {}
        } = opts;
        if (opts.path = origin + path4, !("host" in headers) && !("Host" in headers)) {
          let { host } = new URL2(origin);
          headers.host = host;
        }
        return opts.headers = { ...this[kProxyHeaders], ...headers }, this.#client[kDispatch](opts, handler);
      }
      async [kClose]() {
        return this.#client.close();
      }
      async [kDestroy](err) {
        return this.#client.destroy(err);
      }
    }, ProxyAgent2 = class extends DispatcherBase {
      constructor(opts) {
        if (super(), !opts || typeof opts == "object" && !(opts instanceof URL2) && !opts.uri)
          throw new InvalidArgumentError("Proxy uri is mandatory");
        let { clientFactory = defaultFactory } = opts;
        if (typeof clientFactory != "function")
          throw new InvalidArgumentError("Proxy opts.clientFactory must be a function.");
        let { proxyTunnel = !0 } = opts, url = this.#getUrl(opts), { href, origin, port, protocol, username, password, hostname: proxyHostname } = url;
        if (this[kProxy] = { uri: href, protocol }, this[kInterceptors] = opts.interceptors?.ProxyAgent && Array.isArray(opts.interceptors.ProxyAgent) ? opts.interceptors.ProxyAgent : [], this[kRequestTls] = opts.requestTls, this[kProxyTls] = opts.proxyTls, this[kProxyHeaders] = opts.headers || {}, this[kTunnelProxy] = proxyTunnel, opts.auth && opts.token)
          throw new InvalidArgumentError("opts.auth cannot be used in combination with opts.token");
        opts.auth ? this[kProxyHeaders]["proxy-authorization"] = `Basic ${opts.auth}` : opts.token ? this[kProxyHeaders]["proxy-authorization"] = opts.token : username && password && (this[kProxyHeaders]["proxy-authorization"] = `Basic ${Buffer.from(`${decodeURIComponent(username)}:${decodeURIComponent(password)}`).toString("base64")}`);
        let connect = buildConnector({ ...opts.proxyTls });
        this[kConnectEndpoint] = buildConnector({ ...opts.requestTls });
        let agentFactory = opts.factory || defaultAgentFactory, factory = (origin2, options) => {
          let { protocol: protocol2 } = new URL2(origin2);
          return !this[kTunnelProxy] && protocol2 === "http:" && this[kProxy].protocol === "http:" ? new Http1ProxyWrapper(this[kProxy].uri, {
            headers: this[kProxyHeaders],
            connect,
            factory: agentFactory
          }) : agentFactory(origin2, options);
        };
        this[kClient] = clientFactory(url, { connect }), this[kAgent] = new Agent({
          ...opts,
          factory,
          connect: async (opts2, callback) => {
            let requestedPath = opts2.host;
            opts2.port || (requestedPath += `:${defaultProtocolPort(opts2.protocol)}`);
            try {
              let { socket, statusCode } = await this[kClient].connect({
                origin,
                port,
                path: requestedPath,
                signal: opts2.signal,
                headers: {
                  ...this[kProxyHeaders],
                  host: opts2.host
                },
                servername: this[kProxyTls]?.servername || proxyHostname
              });
              if (statusCode !== 200 && (socket.on("error", noop).destroy(), callback(new RequestAbortedError(`Proxy response (${statusCode}) !== 200 when HTTP Tunneling`))), opts2.protocol !== "https:") {
                callback(null, socket);
                return;
              }
              let servername;
              this[kRequestTls] ? servername = this[kRequestTls].servername : servername = opts2.servername, this[kConnectEndpoint]({ ...opts2, servername, httpSocket: socket }, callback);
            } catch (err) {
              err.code === "ERR_TLS_CERT_ALTNAME_INVALID" ? callback(new SecureProxyConnectionError(err)) : callback(err);
            }
          }
        });
      }
      dispatch(opts, handler) {
        let headers = buildHeaders(opts.headers);
        if (throwIfProxyAuthIsSent(headers), headers && !("host" in headers) && !("Host" in headers)) {
          let { host } = new URL2(opts.origin);
          headers.host = host;
        }
        return this[kAgent].dispatch(
          {
            ...opts,
            headers
          },
          handler
        );
      }
      /**
       * @param {import('../types/proxy-agent').ProxyAgent.Options | string | URL} opts
       * @returns {URL}
       */
      #getUrl(opts) {
        return typeof opts == "string" ? new URL2(opts) : opts instanceof URL2 ? opts : new URL2(opts.uri);
      }
      async [kClose]() {
        await this[kAgent].close(), await this[kClient].close();
      }
      async [kDestroy]() {
        await this[kAgent].destroy(), await this[kClient].destroy();
      }
    };
    function buildHeaders(headers) {
      if (Array.isArray(headers)) {
        let headersPair = {};
        for (let i = 0; i < headers.length; i += 2)
          headersPair[headers[i]] = headers[i + 1];
        return headersPair;
      }
      return headers;
    }
    function throwIfProxyAuthIsSent(headers) {
      if (headers && Object.keys(headers).find((key) => key.toLowerCase() === "proxy-authorization"))
        throw new InvalidArgumentError("Proxy-Authorization should be sent in ProxyAgent constructor");
    }
    module.exports = ProxyAgent2;
  }
});

// node_modules/undici/lib/dispatcher/env-http-proxy-agent.js
var require_env_http_proxy_agent = __commonJS({
  "node_modules/undici/lib/dispatcher/env-http-proxy-agent.js"(exports, module) {
    "use strict";
    var DispatcherBase = require_dispatcher_base(), { kClose, kDestroy, kClosed, kDestroyed, kDispatch, kNoProxyAgent, kHttpProxyAgent, kHttpsProxyAgent } = require_symbols(), ProxyAgent2 = require_proxy_agent(), Agent = require_agent(), DEFAULT_PORTS = {
      "http:": 80,
      "https:": 443
    }, experimentalWarned = !1, EnvHttpProxyAgent = class extends DispatcherBase {
      #noProxyValue = null;
      #noProxyEntries = null;
      #opts = null;
      constructor(opts = {}) {
        super(), this.#opts = opts, experimentalWarned || (experimentalWarned = !0, process.emitWarning("EnvHttpProxyAgent is experimental, expect them to change at any time.", {
          code: "UNDICI-EHPA"
        }));
        let { httpProxy, httpsProxy, noProxy, ...agentOpts } = opts;
        this[kNoProxyAgent] = new Agent(agentOpts);
        let HTTP_PROXY = httpProxy ?? process.env.http_proxy ?? process.env.HTTP_PROXY;
        HTTP_PROXY ? this[kHttpProxyAgent] = new ProxyAgent2({ ...agentOpts, uri: HTTP_PROXY }) : this[kHttpProxyAgent] = this[kNoProxyAgent];
        let HTTPS_PROXY = httpsProxy ?? process.env.https_proxy ?? process.env.HTTPS_PROXY;
        HTTPS_PROXY ? this[kHttpsProxyAgent] = new ProxyAgent2({ ...agentOpts, uri: HTTPS_PROXY }) : this[kHttpsProxyAgent] = this[kHttpProxyAgent], this.#parseNoProxy();
      }
      [kDispatch](opts, handler) {
        let url = new URL(opts.origin);
        return this.#getProxyAgentForUrl(url).dispatch(opts, handler);
      }
      async [kClose]() {
        await this[kNoProxyAgent].close(), this[kHttpProxyAgent][kClosed] || await this[kHttpProxyAgent].close(), this[kHttpsProxyAgent][kClosed] || await this[kHttpsProxyAgent].close();
      }
      async [kDestroy](err) {
        await this[kNoProxyAgent].destroy(err), this[kHttpProxyAgent][kDestroyed] || await this[kHttpProxyAgent].destroy(err), this[kHttpsProxyAgent][kDestroyed] || await this[kHttpsProxyAgent].destroy(err);
      }
      #getProxyAgentForUrl(url) {
        let { protocol, host: hostname, port } = url;
        return hostname = hostname.replace(/:\d*$/, "").toLowerCase(), port = Number.parseInt(port, 10) || DEFAULT_PORTS[protocol] || 0, this.#shouldProxy(hostname, port) ? protocol === "https:" ? this[kHttpsProxyAgent] : this[kHttpProxyAgent] : this[kNoProxyAgent];
      }
      #shouldProxy(hostname, port) {
        if (this.#noProxyChanged && this.#parseNoProxy(), this.#noProxyEntries.length === 0)
          return !0;
        if (this.#noProxyValue === "*")
          return !1;
        for (let i = 0; i < this.#noProxyEntries.length; i++) {
          let entry = this.#noProxyEntries[i];
          if (!(entry.port && entry.port !== port)) {
            if (/^[.*]/.test(entry.hostname)) {
              if (hostname.endsWith(entry.hostname.replace(/^\*/, "")))
                return !1;
            } else if (hostname === entry.hostname)
              return !1;
          }
        }
        return !0;
      }
      #parseNoProxy() {
        let noProxyValue = this.#opts.noProxy ?? this.#noProxyEnv, noProxySplit = noProxyValue.split(/[,\s]/), noProxyEntries = [];
        for (let i = 0; i < noProxySplit.length; i++) {
          let entry = noProxySplit[i];
          if (!entry)
            continue;
          let parsed = entry.match(/^(.+):(\d+)$/);
          noProxyEntries.push({
            hostname: (parsed ? parsed[1] : entry).toLowerCase(),
            port: parsed ? Number.parseInt(parsed[2], 10) : 0
          });
        }
        this.#noProxyValue = noProxyValue, this.#noProxyEntries = noProxyEntries;
      }
      get #noProxyChanged() {
        return this.#opts.noProxy !== void 0 ? !1 : this.#noProxyValue !== this.#noProxyEnv;
      }
      get #noProxyEnv() {
        return process.env.no_proxy ?? process.env.NO_PROXY ?? "";
      }
    };
    module.exports = EnvHttpProxyAgent;
  }
});

// node_modules/undici/lib/handler/retry-handler.js
var require_retry_handler = __commonJS({
  "node_modules/undici/lib/handler/retry-handler.js"(exports, module) {
    "use strict";
    var assert = __require("node:assert"), { kRetryHandlerDefaultRetry } = require_symbols(), { RequestRetryError } = require_errors(), {
      isDisturbed,
      parseHeaders,
      parseRangeHeader,
      wrapRequestBody
    } = require_util();
    function calculateRetryAfterHeader(retryAfter) {
      let current = Date.now();
      return new Date(retryAfter).getTime() - current;
    }
    var RetryHandler = class _RetryHandler {
      constructor(opts, handlers) {
        let { retryOptions, ...dispatchOpts } = opts, {
          // Retry scoped
          retry: retryFn,
          maxRetries,
          maxTimeout,
          minTimeout,
          timeoutFactor,
          // Response scoped
          methods,
          errorCodes,
          retryAfter,
          statusCodes
        } = retryOptions ?? {};
        this.dispatch = handlers.dispatch, this.handler = handlers.handler, this.opts = { ...dispatchOpts, body: wrapRequestBody(opts.body) }, this.abort = null, this.aborted = !1, this.retryOpts = {
          retry: retryFn ?? _RetryHandler[kRetryHandlerDefaultRetry],
          retryAfter: retryAfter ?? !0,
          maxTimeout: maxTimeout ?? 30 * 1e3,
          // 30s,
          minTimeout: minTimeout ?? 500,
          // .5s
          timeoutFactor: timeoutFactor ?? 2,
          maxRetries: maxRetries ?? 5,
          // What errors we should retry
          methods: methods ?? ["GET", "HEAD", "OPTIONS", "PUT", "DELETE", "TRACE"],
          // Indicates which errors to retry
          statusCodes: statusCodes ?? [500, 502, 503, 504, 429],
          // List of errors to retry
          errorCodes: errorCodes ?? [
            "ECONNRESET",
            "ECONNREFUSED",
            "ENOTFOUND",
            "ENETDOWN",
            "ENETUNREACH",
            "EHOSTDOWN",
            "EHOSTUNREACH",
            "EPIPE",
            "UND_ERR_SOCKET"
          ]
        }, this.retryCount = 0, this.retryCountCheckpoint = 0, this.start = 0, this.end = null, this.etag = null, this.resume = null, this.handler.onConnect((reason) => {
          this.aborted = !0, this.abort ? this.abort(reason) : this.reason = reason;
        });
      }
      onRequestSent() {
        this.handler.onRequestSent && this.handler.onRequestSent();
      }
      onUpgrade(statusCode, headers, socket) {
        this.handler.onUpgrade && this.handler.onUpgrade(statusCode, headers, socket);
      }
      onConnect(abort) {
        this.aborted ? abort(this.reason) : this.abort = abort;
      }
      onBodySent(chunk) {
        if (this.handler.onBodySent) return this.handler.onBodySent(chunk);
      }
      static [kRetryHandlerDefaultRetry](err, { state, opts }, cb) {
        let { statusCode, code, headers } = err, { method, retryOptions } = opts, {
          maxRetries,
          minTimeout,
          maxTimeout,
          timeoutFactor,
          statusCodes,
          errorCodes,
          methods
        } = retryOptions, { counter } = state;
        if (code && code !== "UND_ERR_REQ_RETRY" && !errorCodes.includes(code)) {
          cb(err);
          return;
        }
        if (Array.isArray(methods) && !methods.includes(method)) {
          cb(err);
          return;
        }
        if (statusCode != null && Array.isArray(statusCodes) && !statusCodes.includes(statusCode)) {
          cb(err);
          return;
        }
        if (counter > maxRetries) {
          cb(err);
          return;
        }
        let retryAfterHeader = headers?.["retry-after"];
        retryAfterHeader && (retryAfterHeader = Number(retryAfterHeader), retryAfterHeader = Number.isNaN(retryAfterHeader) ? calculateRetryAfterHeader(retryAfterHeader) : retryAfterHeader * 1e3);
        let retryTimeout = retryAfterHeader > 0 ? Math.min(retryAfterHeader, maxTimeout) : Math.min(minTimeout * timeoutFactor ** (counter - 1), maxTimeout);
        setTimeout(() => cb(null), retryTimeout);
      }
      onHeaders(statusCode, rawHeaders, resume, statusMessage) {
        let headers = parseHeaders(rawHeaders);
        if (this.retryCount += 1, statusCode >= 300)
          return this.retryOpts.statusCodes.includes(statusCode) === !1 ? this.handler.onHeaders(
            statusCode,
            rawHeaders,
            resume,
            statusMessage
          ) : (this.abort(
            new RequestRetryError("Request failed", statusCode, {
              headers,
              data: {
                count: this.retryCount
              }
            })
          ), !1);
        if (this.resume != null) {
          if (this.resume = null, statusCode !== 206 && (this.start > 0 || statusCode !== 200))
            return this.abort(
              new RequestRetryError("server does not support the range header and the payload was partially consumed", statusCode, {
                headers,
                data: { count: this.retryCount }
              })
            ), !1;
          let contentRange = parseRangeHeader(headers["content-range"]);
          if (!contentRange)
            return this.abort(
              new RequestRetryError("Content-Range mismatch", statusCode, {
                headers,
                data: { count: this.retryCount }
              })
            ), !1;
          if (this.etag != null && this.etag !== headers.etag)
            return this.abort(
              new RequestRetryError("ETag mismatch", statusCode, {
                headers,
                data: { count: this.retryCount }
              })
            ), !1;
          let { start, size, end = size - 1 } = contentRange;
          return assert(this.start === start, "content-range mismatch"), assert(this.end == null || this.end === end, "content-range mismatch"), this.resume = resume, !0;
        }
        if (this.end == null) {
          if (statusCode === 206) {
            let range = parseRangeHeader(headers["content-range"]);
            if (range == null)
              return this.handler.onHeaders(
                statusCode,
                rawHeaders,
                resume,
                statusMessage
              );
            let { start, size, end = size - 1 } = range;
            assert(
              start != null && Number.isFinite(start),
              "content-range mismatch"
            ), assert(end != null && Number.isFinite(end), "invalid content-length"), this.start = start, this.end = end;
          }
          if (this.end == null) {
            let contentLength = headers["content-length"];
            this.end = contentLength != null ? Number(contentLength) - 1 : null;
          }
          return assert(Number.isFinite(this.start)), assert(
            this.end == null || Number.isFinite(this.end),
            "invalid content-length"
          ), this.resume = resume, this.etag = headers.etag != null ? headers.etag : null, this.etag != null && this.etag.startsWith("W/") && (this.etag = null), this.handler.onHeaders(
            statusCode,
            rawHeaders,
            resume,
            statusMessage
          );
        }
        let err = new RequestRetryError("Request failed", statusCode, {
          headers,
          data: { count: this.retryCount }
        });
        return this.abort(err), !1;
      }
      onData(chunk) {
        return this.start += chunk.length, this.handler.onData(chunk);
      }
      onComplete(rawTrailers) {
        return this.retryCount = 0, this.handler.onComplete(rawTrailers);
      }
      onError(err) {
        if (this.aborted || isDisturbed(this.opts.body))
          return this.handler.onError(err);
        this.retryCount - this.retryCountCheckpoint > 0 ? this.retryCount = this.retryCountCheckpoint + (this.retryCount - this.retryCountCheckpoint) : this.retryCount += 1, this.retryOpts.retry(
          err,
          {
            state: { counter: this.retryCount },
            opts: { retryOptions: this.retryOpts, ...this.opts }
          },
          onRetry.bind(this)
        );
        function onRetry(err2) {
          if (err2 != null || this.aborted || isDisturbed(this.opts.body))
            return this.handler.onError(err2);
          if (this.start !== 0) {
            let headers = { range: `bytes=${this.start}-${this.end ?? ""}` };
            this.etag != null && (headers["if-match"] = this.etag), this.opts = {
              ...this.opts,
              headers: {
                ...this.opts.headers,
                ...headers
              }
            };
          }
          try {
            this.retryCountCheckpoint = this.retryCount, this.dispatch(this.opts, this);
          } catch (err3) {
            this.handler.onError(err3);
          }
        }
      }
    };
    module.exports = RetryHandler;
  }
});

// node_modules/undici/lib/dispatcher/retry-agent.js
var require_retry_agent = __commonJS({
  "node_modules/undici/lib/dispatcher/retry-agent.js"(exports, module) {
    "use strict";
    var Dispatcher = require_dispatcher(), RetryHandler = require_retry_handler(), RetryAgent = class extends Dispatcher {
      #agent = null;
      #options = null;
      constructor(agent, options = {}) {
        super(options), this.#agent = agent, this.#options = options;
      }
      dispatch(opts, handler) {
        let retry = new RetryHandler({
          ...opts,
          retryOptions: this.#options
        }, {
          dispatch: this.#agent.dispatch.bind(this.#agent),
          handler
        });
        return this.#agent.dispatch(opts, retry);
      }
      close() {
        return this.#agent.close();
      }
      destroy() {
        return this.#agent.destroy();
      }
    };
    module.exports = RetryAgent;
  }
});

// node_modules/undici/lib/api/readable.js
var require_readable = __commonJS({
  "node_modules/undici/lib/api/readable.js"(exports, module) {
    "use strict";
    var assert = __require("node:assert"), { Readable } = __require("node:stream"), { RequestAbortedError, NotSupportedError, InvalidArgumentError, AbortError } = require_errors(), util = require_util(), { ReadableStreamFrom } = require_util(), kConsume = /* @__PURE__ */ Symbol("kConsume"), kReading = /* @__PURE__ */ Symbol("kReading"), kBody = /* @__PURE__ */ Symbol("kBody"), kAbort = /* @__PURE__ */ Symbol("kAbort"), kContentType = /* @__PURE__ */ Symbol("kContentType"), kContentLength = /* @__PURE__ */ Symbol("kContentLength"), noop = () => {
    }, BodyReadable = class extends Readable {
      constructor({
        resume,
        abort,
        contentType = "",
        contentLength,
        highWaterMark = 64 * 1024
        // Same as nodejs fs streams.
      }) {
        super({
          autoDestroy: !0,
          read: resume,
          highWaterMark
        }), this._readableState.dataEmitted = !1, this[kAbort] = abort, this[kConsume] = null, this[kBody] = null, this[kContentType] = contentType, this[kContentLength] = contentLength, this[kReading] = !1;
      }
      destroy(err) {
        return !err && !this._readableState.endEmitted && (err = new RequestAbortedError()), err && this[kAbort](), super.destroy(err);
      }
      _destroy(err, callback) {
        this[kReading] ? callback(err) : setImmediate(() => {
          callback(err);
        });
      }
      on(ev, ...args) {
        return (ev === "data" || ev === "readable") && (this[kReading] = !0), super.on(ev, ...args);
      }
      addListener(ev, ...args) {
        return this.on(ev, ...args);
      }
      off(ev, ...args) {
        let ret = super.off(ev, ...args);
        return (ev === "data" || ev === "readable") && (this[kReading] = this.listenerCount("data") > 0 || this.listenerCount("readable") > 0), ret;
      }
      removeListener(ev, ...args) {
        return this.off(ev, ...args);
      }
      push(chunk) {
        return this[kConsume] && chunk !== null ? (consumePush(this[kConsume], chunk), this[kReading] ? super.push(chunk) : !0) : super.push(chunk);
      }
      // https://fetch.spec.whatwg.org/#dom-body-text
      async text() {
        return consume(this, "text");
      }
      // https://fetch.spec.whatwg.org/#dom-body-json
      async json() {
        return consume(this, "json");
      }
      // https://fetch.spec.whatwg.org/#dom-body-blob
      async blob() {
        return consume(this, "blob");
      }
      // https://fetch.spec.whatwg.org/#dom-body-bytes
      async bytes() {
        return consume(this, "bytes");
      }
      // https://fetch.spec.whatwg.org/#dom-body-arraybuffer
      async arrayBuffer() {
        return consume(this, "arrayBuffer");
      }
      // https://fetch.spec.whatwg.org/#dom-body-formdata
      async formData() {
        throw new NotSupportedError();
      }
      // https://fetch.spec.whatwg.org/#dom-body-bodyused
      get bodyUsed() {
        return util.isDisturbed(this);
      }
      // https://fetch.spec.whatwg.org/#dom-body-body
      get body() {
        return this[kBody] || (this[kBody] = ReadableStreamFrom(this), this[kConsume] && (this[kBody].getReader(), assert(this[kBody].locked))), this[kBody];
      }
      async dump(opts) {
        let limit = Number.isFinite(opts?.limit) ? opts.limit : 131072, signal = opts?.signal;
        if (signal != null && (typeof signal != "object" || !("aborted" in signal)))
          throw new InvalidArgumentError("signal must be an AbortSignal");
        return signal?.throwIfAborted(), this._readableState.closeEmitted ? null : await new Promise((resolve2, reject) => {
          this[kContentLength] > limit && this.destroy(new AbortError());
          let onAbort = () => {
            this.destroy(signal.reason ?? new AbortError());
          };
          signal?.addEventListener("abort", onAbort), this.on("close", function() {
            signal?.removeEventListener("abort", onAbort), signal?.aborted ? reject(signal.reason ?? new AbortError()) : resolve2(null);
          }).on("error", noop).on("data", function(chunk) {
            limit -= chunk.length, limit <= 0 && this.destroy();
          }).resume();
        });
      }
    };
    function isLocked(self) {
      return self[kBody] && self[kBody].locked === !0 || self[kConsume];
    }
    function isUnusable(self) {
      return util.isDisturbed(self) || isLocked(self);
    }
    async function consume(stream, type) {
      return assert(!stream[kConsume]), new Promise((resolve2, reject) => {
        if (isUnusable(stream)) {
          let rState = stream._readableState;
          rState.destroyed && rState.closeEmitted === !1 ? stream.on("error", (err) => {
            reject(err);
          }).on("close", () => {
            reject(new TypeError("unusable"));
          }) : reject(rState.errored ?? new TypeError("unusable"));
        } else
          queueMicrotask(() => {
            stream[kConsume] = {
              type,
              stream,
              resolve: resolve2,
              reject,
              length: 0,
              body: []
            }, stream.on("error", function(err) {
              consumeFinish(this[kConsume], err);
            }).on("close", function() {
              this[kConsume].body !== null && consumeFinish(this[kConsume], new RequestAbortedError());
            }), consumeStart(stream[kConsume]);
          });
      });
    }
    function consumeStart(consume2) {
      if (consume2.body === null)
        return;
      let { _readableState: state } = consume2.stream;
      if (state.bufferIndex) {
        let start = state.bufferIndex, end = state.buffer.length;
        for (let n = start; n < end; n++)
          consumePush(consume2, state.buffer[n]);
      } else
        for (let chunk of state.buffer)
          consumePush(consume2, chunk);
      for (state.endEmitted ? consumeEnd(this[kConsume]) : consume2.stream.on("end", function() {
        consumeEnd(this[kConsume]);
      }), consume2.stream.resume(); consume2.stream.read() != null; )
        ;
    }
    function chunksDecode(chunks, length) {
      if (chunks.length === 0 || length === 0)
        return "";
      let buffer = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, length), bufferLength = buffer.length, start = bufferLength > 2 && buffer[0] === 239 && buffer[1] === 187 && buffer[2] === 191 ? 3 : 0;
      return buffer.utf8Slice(start, bufferLength);
    }
    function chunksConcat(chunks, length) {
      if (chunks.length === 0 || length === 0)
        return new Uint8Array(0);
      if (chunks.length === 1)
        return new Uint8Array(chunks[0]);
      let buffer = new Uint8Array(Buffer.allocUnsafeSlow(length).buffer), offset = 0;
      for (let i = 0; i < chunks.length; ++i) {
        let chunk = chunks[i];
        buffer.set(chunk, offset), offset += chunk.length;
      }
      return buffer;
    }
    function consumeEnd(consume2) {
      let { type, body, resolve: resolve2, stream, length } = consume2;
      try {
        type === "text" ? resolve2(chunksDecode(body, length)) : type === "json" ? resolve2(JSON.parse(chunksDecode(body, length))) : type === "arrayBuffer" ? resolve2(chunksConcat(body, length).buffer) : type === "blob" ? resolve2(new Blob(body, { type: stream[kContentType] })) : type === "bytes" && resolve2(chunksConcat(body, length)), consumeFinish(consume2);
      } catch (err) {
        stream.destroy(err);
      }
    }
    function consumePush(consume2, chunk) {
      consume2.length += chunk.length, consume2.body.push(chunk);
    }
    function consumeFinish(consume2, err) {
      consume2.body !== null && (err ? consume2.reject(err) : consume2.resolve(), consume2.type = null, consume2.stream = null, consume2.resolve = null, consume2.reject = null, consume2.length = 0, consume2.body = null);
    }
    module.exports = { Readable: BodyReadable, chunksDecode };
  }
});

// node_modules/undici/lib/api/util.js
var require_util3 = __commonJS({
  "node_modules/undici/lib/api/util.js"(exports, module) {
    var assert = __require("node:assert"), {
      ResponseStatusCodeError
    } = require_errors(), { chunksDecode } = require_readable(), CHUNK_LIMIT = 128 * 1024;
    async function getResolveErrorBodyCallback({ callback, body, contentType, statusCode, statusMessage, headers }) {
      assert(body);
      let chunks = [], length = 0;
      try {
        for await (let chunk of body)
          if (chunks.push(chunk), length += chunk.length, length > CHUNK_LIMIT) {
            chunks = [], length = 0;
            break;
          }
      } catch {
        chunks = [], length = 0;
      }
      let message = `Response status code ${statusCode}${statusMessage ? `: ${statusMessage}` : ""}`;
      if (statusCode === 204 || !contentType || !length) {
        queueMicrotask(() => callback(new ResponseStatusCodeError(message, statusCode, headers)));
        return;
      }
      let stackTraceLimit = Error.stackTraceLimit;
      Error.stackTraceLimit = 0;
      let payload;
      try {
        isContentTypeApplicationJson(contentType) ? payload = JSON.parse(chunksDecode(chunks, length)) : isContentTypeText(contentType) && (payload = chunksDecode(chunks, length));
      } catch {
      } finally {
        Error.stackTraceLimit = stackTraceLimit;
      }
      queueMicrotask(() => callback(new ResponseStatusCodeError(message, statusCode, headers, payload)));
    }
    var isContentTypeApplicationJson = (contentType) => contentType.length > 15 && contentType[11] === "/" && contentType[0] === "a" && contentType[1] === "p" && contentType[2] === "p" && contentType[3] === "l" && contentType[4] === "i" && contentType[5] === "c" && contentType[6] === "a" && contentType[7] === "t" && contentType[8] === "i" && contentType[9] === "o" && contentType[10] === "n" && contentType[12] === "j" && contentType[13] === "s" && contentType[14] === "o" && contentType[15] === "n", isContentTypeText = (contentType) => contentType.length > 4 && contentType[4] === "/" && contentType[0] === "t" && contentType[1] === "e" && contentType[2] === "x" && contentType[3] === "t";
    module.exports = {
      getResolveErrorBodyCallback,
      isContentTypeApplicationJson,
      isContentTypeText
    };
  }
});

// node_modules/undici/lib/api/api-request.js
var require_api_request = __commonJS({
  "node_modules/undici/lib/api/api-request.js"(exports, module) {
    "use strict";
    var assert = __require("node:assert"), { Readable } = require_readable(), { InvalidArgumentError, RequestAbortedError } = require_errors(), util = require_util(), { getResolveErrorBodyCallback } = require_util3(), { AsyncResource } = __require("node:async_hooks"), RequestHandler = class extends AsyncResource {
      constructor(opts, callback) {
        if (!opts || typeof opts != "object")
          throw new InvalidArgumentError("invalid opts");
        let { signal, method, opaque, body, onInfo, responseHeaders, throwOnError, highWaterMark } = opts;
        try {
          if (typeof callback != "function")
            throw new InvalidArgumentError("invalid callback");
          if (highWaterMark && (typeof highWaterMark != "number" || highWaterMark < 0))
            throw new InvalidArgumentError("invalid highWaterMark");
          if (signal && typeof signal.on != "function" && typeof signal.addEventListener != "function")
            throw new InvalidArgumentError("signal must be an EventEmitter or EventTarget");
          if (method === "CONNECT")
            throw new InvalidArgumentError("invalid method");
          if (onInfo && typeof onInfo != "function")
            throw new InvalidArgumentError("invalid onInfo callback");
          super("UNDICI_REQUEST");
        } catch (err) {
          throw util.isStream(body) && util.destroy(body.on("error", util.nop), err), err;
        }
        this.method = method, this.responseHeaders = responseHeaders || null, this.opaque = opaque || null, this.callback = callback, this.res = null, this.abort = null, this.body = body, this.trailers = {}, this.context = null, this.onInfo = onInfo || null, this.throwOnError = throwOnError, this.highWaterMark = highWaterMark, this.signal = signal, this.reason = null, this.removeAbortListener = null, util.isStream(body) && body.on("error", (err) => {
          this.onError(err);
        }), this.signal && (this.signal.aborted ? this.reason = this.signal.reason ?? new RequestAbortedError() : this.removeAbortListener = util.addAbortListener(this.signal, () => {
          this.reason = this.signal.reason ?? new RequestAbortedError(), this.res ? util.destroy(this.res.on("error", util.nop), this.reason) : this.abort && this.abort(this.reason), this.removeAbortListener && (this.res?.off("close", this.removeAbortListener), this.removeAbortListener(), this.removeAbortListener = null);
        }));
      }
      onConnect(abort, context) {
        if (this.reason) {
          abort(this.reason);
          return;
        }
        assert(this.callback), this.abort = abort, this.context = context;
      }
      onHeaders(statusCode, rawHeaders, resume, statusMessage) {
        let { callback, opaque, abort, context, responseHeaders, highWaterMark } = this, headers = responseHeaders === "raw" ? util.parseRawHeaders(rawHeaders) : util.parseHeaders(rawHeaders);
        if (statusCode < 200) {
          this.onInfo && this.onInfo({ statusCode, headers });
          return;
        }
        let parsedHeaders = responseHeaders === "raw" ? util.parseHeaders(rawHeaders) : headers, contentType = parsedHeaders["content-type"], contentLength = parsedHeaders["content-length"], res = new Readable({
          resume,
          abort,
          contentType,
          contentLength: this.method !== "HEAD" && contentLength ? Number(contentLength) : null,
          highWaterMark
        });
        this.removeAbortListener && res.on("close", this.removeAbortListener), this.callback = null, this.res = res, callback !== null && (this.throwOnError && statusCode >= 400 ? this.runInAsyncScope(
          getResolveErrorBodyCallback,
          null,
          { callback, body: res, contentType, statusCode, statusMessage, headers }
        ) : this.runInAsyncScope(callback, null, null, {
          statusCode,
          headers,
          trailers: this.trailers,
          opaque,
          body: res,
          context
        }));
      }
      onData(chunk) {
        return this.res.push(chunk);
      }
      onComplete(trailers) {
        util.parseHeaders(trailers, this.trailers), this.res.push(null);
      }
      onError(err) {
        let { res, callback, body, opaque } = this;
        callback && (this.callback = null, queueMicrotask(() => {
          this.runInAsyncScope(callback, null, err, { opaque });
        })), res && (this.res = null, queueMicrotask(() => {
          util.destroy(res, err);
        })), body && (this.body = null, util.destroy(body, err)), this.removeAbortListener && (res?.off("close", this.removeAbortListener), this.removeAbortListener(), this.removeAbortListener = null);
      }
    };
    function request(opts, callback) {
      if (callback === void 0)
        return new Promise((resolve2, reject) => {
          request.call(this, opts, (err, data) => err ? reject(err) : resolve2(data));
        });
      try {
        this.dispatch(opts, new RequestHandler(opts, callback));
      } catch (err) {
        if (typeof callback != "function")
          throw err;
        let opaque = opts?.opaque;
        queueMicrotask(() => callback(err, { opaque }));
      }
    }
    module.exports = request;
    module.exports.RequestHandler = RequestHandler;
  }
});

// node_modules/undici/lib/api/abort-signal.js
var require_abort_signal = __commonJS({
  "node_modules/undici/lib/api/abort-signal.js"(exports, module) {
    var { addAbortListener } = require_util(), { RequestAbortedError } = require_errors(), kListener = /* @__PURE__ */ Symbol("kListener"), kSignal = /* @__PURE__ */ Symbol("kSignal");
    function abort(self) {
      self.abort ? self.abort(self[kSignal]?.reason) : self.reason = self[kSignal]?.reason ?? new RequestAbortedError(), removeSignal(self);
    }
    function addSignal(self, signal) {
      if (self.reason = null, self[kSignal] = null, self[kListener] = null, !!signal) {
        if (signal.aborted) {
          abort(self);
          return;
        }
        self[kSignal] = signal, self[kListener] = () => {
          abort(self);
        }, addAbortListener(self[kSignal], self[kListener]);
      }
    }
    function removeSignal(self) {
      self[kSignal] && ("removeEventListener" in self[kSignal] ? self[kSignal].removeEventListener("abort", self[kListener]) : self[kSignal].removeListener("abort", self[kListener]), self[kSignal] = null, self[kListener] = null);
    }
    module.exports = {
      addSignal,
      removeSignal
    };
  }
});

// node_modules/undici/lib/api/api-stream.js
var require_api_stream = __commonJS({
  "node_modules/undici/lib/api/api-stream.js"(exports, module) {
    "use strict";
    var assert = __require("node:assert"), { finished, PassThrough } = __require("node:stream"), { InvalidArgumentError, InvalidReturnValueError } = require_errors(), util = require_util(), { getResolveErrorBodyCallback } = require_util3(), { AsyncResource } = __require("node:async_hooks"), { addSignal, removeSignal } = require_abort_signal(), StreamHandler = class extends AsyncResource {
      constructor(opts, factory, callback) {
        if (!opts || typeof opts != "object")
          throw new InvalidArgumentError("invalid opts");
        let { signal, method, opaque, body, onInfo, responseHeaders, throwOnError } = opts;
        try {
          if (typeof callback != "function")
            throw new InvalidArgumentError("invalid callback");
          if (typeof factory != "function")
            throw new InvalidArgumentError("invalid factory");
          if (signal && typeof signal.on != "function" && typeof signal.addEventListener != "function")
            throw new InvalidArgumentError("signal must be an EventEmitter or EventTarget");
          if (method === "CONNECT")
            throw new InvalidArgumentError("invalid method");
          if (onInfo && typeof onInfo != "function")
            throw new InvalidArgumentError("invalid onInfo callback");
          super("UNDICI_STREAM");
        } catch (err) {
          throw util.isStream(body) && util.destroy(body.on("error", util.nop), err), err;
        }
        this.responseHeaders = responseHeaders || null, this.opaque = opaque || null, this.factory = factory, this.callback = callback, this.res = null, this.abort = null, this.context = null, this.trailers = null, this.body = body, this.onInfo = onInfo || null, this.throwOnError = throwOnError || !1, util.isStream(body) && body.on("error", (err) => {
          this.onError(err);
        }), addSignal(this, signal);
      }
      onConnect(abort, context) {
        if (this.reason) {
          abort(this.reason);
          return;
        }
        assert(this.callback), this.abort = abort, this.context = context;
      }
      onHeaders(statusCode, rawHeaders, resume, statusMessage) {
        let { factory, opaque, context, callback, responseHeaders } = this, headers = responseHeaders === "raw" ? util.parseRawHeaders(rawHeaders) : util.parseHeaders(rawHeaders);
        if (statusCode < 200) {
          this.onInfo && this.onInfo({ statusCode, headers });
          return;
        }
        this.factory = null;
        let res;
        if (this.throwOnError && statusCode >= 400) {
          let contentType = (responseHeaders === "raw" ? util.parseHeaders(rawHeaders) : headers)["content-type"];
          res = new PassThrough(), this.callback = null, this.runInAsyncScope(
            getResolveErrorBodyCallback,
            null,
            { callback, body: res, contentType, statusCode, statusMessage, headers }
          );
        } else {
          if (factory === null)
            return;
          if (res = this.runInAsyncScope(factory, null, {
            statusCode,
            headers,
            opaque,
            context
          }), !res || typeof res.write != "function" || typeof res.end != "function" || typeof res.on != "function")
            throw new InvalidReturnValueError("expected Writable");
          finished(res, { readable: !1 }, (err) => {
            let { callback: callback2, res: res2, opaque: opaque2, trailers, abort } = this;
            this.res = null, (err || !res2.readable) && util.destroy(res2, err), this.callback = null, this.runInAsyncScope(callback2, null, err || null, { opaque: opaque2, trailers }), err && abort();
          });
        }
        return res.on("drain", resume), this.res = res, (res.writableNeedDrain !== void 0 ? res.writableNeedDrain : res._writableState?.needDrain) !== !0;
      }
      onData(chunk) {
        let { res } = this;
        return res ? res.write(chunk) : !0;
      }
      onComplete(trailers) {
        let { res } = this;
        removeSignal(this), res && (this.trailers = util.parseHeaders(trailers), res.end());
      }
      onError(err) {
        let { res, callback, opaque, body } = this;
        removeSignal(this), this.factory = null, res ? (this.res = null, util.destroy(res, err)) : callback && (this.callback = null, queueMicrotask(() => {
          this.runInAsyncScope(callback, null, err, { opaque });
        })), body && (this.body = null, util.destroy(body, err));
      }
    };
    function stream(opts, factory, callback) {
      if (callback === void 0)
        return new Promise((resolve2, reject) => {
          stream.call(this, opts, factory, (err, data) => err ? reject(err) : resolve2(data));
        });
      try {
        this.dispatch(opts, new StreamHandler(opts, factory, callback));
      } catch (err) {
        if (typeof callback != "function")
          throw err;
        let opaque = opts?.opaque;
        queueMicrotask(() => callback(err, { opaque }));
      }
    }
    module.exports = stream;
  }
});

// node_modules/undici/lib/api/api-pipeline.js
var require_api_pipeline = __commonJS({
  "node_modules/undici/lib/api/api-pipeline.js"(exports, module) {
    "use strict";
    var {
      Readable,
      Duplex,
      PassThrough
    } = __require("node:stream"), {
      InvalidArgumentError,
      InvalidReturnValueError,
      RequestAbortedError
    } = require_errors(), util = require_util(), { AsyncResource } = __require("node:async_hooks"), { addSignal, removeSignal } = require_abort_signal(), assert = __require("node:assert"), kResume = /* @__PURE__ */ Symbol("resume"), PipelineRequest = class extends Readable {
      constructor() {
        super({ autoDestroy: !0 }), this[kResume] = null;
      }
      _read() {
        let { [kResume]: resume } = this;
        resume && (this[kResume] = null, resume());
      }
      _destroy(err, callback) {
        this._read(), callback(err);
      }
    }, PipelineResponse = class extends Readable {
      constructor(resume) {
        super({ autoDestroy: !0 }), this[kResume] = resume;
      }
      _read() {
        this[kResume]();
      }
      _destroy(err, callback) {
        !err && !this._readableState.endEmitted && (err = new RequestAbortedError()), callback(err);
      }
    }, PipelineHandler = class extends AsyncResource {
      constructor(opts, handler) {
        if (!opts || typeof opts != "object")
          throw new InvalidArgumentError("invalid opts");
        if (typeof handler != "function")
          throw new InvalidArgumentError("invalid handler");
        let { signal, method, opaque, onInfo, responseHeaders } = opts;
        if (signal && typeof signal.on != "function" && typeof signal.addEventListener != "function")
          throw new InvalidArgumentError("signal must be an EventEmitter or EventTarget");
        if (method === "CONNECT")
          throw new InvalidArgumentError("invalid method");
        if (onInfo && typeof onInfo != "function")
          throw new InvalidArgumentError("invalid onInfo callback");
        super("UNDICI_PIPELINE"), this.opaque = opaque || null, this.responseHeaders = responseHeaders || null, this.handler = handler, this.abort = null, this.context = null, this.onInfo = onInfo || null, this.req = new PipelineRequest().on("error", util.nop), this.ret = new Duplex({
          readableObjectMode: opts.objectMode,
          autoDestroy: !0,
          read: () => {
            let { body } = this;
            body?.resume && body.resume();
          },
          write: (chunk, encoding, callback) => {
            let { req } = this;
            req.push(chunk, encoding) || req._readableState.destroyed ? callback() : req[kResume] = callback;
          },
          destroy: (err, callback) => {
            let { body, req, res, ret, abort } = this;
            !err && !ret._readableState.endEmitted && (err = new RequestAbortedError()), abort && err && abort(), util.destroy(body, err), util.destroy(req, err), util.destroy(res, err), removeSignal(this), callback(err);
          }
        }).on("prefinish", () => {
          let { req } = this;
          req.push(null);
        }), this.res = null, addSignal(this, signal);
      }
      onConnect(abort, context) {
        let { ret, res } = this;
        if (this.reason) {
          abort(this.reason);
          return;
        }
        assert(!res, "pipeline cannot be retried"), assert(!ret.destroyed), this.abort = abort, this.context = context;
      }
      onHeaders(statusCode, rawHeaders, resume) {
        let { opaque, handler, context } = this;
        if (statusCode < 200) {
          if (this.onInfo) {
            let headers = this.responseHeaders === "raw" ? util.parseRawHeaders(rawHeaders) : util.parseHeaders(rawHeaders);
            this.onInfo({ statusCode, headers });
          }
          return;
        }
        this.res = new PipelineResponse(resume);
        let body;
        try {
          this.handler = null;
          let headers = this.responseHeaders === "raw" ? util.parseRawHeaders(rawHeaders) : util.parseHeaders(rawHeaders);
          body = this.runInAsyncScope(handler, null, {
            statusCode,
            headers,
            opaque,
            body: this.res,
            context
          });
        } catch (err) {
          throw this.res.on("error", util.nop), err;
        }
        if (!body || typeof body.on != "function")
          throw new InvalidReturnValueError("expected Readable");
        body.on("data", (chunk) => {
          let { ret, body: body2 } = this;
          !ret.push(chunk) && body2.pause && body2.pause();
        }).on("error", (err) => {
          let { ret } = this;
          util.destroy(ret, err);
        }).on("end", () => {
          let { ret } = this;
          ret.push(null);
        }).on("close", () => {
          let { ret } = this;
          ret._readableState.ended || util.destroy(ret, new RequestAbortedError());
        }), this.body = body;
      }
      onData(chunk) {
        let { res } = this;
        return res.push(chunk);
      }
      onComplete(trailers) {
        let { res } = this;
        res.push(null);
      }
      onError(err) {
        let { ret } = this;
        this.handler = null, util.destroy(ret, err);
      }
    };
    function pipeline3(opts, handler) {
      try {
        let pipelineHandler = new PipelineHandler(opts, handler);
        return this.dispatch({ ...opts, body: pipelineHandler.req }, pipelineHandler), pipelineHandler.ret;
      } catch (err) {
        return new PassThrough().destroy(err);
      }
    }
    module.exports = pipeline3;
  }
});

// node_modules/undici/lib/api/api-upgrade.js
var require_api_upgrade = __commonJS({
  "node_modules/undici/lib/api/api-upgrade.js"(exports, module) {
    "use strict";
    var { InvalidArgumentError, SocketError } = require_errors(), { AsyncResource } = __require("node:async_hooks"), util = require_util(), { addSignal, removeSignal } = require_abort_signal(), assert = __require("node:assert"), UpgradeHandler = class extends AsyncResource {
      constructor(opts, callback) {
        if (!opts || typeof opts != "object")
          throw new InvalidArgumentError("invalid opts");
        if (typeof callback != "function")
          throw new InvalidArgumentError("invalid callback");
        let { signal, opaque, responseHeaders } = opts;
        if (signal && typeof signal.on != "function" && typeof signal.addEventListener != "function")
          throw new InvalidArgumentError("signal must be an EventEmitter or EventTarget");
        super("UNDICI_UPGRADE"), this.responseHeaders = responseHeaders || null, this.opaque = opaque || null, this.callback = callback, this.abort = null, this.context = null, addSignal(this, signal);
      }
      onConnect(abort, context) {
        if (this.reason) {
          abort(this.reason);
          return;
        }
        assert(this.callback), this.abort = abort, this.context = null;
      }
      onHeaders() {
        throw new SocketError("bad upgrade", null);
      }
      onUpgrade(statusCode, rawHeaders, socket) {
        assert(statusCode === 101);
        let { callback, opaque, context } = this;
        removeSignal(this), this.callback = null;
        let headers = this.responseHeaders === "raw" ? util.parseRawHeaders(rawHeaders) : util.parseHeaders(rawHeaders);
        this.runInAsyncScope(callback, null, null, {
          headers,
          socket,
          opaque,
          context
        });
      }
      onError(err) {
        let { callback, opaque } = this;
        removeSignal(this), callback && (this.callback = null, queueMicrotask(() => {
          this.runInAsyncScope(callback, null, err, { opaque });
        }));
      }
    };
    function upgrade(opts, callback) {
      if (callback === void 0)
        return new Promise((resolve2, reject) => {
          upgrade.call(this, opts, (err, data) => err ? reject(err) : resolve2(data));
        });
      try {
        let upgradeHandler = new UpgradeHandler(opts, callback);
        this.dispatch({
          ...opts,
          method: opts.method || "GET",
          upgrade: opts.protocol || "Websocket"
        }, upgradeHandler);
      } catch (err) {
        if (typeof callback != "function")
          throw err;
        let opaque = opts?.opaque;
        queueMicrotask(() => callback(err, { opaque }));
      }
    }
    module.exports = upgrade;
  }
});

// node_modules/undici/lib/api/api-connect.js
var require_api_connect = __commonJS({
  "node_modules/undici/lib/api/api-connect.js"(exports, module) {
    "use strict";
    var assert = __require("node:assert"), { AsyncResource } = __require("node:async_hooks"), { InvalidArgumentError, SocketError } = require_errors(), util = require_util(), { addSignal, removeSignal } = require_abort_signal(), ConnectHandler = class extends AsyncResource {
      constructor(opts, callback) {
        if (!opts || typeof opts != "object")
          throw new InvalidArgumentError("invalid opts");
        if (typeof callback != "function")
          throw new InvalidArgumentError("invalid callback");
        let { signal, opaque, responseHeaders } = opts;
        if (signal && typeof signal.on != "function" && typeof signal.addEventListener != "function")
          throw new InvalidArgumentError("signal must be an EventEmitter or EventTarget");
        super("UNDICI_CONNECT"), this.opaque = opaque || null, this.responseHeaders = responseHeaders || null, this.callback = callback, this.abort = null, addSignal(this, signal);
      }
      onConnect(abort, context) {
        if (this.reason) {
          abort(this.reason);
          return;
        }
        assert(this.callback), this.abort = abort, this.context = context;
      }
      onHeaders() {
        throw new SocketError("bad connect", null);
      }
      onUpgrade(statusCode, rawHeaders, socket) {
        let { callback, opaque, context } = this;
        removeSignal(this), this.callback = null;
        let headers = rawHeaders;
        headers != null && (headers = this.responseHeaders === "raw" ? util.parseRawHeaders(rawHeaders) : util.parseHeaders(rawHeaders)), this.runInAsyncScope(callback, null, null, {
          statusCode,
          headers,
          socket,
          opaque,
          context
        });
      }
      onError(err) {
        let { callback, opaque } = this;
        removeSignal(this), callback && (this.callback = null, queueMicrotask(() => {
          this.runInAsyncScope(callback, null, err, { opaque });
        }));
      }
    };
    function connect(opts, callback) {
      if (callback === void 0)
        return new Promise((resolve2, reject) => {
          connect.call(this, opts, (err, data) => err ? reject(err) : resolve2(data));
        });
      try {
        let connectHandler = new ConnectHandler(opts, callback);
        this.dispatch({ ...opts, method: "CONNECT" }, connectHandler);
      } catch (err) {
        if (typeof callback != "function")
          throw err;
        let opaque = opts?.opaque;
        queueMicrotask(() => callback(err, { opaque }));
      }
    }
    module.exports = connect;
  }
});

// node_modules/undici/lib/api/index.js
var require_api = __commonJS({
  "node_modules/undici/lib/api/index.js"(exports, module) {
    "use strict";
    module.exports.request = require_api_request();
    module.exports.stream = require_api_stream();
    module.exports.pipeline = require_api_pipeline();
    module.exports.upgrade = require_api_upgrade();
    module.exports.connect = require_api_connect();
  }
});

// node_modules/undici/lib/mock/mock-errors.js
var require_mock_errors = __commonJS({
  "node_modules/undici/lib/mock/mock-errors.js"(exports, module) {
    "use strict";
    var { UndiciError } = require_errors(), kMockNotMatchedError = /* @__PURE__ */ Symbol.for("undici.error.UND_MOCK_ERR_MOCK_NOT_MATCHED"), MockNotMatchedError = class _MockNotMatchedError extends UndiciError {
      constructor(message) {
        super(message), Error.captureStackTrace(this, _MockNotMatchedError), this.name = "MockNotMatchedError", this.message = message || "The request does not match any registered mock dispatches", this.code = "UND_MOCK_ERR_MOCK_NOT_MATCHED";
      }
      static [Symbol.hasInstance](instance) {
        return instance && instance[kMockNotMatchedError] === !0;
      }
      [kMockNotMatchedError] = !0;
    };
    module.exports = {
      MockNotMatchedError
    };
  }
});

// node_modules/undici/lib/mock/mock-symbols.js
var require_mock_symbols = __commonJS({
  "node_modules/undici/lib/mock/mock-symbols.js"(exports, module) {
    "use strict";
    module.exports = {
      kAgent: /* @__PURE__ */ Symbol("agent"),
      kOptions: /* @__PURE__ */ Symbol("options"),
      kFactory: /* @__PURE__ */ Symbol("factory"),
      kDispatches: /* @__PURE__ */ Symbol("dispatches"),
      kDispatchKey: /* @__PURE__ */ Symbol("dispatch key"),
      kDefaultHeaders: /* @__PURE__ */ Symbol("default headers"),
      kDefaultTrailers: /* @__PURE__ */ Symbol("default trailers"),
      kContentLength: /* @__PURE__ */ Symbol("content length"),
      kMockAgent: /* @__PURE__ */ Symbol("mock agent"),
      kMockAgentSet: /* @__PURE__ */ Symbol("mock agent set"),
      kMockAgentGet: /* @__PURE__ */ Symbol("mock agent get"),
      kMockDispatch: /* @__PURE__ */ Symbol("mock dispatch"),
      kClose: /* @__PURE__ */ Symbol("close"),
      kOriginalClose: /* @__PURE__ */ Symbol("original agent close"),
      kOrigin: /* @__PURE__ */ Symbol("origin"),
      kIsMockActive: /* @__PURE__ */ Symbol("is mock active"),
      kNetConnect: /* @__PURE__ */ Symbol("net connect"),
      kGetNetConnect: /* @__PURE__ */ Symbol("get net connect"),
      kConnected: /* @__PURE__ */ Symbol("connected")
    };
  }
});

// node_modules/undici/lib/mock/mock-utils.js
var require_mock_utils = __commonJS({
  "node_modules/undici/lib/mock/mock-utils.js"(exports, module) {
    "use strict";
    var { MockNotMatchedError } = require_mock_errors(), {
      kDispatches,
      kMockAgent,
      kOriginalDispatch,
      kOrigin,
      kGetNetConnect
    } = require_mock_symbols(), { buildURL } = require_util(), { STATUS_CODES } = __require("node:http"), {
      types: {
        isPromise
      }
    } = __require("node:util");
    function matchValue(match, value) {
      return typeof match == "string" ? match === value : match instanceof RegExp ? match.test(value) : typeof match == "function" ? match(value) === !0 : !1;
    }
    function lowerCaseEntries(headers) {
      return Object.fromEntries(
        Object.entries(headers).map(([headerName, headerValue]) => [headerName.toLocaleLowerCase(), headerValue])
      );
    }
    function getHeaderByName(headers, key) {
      if (Array.isArray(headers)) {
        for (let i = 0; i < headers.length; i += 2)
          if (headers[i].toLocaleLowerCase() === key.toLocaleLowerCase())
            return headers[i + 1];
        return;
      } else return typeof headers.get == "function" ? headers.get(key) : lowerCaseEntries(headers)[key.toLocaleLowerCase()];
    }
    function buildHeadersFromArray(headers) {
      let clone = headers.slice(), entries = [];
      for (let index = 0; index < clone.length; index += 2)
        entries.push([clone[index], clone[index + 1]]);
      return Object.fromEntries(entries);
    }
    function matchHeaders(mockDispatch2, headers) {
      if (typeof mockDispatch2.headers == "function")
        return Array.isArray(headers) && (headers = buildHeadersFromArray(headers)), mockDispatch2.headers(headers ? lowerCaseEntries(headers) : {});
      if (typeof mockDispatch2.headers > "u")
        return !0;
      if (typeof headers != "object" || typeof mockDispatch2.headers != "object")
        return !1;
      for (let [matchHeaderName, matchHeaderValue] of Object.entries(mockDispatch2.headers)) {
        let headerValue = getHeaderByName(headers, matchHeaderName);
        if (!matchValue(matchHeaderValue, headerValue))
          return !1;
      }
      return !0;
    }
    function safeUrl(path4) {
      if (typeof path4 != "string")
        return path4;
      let pathSegments = path4.split("?");
      if (pathSegments.length !== 2)
        return path4;
      let qp = new URLSearchParams(pathSegments.pop());
      return qp.sort(), [...pathSegments, qp.toString()].join("?");
    }
    function matchKey(mockDispatch2, { path: path4, method, body, headers }) {
      let pathMatch = matchValue(mockDispatch2.path, path4), methodMatch = matchValue(mockDispatch2.method, method), bodyMatch = typeof mockDispatch2.body < "u" ? matchValue(mockDispatch2.body, body) : !0, headersMatch = matchHeaders(mockDispatch2, headers);
      return pathMatch && methodMatch && bodyMatch && headersMatch;
    }
    function getResponseData(data) {
      return Buffer.isBuffer(data) || data instanceof Uint8Array || data instanceof ArrayBuffer ? data : typeof data == "object" ? JSON.stringify(data) : data.toString();
    }
    function getMockDispatch(mockDispatches, key) {
      let basePath = key.query ? buildURL(key.path, key.query) : key.path, resolvedPath = typeof basePath == "string" ? safeUrl(basePath) : basePath, matchedMockDispatches = mockDispatches.filter(({ consumed }) => !consumed).filter(({ path: path4 }) => matchValue(safeUrl(path4), resolvedPath));
      if (matchedMockDispatches.length === 0)
        throw new MockNotMatchedError(`Mock dispatch not matched for path '${resolvedPath}'`);
      if (matchedMockDispatches = matchedMockDispatches.filter(({ method }) => matchValue(method, key.method)), matchedMockDispatches.length === 0)
        throw new MockNotMatchedError(`Mock dispatch not matched for method '${key.method}' on path '${resolvedPath}'`);
      if (matchedMockDispatches = matchedMockDispatches.filter(({ body }) => typeof body < "u" ? matchValue(body, key.body) : !0), matchedMockDispatches.length === 0)
        throw new MockNotMatchedError(`Mock dispatch not matched for body '${key.body}' on path '${resolvedPath}'`);
      if (matchedMockDispatches = matchedMockDispatches.filter((mockDispatch2) => matchHeaders(mockDispatch2, key.headers)), matchedMockDispatches.length === 0) {
        let headers = typeof key.headers == "object" ? JSON.stringify(key.headers) : key.headers;
        throw new MockNotMatchedError(`Mock dispatch not matched for headers '${headers}' on path '${resolvedPath}'`);
      }
      return matchedMockDispatches[0];
    }
    function addMockDispatch(mockDispatches, key, data) {
      let baseData = { timesInvoked: 0, times: 1, persist: !1, consumed: !1 }, replyData = typeof data == "function" ? { callback: data } : { ...data }, newMockDispatch = { ...baseData, ...key, pending: !0, data: { error: null, ...replyData } };
      return mockDispatches.push(newMockDispatch), newMockDispatch;
    }
    function deleteMockDispatch(mockDispatches, key) {
      let index = mockDispatches.findIndex((dispatch) => dispatch.consumed ? matchKey(dispatch, key) : !1);
      index !== -1 && mockDispatches.splice(index, 1);
    }
    function buildKey(opts) {
      let { path: path4, method, body, headers, query } = opts;
      return {
        path: path4,
        method,
        body,
        headers,
        query
      };
    }
    function generateKeyValues(data) {
      let keys = Object.keys(data), result = [];
      for (let i = 0; i < keys.length; ++i) {
        let key = keys[i], value = data[key], name = Buffer.from(`${key}`);
        if (Array.isArray(value))
          for (let j = 0; j < value.length; ++j)
            result.push(name, Buffer.from(`${value[j]}`));
        else
          result.push(name, Buffer.from(`${value}`));
      }
      return result;
    }
    function getStatusText(statusCode) {
      return STATUS_CODES[statusCode] || "unknown";
    }
    async function getResponse(body) {
      let buffers = [];
      for await (let data of body)
        buffers.push(data);
      return Buffer.concat(buffers).toString("utf8");
    }
    function mockDispatch(opts, handler) {
      let key = buildKey(opts), mockDispatch2 = getMockDispatch(this[kDispatches], key);
      mockDispatch2.timesInvoked++, mockDispatch2.data.callback && (mockDispatch2.data = { ...mockDispatch2.data, ...mockDispatch2.data.callback(opts) });
      let { data: { statusCode, data, headers, trailers, error: error2 }, delay, persist } = mockDispatch2, { timesInvoked, times } = mockDispatch2;
      if (mockDispatch2.consumed = !persist && timesInvoked >= times, mockDispatch2.pending = timesInvoked < times, error2 !== null)
        return deleteMockDispatch(this[kDispatches], key), handler.onError(error2), !0;
      typeof delay == "number" && delay > 0 ? setTimeout(() => {
        handleReply(this[kDispatches]);
      }, delay) : handleReply(this[kDispatches]);
      function handleReply(mockDispatches, _data = data) {
        let optsHeaders = Array.isArray(opts.headers) ? buildHeadersFromArray(opts.headers) : opts.headers, body = typeof _data == "function" ? _data({ ...opts, headers: optsHeaders }) : _data;
        if (isPromise(body)) {
          body.then((newData) => handleReply(mockDispatches, newData));
          return;
        }
        let responseData = getResponseData(body), responseHeaders = generateKeyValues(headers), responseTrailers = generateKeyValues(trailers);
        handler.onConnect?.((err) => handler.onError(err), null), handler.onHeaders?.(statusCode, responseHeaders, resume, getStatusText(statusCode)), handler.onData?.(Buffer.from(responseData)), handler.onComplete?.(responseTrailers), deleteMockDispatch(mockDispatches, key);
      }
      function resume() {
      }
      return !0;
    }
    function buildMockDispatch() {
      let agent = this[kMockAgent], origin = this[kOrigin], originalDispatch = this[kOriginalDispatch];
      return function(opts, handler) {
        if (agent.isMockActive)
          try {
            mockDispatch.call(this, opts, handler);
          } catch (error2) {
            if (error2 instanceof MockNotMatchedError) {
              let netConnect = agent[kGetNetConnect]();
              if (netConnect === !1)
                throw new MockNotMatchedError(`${error2.message}: subsequent request to origin ${origin} was not allowed (net.connect disabled)`);
              if (checkNetConnect(netConnect, origin))
                originalDispatch.call(this, opts, handler);
              else
                throw new MockNotMatchedError(`${error2.message}: subsequent request to origin ${origin} was not allowed (net.connect is not enabled for this origin)`);
            } else
              throw error2;
          }
        else
          originalDispatch.call(this, opts, handler);
      };
    }
    function checkNetConnect(netConnect, origin) {
      let url = new URL(origin);
      return netConnect === !0 ? !0 : !!(Array.isArray(netConnect) && netConnect.some((matcher) => matchValue(matcher, url.host)));
    }
    function buildMockOptions(opts) {
      if (opts) {
        let { agent, ...mockOptions } = opts;
        return mockOptions;
      }
    }
    module.exports = {
      getResponseData,
      getMockDispatch,
      addMockDispatch,
      deleteMockDispatch,
      buildKey,
      generateKeyValues,
      matchValue,
      getResponse,
      getStatusText,
      mockDispatch,
      buildMockDispatch,
      checkNetConnect,
      buildMockOptions,
      getHeaderByName,
      buildHeadersFromArray
    };
  }
});

// node_modules/undici/lib/mock/mock-interceptor.js
var require_mock_interceptor = __commonJS({
  "node_modules/undici/lib/mock/mock-interceptor.js"(exports, module) {
    "use strict";
    var { getResponseData, buildKey, addMockDispatch } = require_mock_utils(), {
      kDispatches,
      kDispatchKey,
      kDefaultHeaders,
      kDefaultTrailers,
      kContentLength,
      kMockDispatch
    } = require_mock_symbols(), { InvalidArgumentError } = require_errors(), { buildURL } = require_util(), MockScope = class {
      constructor(mockDispatch) {
        this[kMockDispatch] = mockDispatch;
      }
      /**
       * Delay a reply by a set amount in ms.
       */
      delay(waitInMs) {
        if (typeof waitInMs != "number" || !Number.isInteger(waitInMs) || waitInMs <= 0)
          throw new InvalidArgumentError("waitInMs must be a valid integer > 0");
        return this[kMockDispatch].delay = waitInMs, this;
      }
      /**
       * For a defined reply, never mark as consumed.
       */
      persist() {
        return this[kMockDispatch].persist = !0, this;
      }
      /**
       * Allow one to define a reply for a set amount of matching requests.
       */
      times(repeatTimes) {
        if (typeof repeatTimes != "number" || !Number.isInteger(repeatTimes) || repeatTimes <= 0)
          throw new InvalidArgumentError("repeatTimes must be a valid integer > 0");
        return this[kMockDispatch].times = repeatTimes, this;
      }
    }, MockInterceptor = class {
      constructor(opts, mockDispatches) {
        if (typeof opts != "object")
          throw new InvalidArgumentError("opts must be an object");
        if (typeof opts.path > "u")
          throw new InvalidArgumentError("opts.path must be defined");
        if (typeof opts.method > "u" && (opts.method = "GET"), typeof opts.path == "string")
          if (opts.query)
            opts.path = buildURL(opts.path, opts.query);
          else {
            let parsedURL = new URL(opts.path, "data://");
            opts.path = parsedURL.pathname + parsedURL.search;
          }
        typeof opts.method == "string" && (opts.method = opts.method.toUpperCase()), this[kDispatchKey] = buildKey(opts), this[kDispatches] = mockDispatches, this[kDefaultHeaders] = {}, this[kDefaultTrailers] = {}, this[kContentLength] = !1;
      }
      createMockScopeDispatchData({ statusCode, data, responseOptions }) {
        let responseData = getResponseData(data), contentLength = this[kContentLength] ? { "content-length": responseData.length } : {}, headers = { ...this[kDefaultHeaders], ...contentLength, ...responseOptions.headers }, trailers = { ...this[kDefaultTrailers], ...responseOptions.trailers };
        return { statusCode, data, headers, trailers };
      }
      validateReplyParameters(replyParameters) {
        if (typeof replyParameters.statusCode > "u")
          throw new InvalidArgumentError("statusCode must be defined");
        if (typeof replyParameters.responseOptions != "object" || replyParameters.responseOptions === null)
          throw new InvalidArgumentError("responseOptions must be an object");
      }
      /**
       * Mock an undici request with a defined reply.
       */
      reply(replyOptionsCallbackOrStatusCode) {
        if (typeof replyOptionsCallbackOrStatusCode == "function") {
          let wrappedDefaultsCallback = (opts) => {
            let resolvedData = replyOptionsCallbackOrStatusCode(opts);
            if (typeof resolvedData != "object" || resolvedData === null)
              throw new InvalidArgumentError("reply options callback must return an object");
            let replyParameters2 = { data: "", responseOptions: {}, ...resolvedData };
            return this.validateReplyParameters(replyParameters2), {
              ...this.createMockScopeDispatchData(replyParameters2)
            };
          }, newMockDispatch2 = addMockDispatch(this[kDispatches], this[kDispatchKey], wrappedDefaultsCallback);
          return new MockScope(newMockDispatch2);
        }
        let replyParameters = {
          statusCode: replyOptionsCallbackOrStatusCode,
          data: arguments[1] === void 0 ? "" : arguments[1],
          responseOptions: arguments[2] === void 0 ? {} : arguments[2]
        };
        this.validateReplyParameters(replyParameters);
        let dispatchData = this.createMockScopeDispatchData(replyParameters), newMockDispatch = addMockDispatch(this[kDispatches], this[kDispatchKey], dispatchData);
        return new MockScope(newMockDispatch);
      }
      /**
       * Mock an undici request with a defined error.
       */
      replyWithError(error2) {
        if (typeof error2 > "u")
          throw new InvalidArgumentError("error must be defined");
        let newMockDispatch = addMockDispatch(this[kDispatches], this[kDispatchKey], { error: error2 });
        return new MockScope(newMockDispatch);
      }
      /**
       * Set default reply headers on the interceptor for subsequent replies
       */
      defaultReplyHeaders(headers) {
        if (typeof headers > "u")
          throw new InvalidArgumentError("headers must be defined");
        return this[kDefaultHeaders] = headers, this;
      }
      /**
       * Set default reply trailers on the interceptor for subsequent replies
       */
      defaultReplyTrailers(trailers) {
        if (typeof trailers > "u")
          throw new InvalidArgumentError("trailers must be defined");
        return this[kDefaultTrailers] = trailers, this;
      }
      /**
       * Set reply content length header for replies on the interceptor
       */
      replyContentLength() {
        return this[kContentLength] = !0, this;
      }
    };
    module.exports.MockInterceptor = MockInterceptor;
    module.exports.MockScope = MockScope;
  }
});

// node_modules/undici/lib/mock/mock-client.js
var require_mock_client = __commonJS({
  "node_modules/undici/lib/mock/mock-client.js"(exports, module) {
    "use strict";
    var { promisify } = __require("node:util"), Client = require_client(), { buildMockDispatch } = require_mock_utils(), {
      kDispatches,
      kMockAgent,
      kClose,
      kOriginalClose,
      kOrigin,
      kOriginalDispatch,
      kConnected
    } = require_mock_symbols(), { MockInterceptor } = require_mock_interceptor(), Symbols = require_symbols(), { InvalidArgumentError } = require_errors(), MockClient = class extends Client {
      constructor(origin, opts) {
        if (super(origin, opts), !opts || !opts.agent || typeof opts.agent.dispatch != "function")
          throw new InvalidArgumentError("Argument opts.agent must implement Agent");
        this[kMockAgent] = opts.agent, this[kOrigin] = origin, this[kDispatches] = [], this[kConnected] = 1, this[kOriginalDispatch] = this.dispatch, this[kOriginalClose] = this.close.bind(this), this.dispatch = buildMockDispatch.call(this), this.close = this[kClose];
      }
      get [Symbols.kConnected]() {
        return this[kConnected];
      }
      /**
       * Sets up the base interceptor for mocking replies from undici.
       */
      intercept(opts) {
        return new MockInterceptor(opts, this[kDispatches]);
      }
      async [kClose]() {
        await promisify(this[kOriginalClose])(), this[kConnected] = 0, this[kMockAgent][Symbols.kClients].delete(this[kOrigin]);
      }
    };
    module.exports = MockClient;
  }
});

// node_modules/undici/lib/mock/mock-pool.js
var require_mock_pool = __commonJS({
  "node_modules/undici/lib/mock/mock-pool.js"(exports, module) {
    "use strict";
    var { promisify } = __require("node:util"), Pool = require_pool(), { buildMockDispatch } = require_mock_utils(), {
      kDispatches,
      kMockAgent,
      kClose,
      kOriginalClose,
      kOrigin,
      kOriginalDispatch,
      kConnected
    } = require_mock_symbols(), { MockInterceptor } = require_mock_interceptor(), Symbols = require_symbols(), { InvalidArgumentError } = require_errors(), MockPool = class extends Pool {
      constructor(origin, opts) {
        if (super(origin, opts), !opts || !opts.agent || typeof opts.agent.dispatch != "function")
          throw new InvalidArgumentError("Argument opts.agent must implement Agent");
        this[kMockAgent] = opts.agent, this[kOrigin] = origin, this[kDispatches] = [], this[kConnected] = 1, this[kOriginalDispatch] = this.dispatch, this[kOriginalClose] = this.close.bind(this), this.dispatch = buildMockDispatch.call(this), this.close = this[kClose];
      }
      get [Symbols.kConnected]() {
        return this[kConnected];
      }
      /**
       * Sets up the base interceptor for mocking replies from undici.
       */
      intercept(opts) {
        return new MockInterceptor(opts, this[kDispatches]);
      }
      async [kClose]() {
        await promisify(this[kOriginalClose])(), this[kConnected] = 0, this[kMockAgent][Symbols.kClients].delete(this[kOrigin]);
      }
    };
    module.exports = MockPool;
  }
});

// node_modules/undici/lib/mock/pluralizer.js
var require_pluralizer = __commonJS({
  "node_modules/undici/lib/mock/pluralizer.js"(exports, module) {
    "use strict";
    var singulars = {
      pronoun: "it",
      is: "is",
      was: "was",
      this: "this"
    }, plurals = {
      pronoun: "they",
      is: "are",
      was: "were",
      this: "these"
    };
    module.exports = class {
      constructor(singular, plural) {
        this.singular = singular, this.plural = plural;
      }
      pluralize(count) {
        let one = count === 1, keys = one ? singulars : plurals, noun = one ? this.singular : this.plural;
        return { ...keys, count, noun };
      }
    };
  }
});

// node_modules/undici/lib/mock/pending-interceptors-formatter.js
var require_pending_interceptors_formatter = __commonJS({
  "node_modules/undici/lib/mock/pending-interceptors-formatter.js"(exports, module) {
    "use strict";
    var { Transform } = __require("node:stream"), { Console } = __require("node:console"), PERSISTENT = process.versions.icu ? "\u2705" : "Y ", NOT_PERSISTENT = process.versions.icu ? "\u274C" : "N ";
    module.exports = class {
      constructor({ disableColors } = {}) {
        this.transform = new Transform({
          transform(chunk, _enc, cb) {
            cb(null, chunk);
          }
        }), this.logger = new Console({
          stdout: this.transform,
          inspectOptions: {
            colors: !disableColors && !process.env.CI
          }
        });
      }
      format(pendingInterceptors) {
        let withPrettyHeaders = pendingInterceptors.map(
          ({ method, path: path4, data: { statusCode }, persist, times, timesInvoked, origin }) => ({
            Method: method,
            Origin: origin,
            Path: path4,
            "Status code": statusCode,
            Persistent: persist ? PERSISTENT : NOT_PERSISTENT,
            Invocations: timesInvoked,
            Remaining: persist ? 1 / 0 : times - timesInvoked
          })
        );
        return this.logger.table(withPrettyHeaders), this.transform.read().toString();
      }
    };
  }
});

// node_modules/undici/lib/mock/mock-agent.js
var require_mock_agent = __commonJS({
  "node_modules/undici/lib/mock/mock-agent.js"(exports, module) {
    "use strict";
    var { kClients } = require_symbols(), Agent = require_agent(), {
      kAgent,
      kMockAgentSet,
      kMockAgentGet,
      kDispatches,
      kIsMockActive,
      kNetConnect,
      kGetNetConnect,
      kOptions,
      kFactory
    } = require_mock_symbols(), MockClient = require_mock_client(), MockPool = require_mock_pool(), { matchValue, buildMockOptions } = require_mock_utils(), { InvalidArgumentError, UndiciError } = require_errors(), Dispatcher = require_dispatcher(), Pluralizer = require_pluralizer(), PendingInterceptorsFormatter = require_pending_interceptors_formatter(), MockAgent = class extends Dispatcher {
      constructor(opts) {
        if (super(opts), this[kNetConnect] = !0, this[kIsMockActive] = !0, opts?.agent && typeof opts.agent.dispatch != "function")
          throw new InvalidArgumentError("Argument opts.agent must implement Agent");
        let agent = opts?.agent ? opts.agent : new Agent(opts);
        this[kAgent] = agent, this[kClients] = agent[kClients], this[kOptions] = buildMockOptions(opts);
      }
      get(origin) {
        let dispatcher = this[kMockAgentGet](origin);
        return dispatcher || (dispatcher = this[kFactory](origin), this[kMockAgentSet](origin, dispatcher)), dispatcher;
      }
      dispatch(opts, handler) {
        return this.get(opts.origin), this[kAgent].dispatch(opts, handler);
      }
      async close() {
        await this[kAgent].close(), this[kClients].clear();
      }
      deactivate() {
        this[kIsMockActive] = !1;
      }
      activate() {
        this[kIsMockActive] = !0;
      }
      enableNetConnect(matcher) {
        if (typeof matcher == "string" || typeof matcher == "function" || matcher instanceof RegExp)
          Array.isArray(this[kNetConnect]) ? this[kNetConnect].push(matcher) : this[kNetConnect] = [matcher];
        else if (typeof matcher > "u")
          this[kNetConnect] = !0;
        else
          throw new InvalidArgumentError("Unsupported matcher. Must be one of String|Function|RegExp.");
      }
      disableNetConnect() {
        this[kNetConnect] = !1;
      }
      // This is required to bypass issues caused by using global symbols - see:
      // https://github.com/nodejs/undici/issues/1447
      get isMockActive() {
        return this[kIsMockActive];
      }
      [kMockAgentSet](origin, dispatcher) {
        this[kClients].set(origin, dispatcher);
      }
      [kFactory](origin) {
        let mockOptions = Object.assign({ agent: this }, this[kOptions]);
        return this[kOptions] && this[kOptions].connections === 1 ? new MockClient(origin, mockOptions) : new MockPool(origin, mockOptions);
      }
      [kMockAgentGet](origin) {
        let client = this[kClients].get(origin);
        if (client)
          return client;
        if (typeof origin != "string") {
          let dispatcher = this[kFactory]("http://localhost:9999");
          return this[kMockAgentSet](origin, dispatcher), dispatcher;
        }
        for (let [keyMatcher, nonExplicitDispatcher] of Array.from(this[kClients]))
          if (nonExplicitDispatcher && typeof keyMatcher != "string" && matchValue(keyMatcher, origin)) {
            let dispatcher = this[kFactory](origin);
            return this[kMockAgentSet](origin, dispatcher), dispatcher[kDispatches] = nonExplicitDispatcher[kDispatches], dispatcher;
          }
      }
      [kGetNetConnect]() {
        return this[kNetConnect];
      }
      pendingInterceptors() {
        let mockAgentClients = this[kClients];
        return Array.from(mockAgentClients.entries()).flatMap(([origin, scope]) => scope[kDispatches].map((dispatch) => ({ ...dispatch, origin }))).filter(({ pending }) => pending);
      }
      assertNoPendingInterceptors({ pendingInterceptorsFormatter = new PendingInterceptorsFormatter() } = {}) {
        let pending = this.pendingInterceptors();
        if (pending.length === 0)
          return;
        let pluralizer = new Pluralizer("interceptor", "interceptors").pluralize(pending.length);
        throw new UndiciError(`
${pluralizer.count} ${pluralizer.noun} ${pluralizer.is} pending:

${pendingInterceptorsFormatter.format(pending)}
`.trim());
      }
    };
    module.exports = MockAgent;
  }
});

// node_modules/undici/lib/global.js
var require_global2 = __commonJS({
  "node_modules/undici/lib/global.js"(exports, module) {
    "use strict";
    var globalDispatcher = /* @__PURE__ */ Symbol.for("undici.globalDispatcher.1"), { InvalidArgumentError } = require_errors(), Agent = require_agent();
    getGlobalDispatcher() === void 0 && setGlobalDispatcher(new Agent());
    function setGlobalDispatcher(agent) {
      if (!agent || typeof agent.dispatch != "function")
        throw new InvalidArgumentError("Argument agent must implement Agent");
      Object.defineProperty(globalThis, globalDispatcher, {
        value: agent,
        writable: !0,
        enumerable: !1,
        configurable: !1
      });
    }
    function getGlobalDispatcher() {
      return globalThis[globalDispatcher];
    }
    module.exports = {
      setGlobalDispatcher,
      getGlobalDispatcher
    };
  }
});

// node_modules/undici/lib/handler/decorator-handler.js
var require_decorator_handler = __commonJS({
  "node_modules/undici/lib/handler/decorator-handler.js"(exports, module) {
    "use strict";
    module.exports = class {
      #handler;
      constructor(handler) {
        if (typeof handler != "object" || handler === null)
          throw new TypeError("handler must be an object");
        this.#handler = handler;
      }
      onConnect(...args) {
        return this.#handler.onConnect?.(...args);
      }
      onError(...args) {
        return this.#handler.onError?.(...args);
      }
      onUpgrade(...args) {
        return this.#handler.onUpgrade?.(...args);
      }
      onResponseStarted(...args) {
        return this.#handler.onResponseStarted?.(...args);
      }
      onHeaders(...args) {
        return this.#handler.onHeaders?.(...args);
      }
      onData(...args) {
        return this.#handler.onData?.(...args);
      }
      onComplete(...args) {
        return this.#handler.onComplete?.(...args);
      }
      onBodySent(...args) {
        return this.#handler.onBodySent?.(...args);
      }
    };
  }
});

// node_modules/undici/lib/interceptor/redirect.js
var require_redirect = __commonJS({
  "node_modules/undici/lib/interceptor/redirect.js"(exports, module) {
    "use strict";
    var RedirectHandler = require_redirect_handler();
    module.exports = (opts) => {
      let globalMaxRedirections = opts?.maxRedirections;
      return (dispatch) => function(opts2, handler) {
        let { maxRedirections = globalMaxRedirections, ...baseOpts } = opts2;
        if (!maxRedirections)
          return dispatch(opts2, handler);
        let redirectHandler = new RedirectHandler(
          dispatch,
          maxRedirections,
          opts2,
          handler
        );
        return dispatch(baseOpts, redirectHandler);
      };
    };
  }
});

// node_modules/undici/lib/interceptor/retry.js
var require_retry = __commonJS({
  "node_modules/undici/lib/interceptor/retry.js"(exports, module) {
    "use strict";
    var RetryHandler = require_retry_handler();
    module.exports = (globalOpts) => (dispatch) => function(opts, handler) {
      return dispatch(
        opts,
        new RetryHandler(
          { ...opts, retryOptions: { ...globalOpts, ...opts.retryOptions } },
          {
            handler,
            dispatch
          }
        )
      );
    };
  }
});

// node_modules/undici/lib/interceptor/dump.js
var require_dump = __commonJS({
  "node_modules/undici/lib/interceptor/dump.js"(exports, module) {
    "use strict";
    var util = require_util(), { InvalidArgumentError, RequestAbortedError } = require_errors(), DecoratorHandler = require_decorator_handler(), DumpHandler = class extends DecoratorHandler {
      #maxSize = 1024 * 1024;
      #abort = null;
      #dumped = !1;
      #aborted = !1;
      #size = 0;
      #reason = null;
      #handler = null;
      constructor({ maxSize }, handler) {
        if (super(handler), maxSize != null && (!Number.isFinite(maxSize) || maxSize < 1))
          throw new InvalidArgumentError("maxSize must be a number greater than 0");
        this.#maxSize = maxSize ?? this.#maxSize, this.#handler = handler;
      }
      onConnect(abort) {
        this.#abort = abort, this.#handler.onConnect(this.#customAbort.bind(this));
      }
      #customAbort(reason) {
        this.#aborted = !0, this.#reason = reason;
      }
      // TODO: will require adjustment after new hooks are out
      onHeaders(statusCode, rawHeaders, resume, statusMessage) {
        let contentLength = util.parseHeaders(rawHeaders)["content-length"];
        if (contentLength != null && contentLength > this.#maxSize)
          throw new RequestAbortedError(
            `Response size (${contentLength}) larger than maxSize (${this.#maxSize})`
          );
        return this.#aborted ? !0 : this.#handler.onHeaders(
          statusCode,
          rawHeaders,
          resume,
          statusMessage
        );
      }
      onError(err) {
        this.#dumped || (err = this.#reason ?? err, this.#handler.onError(err));
      }
      onData(chunk) {
        return this.#size = this.#size + chunk.length, this.#size >= this.#maxSize && (this.#dumped = !0, this.#aborted ? this.#handler.onError(this.#reason) : this.#handler.onComplete([])), !0;
      }
      onComplete(trailers) {
        if (!this.#dumped) {
          if (this.#aborted) {
            this.#handler.onError(this.reason);
            return;
          }
          this.#handler.onComplete(trailers);
        }
      }
    };
    function createDumpInterceptor({ maxSize: defaultMaxSize } = {
      maxSize: 1024 * 1024
    }) {
      return (dispatch) => function(opts, handler) {
        let { dumpMaxSize = defaultMaxSize } = opts, dumpHandler = new DumpHandler(
          { maxSize: dumpMaxSize },
          handler
        );
        return dispatch(opts, dumpHandler);
      };
    }
    module.exports = createDumpInterceptor;
  }
});

// node_modules/undici/lib/interceptor/dns.js
var require_dns = __commonJS({
  "node_modules/undici/lib/interceptor/dns.js"(exports, module) {
    "use strict";
    var { isIP } = __require("node:net"), { lookup } = __require("node:dns"), DecoratorHandler = require_decorator_handler(), { InvalidArgumentError, InformationalError } = require_errors(), maxInt = Math.pow(2, 31) - 1, DNSInstance = class {
      #maxTTL = 0;
      #maxItems = 0;
      #records = /* @__PURE__ */ new Map();
      dualStack = !0;
      affinity = null;
      lookup = null;
      pick = null;
      constructor(opts) {
        this.#maxTTL = opts.maxTTL, this.#maxItems = opts.maxItems, this.dualStack = opts.dualStack, this.affinity = opts.affinity, this.lookup = opts.lookup ?? this.#defaultLookup, this.pick = opts.pick ?? this.#defaultPick;
      }
      get full() {
        return this.#records.size === this.#maxItems;
      }
      runLookup(origin, opts, cb) {
        let ips = this.#records.get(origin.hostname);
        if (ips == null && this.full) {
          cb(null, origin.origin);
          return;
        }
        let newOpts = {
          affinity: this.affinity,
          dualStack: this.dualStack,
          lookup: this.lookup,
          pick: this.pick,
          ...opts.dns,
          maxTTL: this.#maxTTL,
          maxItems: this.#maxItems
        };
        if (ips == null)
          this.lookup(origin, newOpts, (err, addresses) => {
            if (err || addresses == null || addresses.length === 0) {
              cb(err ?? new InformationalError("No DNS entries found"));
              return;
            }
            this.setRecords(origin, addresses);
            let records = this.#records.get(origin.hostname), ip = this.pick(
              origin,
              records,
              newOpts.affinity
            ), port;
            typeof ip.port == "number" ? port = `:${ip.port}` : origin.port !== "" ? port = `:${origin.port}` : port = "", cb(
              null,
              `${origin.protocol}//${ip.family === 6 ? `[${ip.address}]` : ip.address}${port}`
            );
          });
        else {
          let ip = this.pick(
            origin,
            ips,
            newOpts.affinity
          );
          if (ip == null) {
            this.#records.delete(origin.hostname), this.runLookup(origin, opts, cb);
            return;
          }
          let port;
          typeof ip.port == "number" ? port = `:${ip.port}` : origin.port !== "" ? port = `:${origin.port}` : port = "", cb(
            null,
            `${origin.protocol}//${ip.family === 6 ? `[${ip.address}]` : ip.address}${port}`
          );
        }
      }
      #defaultLookup(origin, opts, cb) {
        lookup(
          origin.hostname,
          {
            all: !0,
            family: this.dualStack === !1 ? this.affinity : 0,
            order: "ipv4first"
          },
          (err, addresses) => {
            if (err)
              return cb(err);
            let results = /* @__PURE__ */ new Map();
            for (let addr of addresses)
              results.set(`${addr.address}:${addr.family}`, addr);
            cb(null, results.values());
          }
        );
      }
      #defaultPick(origin, hostnameRecords, affinity) {
        let ip = null, { records, offset } = hostnameRecords, family;
        if (this.dualStack ? (affinity == null && (offset == null || offset === maxInt ? (hostnameRecords.offset = 0, affinity = 4) : (hostnameRecords.offset++, affinity = (hostnameRecords.offset & 1) === 1 ? 6 : 4)), records[affinity] != null && records[affinity].ips.length > 0 ? family = records[affinity] : family = records[affinity === 4 ? 6 : 4]) : family = records[affinity], family == null || family.ips.length === 0)
          return ip;
        family.offset == null || family.offset === maxInt ? family.offset = 0 : family.offset++;
        let position = family.offset % family.ips.length;
        return ip = family.ips[position] ?? null, ip == null ? ip : Date.now() - ip.timestamp > ip.ttl ? (family.ips.splice(position, 1), this.pick(origin, hostnameRecords, affinity)) : ip;
      }
      setRecords(origin, addresses) {
        let timestamp = Date.now(), records = { records: { 4: null, 6: null } };
        for (let record of addresses) {
          record.timestamp = timestamp, typeof record.ttl == "number" ? record.ttl = Math.min(record.ttl, this.#maxTTL) : record.ttl = this.#maxTTL;
          let familyRecords = records.records[record.family] ?? { ips: [] };
          familyRecords.ips.push(record), records.records[record.family] = familyRecords;
        }
        this.#records.set(origin.hostname, records);
      }
      getHandler(meta, opts) {
        return new DNSDispatchHandler(this, meta, opts);
      }
    }, DNSDispatchHandler = class extends DecoratorHandler {
      #state = null;
      #opts = null;
      #dispatch = null;
      #handler = null;
      #origin = null;
      constructor(state, { origin, handler, dispatch }, opts) {
        super(handler), this.#origin = origin, this.#handler = handler, this.#opts = { ...opts }, this.#state = state, this.#dispatch = dispatch;
      }
      onError(err) {
        switch (err.code) {
          case "ETIMEDOUT":
          case "ECONNREFUSED": {
            if (this.#state.dualStack) {
              this.#state.runLookup(this.#origin, this.#opts, (err2, newOrigin) => {
                if (err2)
                  return this.#handler.onError(err2);
                let dispatchOpts = {
                  ...this.#opts,
                  origin: newOrigin
                };
                this.#dispatch(dispatchOpts, this);
              });
              return;
            }
            this.#handler.onError(err);
            return;
          }
          case "ENOTFOUND":
            this.#state.deleteRecord(this.#origin);
          // eslint-disable-next-line no-fallthrough
          default:
            this.#handler.onError(err);
            break;
        }
      }
    };
    module.exports = (interceptorOpts) => {
      if (interceptorOpts?.maxTTL != null && (typeof interceptorOpts?.maxTTL != "number" || interceptorOpts?.maxTTL < 0))
        throw new InvalidArgumentError("Invalid maxTTL. Must be a positive number");
      if (interceptorOpts?.maxItems != null && (typeof interceptorOpts?.maxItems != "number" || interceptorOpts?.maxItems < 1))
        throw new InvalidArgumentError(
          "Invalid maxItems. Must be a positive number and greater than zero"
        );
      if (interceptorOpts?.affinity != null && interceptorOpts?.affinity !== 4 && interceptorOpts?.affinity !== 6)
        throw new InvalidArgumentError("Invalid affinity. Must be either 4 or 6");
      if (interceptorOpts?.dualStack != null && typeof interceptorOpts?.dualStack != "boolean")
        throw new InvalidArgumentError("Invalid dualStack. Must be a boolean");
      if (interceptorOpts?.lookup != null && typeof interceptorOpts?.lookup != "function")
        throw new InvalidArgumentError("Invalid lookup. Must be a function");
      if (interceptorOpts?.pick != null && typeof interceptorOpts?.pick != "function")
        throw new InvalidArgumentError("Invalid pick. Must be a function");
      let dualStack = interceptorOpts?.dualStack ?? !0, affinity;
      dualStack ? affinity = interceptorOpts?.affinity ?? null : affinity = interceptorOpts?.affinity ?? 4;
      let opts = {
        maxTTL: interceptorOpts?.maxTTL ?? 1e4,
        // Expressed in ms
        lookup: interceptorOpts?.lookup ?? null,
        pick: interceptorOpts?.pick ?? null,
        dualStack,
        affinity,
        maxItems: interceptorOpts?.maxItems ?? 1 / 0
      }, instance = new DNSInstance(opts);
      return (dispatch) => function(origDispatchOpts, handler) {
        let origin = origDispatchOpts.origin.constructor === URL ? origDispatchOpts.origin : new URL(origDispatchOpts.origin);
        return isIP(origin.hostname) !== 0 ? dispatch(origDispatchOpts, handler) : (instance.runLookup(origin, origDispatchOpts, (err, newOrigin) => {
          if (err)
            return handler.onError(err);
          let dispatchOpts = null;
          dispatchOpts = {
            ...origDispatchOpts,
            servername: origin.hostname,
            // For SNI on TLS
            origin: newOrigin,
            headers: {
              host: origin.hostname,
              ...origDispatchOpts.headers
            }
          }, dispatch(
            dispatchOpts,
            instance.getHandler({ origin, dispatch, handler }, origDispatchOpts)
          );
        }), !0);
      };
    };
  }
});

// node_modules/undici/lib/web/fetch/headers.js
var require_headers = __commonJS({
  "node_modules/undici/lib/web/fetch/headers.js"(exports, module) {
    "use strict";
    var { kConstruct } = require_symbols(), { kEnumerableProperty } = require_util(), {
      iteratorMixin,
      isValidHeaderName,
      isValidHeaderValue
    } = require_util2(), { webidl } = require_webidl(), assert = __require("node:assert"), util = __require("node:util"), kHeadersMap = /* @__PURE__ */ Symbol("headers map"), kHeadersSortedMap = /* @__PURE__ */ Symbol("headers map sorted");
    function isHTTPWhiteSpaceCharCode(code) {
      return code === 10 || code === 13 || code === 9 || code === 32;
    }
    function headerValueNormalize(potentialValue) {
      let i = 0, j = potentialValue.length;
      for (; j > i && isHTTPWhiteSpaceCharCode(potentialValue.charCodeAt(j - 1)); ) --j;
      for (; j > i && isHTTPWhiteSpaceCharCode(potentialValue.charCodeAt(i)); ) ++i;
      return i === 0 && j === potentialValue.length ? potentialValue : potentialValue.substring(i, j);
    }
    function fill(headers, object) {
      if (Array.isArray(object))
        for (let i = 0; i < object.length; ++i) {
          let header = object[i];
          if (header.length !== 2)
            throw webidl.errors.exception({
              header: "Headers constructor",
              message: `expected name/value pair to be length 2, found ${header.length}.`
            });
          appendHeader(headers, header[0], header[1]);
        }
      else if (typeof object == "object" && object !== null) {
        let keys = Object.keys(object);
        for (let i = 0; i < keys.length; ++i)
          appendHeader(headers, keys[i], object[keys[i]]);
      } else
        throw webidl.errors.conversionFailed({
          prefix: "Headers constructor",
          argument: "Argument 1",
          types: ["sequence<sequence<ByteString>>", "record<ByteString, ByteString>"]
        });
    }
    function appendHeader(headers, name, value) {
      if (value = headerValueNormalize(value), isValidHeaderName(name)) {
        if (!isValidHeaderValue(value))
          throw webidl.errors.invalidArgument({
            prefix: "Headers.append",
            value,
            type: "header value"
          });
      } else throw webidl.errors.invalidArgument({
        prefix: "Headers.append",
        value: name,
        type: "header name"
      });
      if (getHeadersGuard(headers) === "immutable")
        throw new TypeError("immutable");
      return getHeadersList(headers).append(name, value, !1);
    }
    function compareHeaderName(a, b) {
      return a[0] < b[0] ? -1 : 1;
    }
    var HeadersList = class _HeadersList {
      /** @type {[string, string][]|null} */
      cookies = null;
      constructor(init) {
        init instanceof _HeadersList ? (this[kHeadersMap] = new Map(init[kHeadersMap]), this[kHeadersSortedMap] = init[kHeadersSortedMap], this.cookies = init.cookies === null ? null : [...init.cookies]) : (this[kHeadersMap] = new Map(init), this[kHeadersSortedMap] = null);
      }
      /**
       * @see https://fetch.spec.whatwg.org/#header-list-contains
       * @param {string} name
       * @param {boolean} isLowerCase
       */
      contains(name, isLowerCase) {
        return this[kHeadersMap].has(isLowerCase ? name : name.toLowerCase());
      }
      clear() {
        this[kHeadersMap].clear(), this[kHeadersSortedMap] = null, this.cookies = null;
      }
      /**
       * @see https://fetch.spec.whatwg.org/#concept-header-list-append
       * @param {string} name
       * @param {string} value
       * @param {boolean} isLowerCase
       */
      append(name, value, isLowerCase) {
        this[kHeadersSortedMap] = null;
        let lowercaseName = isLowerCase ? name : name.toLowerCase(), exists3 = this[kHeadersMap].get(lowercaseName);
        if (exists3) {
          let delimiter2 = lowercaseName === "cookie" ? "; " : ", ";
          this[kHeadersMap].set(lowercaseName, {
            name: exists3.name,
            value: `${exists3.value}${delimiter2}${value}`
          });
        } else
          this[kHeadersMap].set(lowercaseName, { name, value });
        lowercaseName === "set-cookie" && (this.cookies ??= []).push(value);
      }
      /**
       * @see https://fetch.spec.whatwg.org/#concept-header-list-set
       * @param {string} name
       * @param {string} value
       * @param {boolean} isLowerCase
       */
      set(name, value, isLowerCase) {
        this[kHeadersSortedMap] = null;
        let lowercaseName = isLowerCase ? name : name.toLowerCase();
        lowercaseName === "set-cookie" && (this.cookies = [value]), this[kHeadersMap].set(lowercaseName, { name, value });
      }
      /**
       * @see https://fetch.spec.whatwg.org/#concept-header-list-delete
       * @param {string} name
       * @param {boolean} isLowerCase
       */
      delete(name, isLowerCase) {
        this[kHeadersSortedMap] = null, isLowerCase || (name = name.toLowerCase()), name === "set-cookie" && (this.cookies = null), this[kHeadersMap].delete(name);
      }
      /**
       * @see https://fetch.spec.whatwg.org/#concept-header-list-get
       * @param {string} name
       * @param {boolean} isLowerCase
       * @returns {string | null}
       */
      get(name, isLowerCase) {
        return this[kHeadersMap].get(isLowerCase ? name : name.toLowerCase())?.value ?? null;
      }
      *[Symbol.iterator]() {
        for (let { 0: name, 1: { value } } of this[kHeadersMap])
          yield [name, value];
      }
      get entries() {
        let headers = {};
        if (this[kHeadersMap].size !== 0)
          for (let { name, value } of this[kHeadersMap].values())
            headers[name] = value;
        return headers;
      }
      rawValues() {
        return this[kHeadersMap].values();
      }
      get entriesList() {
        let headers = [];
        if (this[kHeadersMap].size !== 0)
          for (let { 0: lowerName, 1: { name, value } } of this[kHeadersMap])
            if (lowerName === "set-cookie")
              for (let cookie of this.cookies)
                headers.push([name, cookie]);
            else
              headers.push([name, value]);
        return headers;
      }
      // https://fetch.spec.whatwg.org/#convert-header-names-to-a-sorted-lowercase-set
      toSortedArray() {
        let size = this[kHeadersMap].size, array = new Array(size);
        if (size <= 32) {
          if (size === 0)
            return array;
          let iterator = this[kHeadersMap][Symbol.iterator](), firstValue = iterator.next().value;
          array[0] = [firstValue[0], firstValue[1].value], assert(firstValue[1].value !== null);
          for (let i = 1, j = 0, right = 0, left = 0, pivot = 0, x, value; i < size; ++i) {
            for (value = iterator.next().value, x = array[i] = [value[0], value[1].value], assert(x[1] !== null), left = 0, right = i; left < right; )
              pivot = left + (right - left >> 1), array[pivot][0] <= x[0] ? left = pivot + 1 : right = pivot;
            if (i !== pivot) {
              for (j = i; j > left; )
                array[j] = array[--j];
              array[left] = x;
            }
          }
          if (!iterator.next().done)
            throw new TypeError("Unreachable");
          return array;
        } else {
          let i = 0;
          for (let { 0: name, 1: { value } } of this[kHeadersMap])
            array[i++] = [name, value], assert(value !== null);
          return array.sort(compareHeaderName);
        }
      }
    }, Headers2 = class _Headers {
      #guard;
      #headersList;
      constructor(init = void 0) {
        webidl.util.markAsUncloneable(this), init !== kConstruct && (this.#headersList = new HeadersList(), this.#guard = "none", init !== void 0 && (init = webidl.converters.HeadersInit(init, "Headers contructor", "init"), fill(this, init)));
      }
      // https://fetch.spec.whatwg.org/#dom-headers-append
      append(name, value) {
        webidl.brandCheck(this, _Headers), webidl.argumentLengthCheck(arguments, 2, "Headers.append");
        let prefix = "Headers.append";
        return name = webidl.converters.ByteString(name, prefix, "name"), value = webidl.converters.ByteString(value, prefix, "value"), appendHeader(this, name, value);
      }
      // https://fetch.spec.whatwg.org/#dom-headers-delete
      delete(name) {
        if (webidl.brandCheck(this, _Headers), webidl.argumentLengthCheck(arguments, 1, "Headers.delete"), name = webidl.converters.ByteString(name, "Headers.delete", "name"), !isValidHeaderName(name))
          throw webidl.errors.invalidArgument({
            prefix: "Headers.delete",
            value: name,
            type: "header name"
          });
        if (this.#guard === "immutable")
          throw new TypeError("immutable");
        this.#headersList.contains(name, !1) && this.#headersList.delete(name, !1);
      }
      // https://fetch.spec.whatwg.org/#dom-headers-get
      get(name) {
        webidl.brandCheck(this, _Headers), webidl.argumentLengthCheck(arguments, 1, "Headers.get");
        let prefix = "Headers.get";
        if (name = webidl.converters.ByteString(name, prefix, "name"), !isValidHeaderName(name))
          throw webidl.errors.invalidArgument({
            prefix,
            value: name,
            type: "header name"
          });
        return this.#headersList.get(name, !1);
      }
      // https://fetch.spec.whatwg.org/#dom-headers-has
      has(name) {
        webidl.brandCheck(this, _Headers), webidl.argumentLengthCheck(arguments, 1, "Headers.has");
        let prefix = "Headers.has";
        if (name = webidl.converters.ByteString(name, prefix, "name"), !isValidHeaderName(name))
          throw webidl.errors.invalidArgument({
            prefix,
            value: name,
            type: "header name"
          });
        return this.#headersList.contains(name, !1);
      }
      // https://fetch.spec.whatwg.org/#dom-headers-set
      set(name, value) {
        webidl.brandCheck(this, _Headers), webidl.argumentLengthCheck(arguments, 2, "Headers.set");
        let prefix = "Headers.set";
        if (name = webidl.converters.ByteString(name, prefix, "name"), value = webidl.converters.ByteString(value, prefix, "value"), value = headerValueNormalize(value), isValidHeaderName(name)) {
          if (!isValidHeaderValue(value))
            throw webidl.errors.invalidArgument({
              prefix,
              value,
              type: "header value"
            });
        } else throw webidl.errors.invalidArgument({
          prefix,
          value: name,
          type: "header name"
        });
        if (this.#guard === "immutable")
          throw new TypeError("immutable");
        this.#headersList.set(name, value, !1);
      }
      // https://fetch.spec.whatwg.org/#dom-headers-getsetcookie
      getSetCookie() {
        webidl.brandCheck(this, _Headers);
        let list = this.#headersList.cookies;
        return list ? [...list] : [];
      }
      // https://fetch.spec.whatwg.org/#concept-header-list-sort-and-combine
      get [kHeadersSortedMap]() {
        if (this.#headersList[kHeadersSortedMap])
          return this.#headersList[kHeadersSortedMap];
        let headers = [], names = this.#headersList.toSortedArray(), cookies = this.#headersList.cookies;
        if (cookies === null || cookies.length === 1)
          return this.#headersList[kHeadersSortedMap] = names;
        for (let i = 0; i < names.length; ++i) {
          let { 0: name, 1: value } = names[i];
          if (name === "set-cookie")
            for (let j = 0; j < cookies.length; ++j)
              headers.push([name, cookies[j]]);
          else
            headers.push([name, value]);
        }
        return this.#headersList[kHeadersSortedMap] = headers;
      }
      [util.inspect.custom](depth, options) {
        return options.depth ??= depth, `Headers ${util.formatWithOptions(options, this.#headersList.entries)}`;
      }
      static getHeadersGuard(o) {
        return o.#guard;
      }
      static setHeadersGuard(o, guard) {
        o.#guard = guard;
      }
      static getHeadersList(o) {
        return o.#headersList;
      }
      static setHeadersList(o, list) {
        o.#headersList = list;
      }
    }, { getHeadersGuard, setHeadersGuard, getHeadersList, setHeadersList } = Headers2;
    Reflect.deleteProperty(Headers2, "getHeadersGuard");
    Reflect.deleteProperty(Headers2, "setHeadersGuard");
    Reflect.deleteProperty(Headers2, "getHeadersList");
    Reflect.deleteProperty(Headers2, "setHeadersList");
    iteratorMixin("Headers", Headers2, kHeadersSortedMap, 0, 1);
    Object.defineProperties(Headers2.prototype, {
      append: kEnumerableProperty,
      delete: kEnumerableProperty,
      get: kEnumerableProperty,
      has: kEnumerableProperty,
      set: kEnumerableProperty,
      getSetCookie: kEnumerableProperty,
      [Symbol.toStringTag]: {
        value: "Headers",
        configurable: !0
      },
      [util.inspect.custom]: {
        enumerable: !1
      }
    });
    webidl.converters.HeadersInit = function(V, prefix, argument) {
      if (webidl.util.Type(V) === "Object") {
        let iterator = Reflect.get(V, Symbol.iterator);
        if (!util.types.isProxy(V) && iterator === Headers2.prototype.entries)
          try {
            return getHeadersList(V).entriesList;
          } catch {
          }
        return typeof iterator == "function" ? webidl.converters["sequence<sequence<ByteString>>"](V, prefix, argument, iterator.bind(V)) : webidl.converters["record<ByteString, ByteString>"](V, prefix, argument);
      }
      throw webidl.errors.conversionFailed({
        prefix: "Headers constructor",
        argument: "Argument 1",
        types: ["sequence<sequence<ByteString>>", "record<ByteString, ByteString>"]
      });
    };
    module.exports = {
      fill,
      // for test.
      compareHeaderName,
      Headers: Headers2,
      HeadersList,
      getHeadersGuard,
      setHeadersGuard,
      setHeadersList,
      getHeadersList
    };
  }
});

// node_modules/undici/lib/web/fetch/response.js
var require_response = __commonJS({
  "node_modules/undici/lib/web/fetch/response.js"(exports, module) {
    "use strict";
    var { Headers: Headers2, HeadersList, fill, getHeadersGuard, setHeadersGuard, setHeadersList } = require_headers(), { extractBody, cloneBody, mixinBody, hasFinalizationRegistry, streamRegistry, bodyUnusable } = require_body(), util = require_util(), nodeUtil = __require("node:util"), { kEnumerableProperty } = util, {
      isValidReasonPhrase,
      isCancelled,
      isAborted,
      isBlobLike,
      serializeJavascriptValueToJSONString,
      isErrorLike,
      isomorphicEncode,
      environmentSettingsObject: relevantRealm
    } = require_util2(), {
      redirectStatusSet,
      nullBodyStatus
    } = require_constants3(), { kState, kHeaders } = require_symbols2(), { webidl } = require_webidl(), { FormData } = require_formdata(), { URLSerializer } = require_data_url(), { kConstruct } = require_symbols(), assert = __require("node:assert"), { types } = __require("node:util"), textEncoder = new TextEncoder("utf-8"), Response = class _Response {
      // Creates network error Response.
      static error() {
        return fromInnerResponse(makeNetworkError(), "immutable");
      }
      // https://fetch.spec.whatwg.org/#dom-response-json
      static json(data, init = {}) {
        webidl.argumentLengthCheck(arguments, 1, "Response.json"), init !== null && (init = webidl.converters.ResponseInit(init));
        let bytes = textEncoder.encode(
          serializeJavascriptValueToJSONString(data)
        ), body = extractBody(bytes), responseObject = fromInnerResponse(makeResponse({}), "response");
        return initializeResponse(responseObject, init, { body: body[0], type: "application/json" }), responseObject;
      }
      // Creates a redirect Response that redirects to url with status status.
      static redirect(url, status = 302) {
        webidl.argumentLengthCheck(arguments, 1, "Response.redirect"), url = webidl.converters.USVString(url), status = webidl.converters["unsigned short"](status);
        let parsedURL;
        try {
          parsedURL = new URL(url, relevantRealm.settingsObject.baseUrl);
        } catch (err) {
          throw new TypeError(`Failed to parse URL from ${url}`, { cause: err });
        }
        if (!redirectStatusSet.has(status))
          throw new RangeError(`Invalid status code ${status}`);
        let responseObject = fromInnerResponse(makeResponse({}), "immutable");
        responseObject[kState].status = status;
        let value = isomorphicEncode(URLSerializer(parsedURL));
        return responseObject[kState].headersList.append("location", value, !0), responseObject;
      }
      // https://fetch.spec.whatwg.org/#dom-response
      constructor(body = null, init = {}) {
        if (webidl.util.markAsUncloneable(this), body === kConstruct)
          return;
        body !== null && (body = webidl.converters.BodyInit(body)), init = webidl.converters.ResponseInit(init), this[kState] = makeResponse({}), this[kHeaders] = new Headers2(kConstruct), setHeadersGuard(this[kHeaders], "response"), setHeadersList(this[kHeaders], this[kState].headersList);
        let bodyWithType = null;
        if (body != null) {
          let [extractedBody, type] = extractBody(body);
          bodyWithType = { body: extractedBody, type };
        }
        initializeResponse(this, init, bodyWithType);
      }
      // Returns response’s type, e.g., "cors".
      get type() {
        return webidl.brandCheck(this, _Response), this[kState].type;
      }
      // Returns response’s URL, if it has one; otherwise the empty string.
      get url() {
        webidl.brandCheck(this, _Response);
        let urlList = this[kState].urlList, url = urlList[urlList.length - 1] ?? null;
        return url === null ? "" : URLSerializer(url, !0);
      }
      // Returns whether response was obtained through a redirect.
      get redirected() {
        return webidl.brandCheck(this, _Response), this[kState].urlList.length > 1;
      }
      // Returns response’s status.
      get status() {
        return webidl.brandCheck(this, _Response), this[kState].status;
      }
      // Returns whether response’s status is an ok status.
      get ok() {
        return webidl.brandCheck(this, _Response), this[kState].status >= 200 && this[kState].status <= 299;
      }
      // Returns response’s status message.
      get statusText() {
        return webidl.brandCheck(this, _Response), this[kState].statusText;
      }
      // Returns response’s headers as Headers.
      get headers() {
        return webidl.brandCheck(this, _Response), this[kHeaders];
      }
      get body() {
        return webidl.brandCheck(this, _Response), this[kState].body ? this[kState].body.stream : null;
      }
      get bodyUsed() {
        return webidl.brandCheck(this, _Response), !!this[kState].body && util.isDisturbed(this[kState].body.stream);
      }
      // Returns a clone of response.
      clone() {
        if (webidl.brandCheck(this, _Response), bodyUnusable(this))
          throw webidl.errors.exception({
            header: "Response.clone",
            message: "Body has already been consumed."
          });
        let clonedResponse = cloneResponse(this[kState]);
        return hasFinalizationRegistry && this[kState].body?.stream && streamRegistry.register(this, new WeakRef(this[kState].body.stream)), fromInnerResponse(clonedResponse, getHeadersGuard(this[kHeaders]));
      }
      [nodeUtil.inspect.custom](depth, options) {
        options.depth === null && (options.depth = 2), options.colors ??= !0;
        let properties = {
          status: this.status,
          statusText: this.statusText,
          headers: this.headers,
          body: this.body,
          bodyUsed: this.bodyUsed,
          ok: this.ok,
          redirected: this.redirected,
          type: this.type,
          url: this.url
        };
        return `Response ${nodeUtil.formatWithOptions(options, properties)}`;
      }
    };
    mixinBody(Response);
    Object.defineProperties(Response.prototype, {
      type: kEnumerableProperty,
      url: kEnumerableProperty,
      status: kEnumerableProperty,
      ok: kEnumerableProperty,
      redirected: kEnumerableProperty,
      statusText: kEnumerableProperty,
      headers: kEnumerableProperty,
      clone: kEnumerableProperty,
      body: kEnumerableProperty,
      bodyUsed: kEnumerableProperty,
      [Symbol.toStringTag]: {
        value: "Response",
        configurable: !0
      }
    });
    Object.defineProperties(Response, {
      json: kEnumerableProperty,
      redirect: kEnumerableProperty,
      error: kEnumerableProperty
    });
    function cloneResponse(response) {
      if (response.internalResponse)
        return filterResponse(
          cloneResponse(response.internalResponse),
          response.type
        );
      let newResponse = makeResponse({ ...response, body: null });
      return response.body != null && (newResponse.body = cloneBody(newResponse, response.body)), newResponse;
    }
    function makeResponse(init) {
      return {
        aborted: !1,
        rangeRequested: !1,
        timingAllowPassed: !1,
        requestIncludesCredentials: !1,
        type: "default",
        status: 200,
        timingInfo: null,
        cacheState: "",
        statusText: "",
        ...init,
        headersList: init?.headersList ? new HeadersList(init?.headersList) : new HeadersList(),
        urlList: init?.urlList ? [...init.urlList] : []
      };
    }
    function makeNetworkError(reason) {
      let isError = isErrorLike(reason);
      return makeResponse({
        type: "error",
        status: 0,
        error: isError ? reason : new Error(reason && String(reason)),
        aborted: reason && reason.name === "AbortError"
      });
    }
    function isNetworkError(response) {
      return (
        // A network error is a response whose type is "error",
        response.type === "error" && // status is 0
        response.status === 0
      );
    }
    function makeFilteredResponse(response, state) {
      return state = {
        internalResponse: response,
        ...state
      }, new Proxy(response, {
        get(target, p) {
          return p in state ? state[p] : target[p];
        },
        set(target, p, value) {
          return assert(!(p in state)), target[p] = value, !0;
        }
      });
    }
    function filterResponse(response, type) {
      if (type === "basic")
        return makeFilteredResponse(response, {
          type: "basic",
          headersList: response.headersList
        });
      if (type === "cors")
        return makeFilteredResponse(response, {
          type: "cors",
          headersList: response.headersList
        });
      if (type === "opaque")
        return makeFilteredResponse(response, {
          type: "opaque",
          urlList: Object.freeze([]),
          status: 0,
          statusText: "",
          body: null
        });
      if (type === "opaqueredirect")
        return makeFilteredResponse(response, {
          type: "opaqueredirect",
          status: 0,
          statusText: "",
          headersList: [],
          body: null
        });
      assert(!1);
    }
    function makeAppropriateNetworkError(fetchParams, err = null) {
      return assert(isCancelled(fetchParams)), isAborted(fetchParams) ? makeNetworkError(Object.assign(new DOMException("The operation was aborted.", "AbortError"), { cause: err })) : makeNetworkError(Object.assign(new DOMException("Request was cancelled."), { cause: err }));
    }
    function initializeResponse(response, init, body) {
      if (init.status !== null && (init.status < 200 || init.status > 599))
        throw new RangeError('init["status"] must be in the range of 200 to 599, inclusive.');
      if ("statusText" in init && init.statusText != null && !isValidReasonPhrase(String(init.statusText)))
        throw new TypeError("Invalid statusText");
      if ("status" in init && init.status != null && (response[kState].status = init.status), "statusText" in init && init.statusText != null && (response[kState].statusText = init.statusText), "headers" in init && init.headers != null && fill(response[kHeaders], init.headers), body) {
        if (nullBodyStatus.includes(response.status))
          throw webidl.errors.exception({
            header: "Response constructor",
            message: `Invalid response status code ${response.status}`
          });
        response[kState].body = body.body, body.type != null && !response[kState].headersList.contains("content-type", !0) && response[kState].headersList.append("content-type", body.type, !0);
      }
    }
    function fromInnerResponse(innerResponse, guard) {
      let response = new Response(kConstruct);
      return response[kState] = innerResponse, response[kHeaders] = new Headers2(kConstruct), setHeadersList(response[kHeaders], innerResponse.headersList), setHeadersGuard(response[kHeaders], guard), hasFinalizationRegistry && innerResponse.body?.stream && streamRegistry.register(response, new WeakRef(innerResponse.body.stream)), response;
    }
    webidl.converters.ReadableStream = webidl.interfaceConverter(
      ReadableStream
    );
    webidl.converters.FormData = webidl.interfaceConverter(
      FormData
    );
    webidl.converters.URLSearchParams = webidl.interfaceConverter(
      URLSearchParams
    );
    webidl.converters.XMLHttpRequestBodyInit = function(V, prefix, name) {
      return typeof V == "string" ? webidl.converters.USVString(V, prefix, name) : isBlobLike(V) ? webidl.converters.Blob(V, prefix, name, { strict: !1 }) : ArrayBuffer.isView(V) || types.isArrayBuffer(V) ? webidl.converters.BufferSource(V, prefix, name) : util.isFormDataLike(V) ? webidl.converters.FormData(V, prefix, name, { strict: !1 }) : V instanceof URLSearchParams ? webidl.converters.URLSearchParams(V, prefix, name) : webidl.converters.DOMString(V, prefix, name);
    };
    webidl.converters.BodyInit = function(V, prefix, argument) {
      return V instanceof ReadableStream ? webidl.converters.ReadableStream(V, prefix, argument) : V?.[Symbol.asyncIterator] ? V : webidl.converters.XMLHttpRequestBodyInit(V, prefix, argument);
    };
    webidl.converters.ResponseInit = webidl.dictionaryConverter([
      {
        key: "status",
        converter: webidl.converters["unsigned short"],
        defaultValue: () => 200
      },
      {
        key: "statusText",
        converter: webidl.converters.ByteString,
        defaultValue: () => ""
      },
      {
        key: "headers",
        converter: webidl.converters.HeadersInit
      }
    ]);
    module.exports = {
      isNetworkError,
      makeNetworkError,
      makeResponse,
      makeAppropriateNetworkError,
      filterResponse,
      Response,
      cloneResponse,
      fromInnerResponse
    };
  }
});

// node_modules/undici/lib/web/fetch/dispatcher-weakref.js
var require_dispatcher_weakref = __commonJS({
  "node_modules/undici/lib/web/fetch/dispatcher-weakref.js"(exports, module) {
    "use strict";
    var { kConnected, kSize } = require_symbols(), CompatWeakRef = class {
      constructor(value) {
        this.value = value;
      }
      deref() {
        return this.value[kConnected] === 0 && this.value[kSize] === 0 ? void 0 : this.value;
      }
    }, CompatFinalizer = class {
      constructor(finalizer) {
        this.finalizer = finalizer;
      }
      register(dispatcher, key) {
        dispatcher.on && dispatcher.on("disconnect", () => {
          dispatcher[kConnected] === 0 && dispatcher[kSize] === 0 && this.finalizer(key);
        });
      }
      unregister(key) {
      }
    };
    module.exports = function() {
      return process.env.NODE_V8_COVERAGE && process.version.startsWith("v18") ? (process._rawDebug("Using compatibility WeakRef and FinalizationRegistry"), {
        WeakRef: CompatWeakRef,
        FinalizationRegistry: CompatFinalizer
      }) : { WeakRef, FinalizationRegistry };
    };
  }
});

// node_modules/undici/lib/web/fetch/request.js
var require_request2 = __commonJS({
  "node_modules/undici/lib/web/fetch/request.js"(exports, module) {
    "use strict";
    var { extractBody, mixinBody, cloneBody, bodyUnusable } = require_body(), { Headers: Headers2, fill: fillHeaders, HeadersList, setHeadersGuard, getHeadersGuard, setHeadersList, getHeadersList } = require_headers(), { FinalizationRegistry: FinalizationRegistry2 } = require_dispatcher_weakref()(), util = require_util(), nodeUtil = __require("node:util"), {
      isValidHTTPToken,
      sameOrigin,
      environmentSettingsObject
    } = require_util2(), {
      forbiddenMethodsSet,
      corsSafeListedMethodsSet,
      referrerPolicy,
      requestRedirect,
      requestMode,
      requestCredentials,
      requestCache,
      requestDuplex
    } = require_constants3(), { kEnumerableProperty, normalizedMethodRecordsBase, normalizedMethodRecords } = util, { kHeaders, kSignal, kState, kDispatcher } = require_symbols2(), { webidl } = require_webidl(), { URLSerializer } = require_data_url(), { kConstruct } = require_symbols(), assert = __require("node:assert"), { getMaxListeners, setMaxListeners, getEventListeners, defaultMaxListeners } = __require("node:events"), kAbortController = /* @__PURE__ */ Symbol("abortController"), requestFinalizer = new FinalizationRegistry2(({ signal, abort }) => {
      signal.removeEventListener("abort", abort);
    }), dependentControllerMap = /* @__PURE__ */ new WeakMap();
    function buildAbort(acRef) {
      return abort;
      function abort() {
        let ac = acRef.deref();
        if (ac !== void 0) {
          requestFinalizer.unregister(abort), this.removeEventListener("abort", abort), ac.abort(this.reason);
          let controllerList = dependentControllerMap.get(ac.signal);
          if (controllerList !== void 0) {
            if (controllerList.size !== 0) {
              for (let ref of controllerList) {
                let ctrl = ref.deref();
                ctrl !== void 0 && ctrl.abort(this.reason);
              }
              controllerList.clear();
            }
            dependentControllerMap.delete(ac.signal);
          }
        }
      }
    }
    var patchMethodWarning = !1, Request = class _Request {
      // https://fetch.spec.whatwg.org/#dom-request
      constructor(input, init = {}) {
        if (webidl.util.markAsUncloneable(this), input === kConstruct)
          return;
        let prefix = "Request constructor";
        webidl.argumentLengthCheck(arguments, 1, prefix), input = webidl.converters.RequestInfo(input, prefix, "input"), init = webidl.converters.RequestInit(init, prefix, "init");
        let request = null, fallbackMode = null, baseUrl = environmentSettingsObject.settingsObject.baseUrl, signal = null;
        if (typeof input == "string") {
          this[kDispatcher] = init.dispatcher;
          let parsedURL;
          try {
            parsedURL = new URL(input, baseUrl);
          } catch (err) {
            throw new TypeError("Failed to parse URL from " + input, { cause: err });
          }
          if (parsedURL.username || parsedURL.password)
            throw new TypeError(
              "Request cannot be constructed from a URL that includes credentials: " + input
            );
          request = makeRequest({ urlList: [parsedURL] }), fallbackMode = "cors";
        } else
          this[kDispatcher] = init.dispatcher || input[kDispatcher], assert(input instanceof _Request), request = input[kState], signal = input[kSignal];
        let origin = environmentSettingsObject.settingsObject.origin, window = "client";
        if (request.window?.constructor?.name === "EnvironmentSettingsObject" && sameOrigin(request.window, origin) && (window = request.window), init.window != null)
          throw new TypeError(`'window' option '${window}' must be null`);
        "window" in init && (window = "no-window"), request = makeRequest({
          // URL request’s URL.
          // undici implementation note: this is set as the first item in request's urlList in makeRequest
          // method request’s method.
          method: request.method,
          // header list A copy of request’s header list.
          // undici implementation note: headersList is cloned in makeRequest
          headersList: request.headersList,
          // unsafe-request flag Set.
          unsafeRequest: request.unsafeRequest,
          // client This’s relevant settings object.
          client: environmentSettingsObject.settingsObject,
          // window window.
          window,
          // priority request’s priority.
          priority: request.priority,
          // origin request’s origin. The propagation of the origin is only significant for navigation requests
          // being handled by a service worker. In this scenario a request can have an origin that is different
          // from the current client.
          origin: request.origin,
          // referrer request’s referrer.
          referrer: request.referrer,
          // referrer policy request’s referrer policy.
          referrerPolicy: request.referrerPolicy,
          // mode request’s mode.
          mode: request.mode,
          // credentials mode request’s credentials mode.
          credentials: request.credentials,
          // cache mode request’s cache mode.
          cache: request.cache,
          // redirect mode request’s redirect mode.
          redirect: request.redirect,
          // integrity metadata request’s integrity metadata.
          integrity: request.integrity,
          // keepalive request’s keepalive.
          keepalive: request.keepalive,
          // reload-navigation flag request’s reload-navigation flag.
          reloadNavigation: request.reloadNavigation,
          // history-navigation flag request’s history-navigation flag.
          historyNavigation: request.historyNavigation,
          // URL list A clone of request’s URL list.
          urlList: [...request.urlList]
        });
        let initHasKey = Object.keys(init).length !== 0;
        if (initHasKey && (request.mode === "navigate" && (request.mode = "same-origin"), request.reloadNavigation = !1, request.historyNavigation = !1, request.origin = "client", request.referrer = "client", request.referrerPolicy = "", request.url = request.urlList[request.urlList.length - 1], request.urlList = [request.url]), init.referrer !== void 0) {
          let referrer = init.referrer;
          if (referrer === "")
            request.referrer = "no-referrer";
          else {
            let parsedReferrer;
            try {
              parsedReferrer = new URL(referrer, baseUrl);
            } catch (err) {
              throw new TypeError(`Referrer "${referrer}" is not a valid URL.`, { cause: err });
            }
            parsedReferrer.protocol === "about:" && parsedReferrer.hostname === "client" || origin && !sameOrigin(parsedReferrer, environmentSettingsObject.settingsObject.baseUrl) ? request.referrer = "client" : request.referrer = parsedReferrer;
          }
        }
        init.referrerPolicy !== void 0 && (request.referrerPolicy = init.referrerPolicy);
        let mode;
        if (init.mode !== void 0 ? mode = init.mode : mode = fallbackMode, mode === "navigate")
          throw webidl.errors.exception({
            header: "Request constructor",
            message: "invalid request mode navigate."
          });
        if (mode != null && (request.mode = mode), init.credentials !== void 0 && (request.credentials = init.credentials), init.cache !== void 0 && (request.cache = init.cache), request.cache === "only-if-cached" && request.mode !== "same-origin")
          throw new TypeError(
            "'only-if-cached' can be set only with 'same-origin' mode"
          );
        if (init.redirect !== void 0 && (request.redirect = init.redirect), init.integrity != null && (request.integrity = String(init.integrity)), init.keepalive !== void 0 && (request.keepalive = !!init.keepalive), init.method !== void 0) {
          let method = init.method, mayBeNormalized = normalizedMethodRecords[method];
          if (mayBeNormalized !== void 0)
            request.method = mayBeNormalized;
          else {
            if (!isValidHTTPToken(method))
              throw new TypeError(`'${method}' is not a valid HTTP method.`);
            let upperCase = method.toUpperCase();
            if (forbiddenMethodsSet.has(upperCase))
              throw new TypeError(`'${method}' HTTP method is unsupported.`);
            method = normalizedMethodRecordsBase[upperCase] ?? method, request.method = method;
          }
          !patchMethodWarning && request.method === "patch" && (process.emitWarning("Using `patch` is highly likely to result in a `405 Method Not Allowed`. `PATCH` is much more likely to succeed.", {
            code: "UNDICI-FETCH-patch"
          }), patchMethodWarning = !0);
        }
        init.signal !== void 0 && (signal = init.signal), this[kState] = request;
        let ac = new AbortController();
        if (this[kSignal] = ac.signal, signal != null) {
          if (!signal || typeof signal.aborted != "boolean" || typeof signal.addEventListener != "function")
            throw new TypeError(
              "Failed to construct 'Request': member signal is not of type AbortSignal."
            );
          if (signal.aborted)
            ac.abort(signal.reason);
          else {
            this[kAbortController] = ac;
            let acRef = new WeakRef(ac), abort = buildAbort(acRef);
            try {
              (typeof getMaxListeners == "function" && getMaxListeners(signal) === defaultMaxListeners || getEventListeners(signal, "abort").length >= defaultMaxListeners) && setMaxListeners(1500, signal);
            } catch {
            }
            util.addAbortListener(signal, abort), requestFinalizer.register(ac, { signal, abort }, abort);
          }
        }
        if (this[kHeaders] = new Headers2(kConstruct), setHeadersList(this[kHeaders], request.headersList), setHeadersGuard(this[kHeaders], "request"), mode === "no-cors") {
          if (!corsSafeListedMethodsSet.has(request.method))
            throw new TypeError(
              `'${request.method} is unsupported in no-cors mode.`
            );
          setHeadersGuard(this[kHeaders], "request-no-cors");
        }
        if (initHasKey) {
          let headersList = getHeadersList(this[kHeaders]), headers = init.headers !== void 0 ? init.headers : new HeadersList(headersList);
          if (headersList.clear(), headers instanceof HeadersList) {
            for (let { name, value } of headers.rawValues())
              headersList.append(name, value, !1);
            headersList.cookies = headers.cookies;
          } else
            fillHeaders(this[kHeaders], headers);
        }
        let inputBody = input instanceof _Request ? input[kState].body : null;
        if ((init.body != null || inputBody != null) && (request.method === "GET" || request.method === "HEAD"))
          throw new TypeError("Request with GET/HEAD method cannot have body.");
        let initBody = null;
        if (init.body != null) {
          let [extractedBody, contentType] = extractBody(
            init.body,
            request.keepalive
          );
          initBody = extractedBody, contentType && !getHeadersList(this[kHeaders]).contains("content-type", !0) && this[kHeaders].append("content-type", contentType);
        }
        let inputOrInitBody = initBody ?? inputBody;
        if (inputOrInitBody != null && inputOrInitBody.source == null) {
          if (initBody != null && init.duplex == null)
            throw new TypeError("RequestInit: duplex option is required when sending a body.");
          if (request.mode !== "same-origin" && request.mode !== "cors")
            throw new TypeError(
              'If request is made from ReadableStream, mode should be "same-origin" or "cors"'
            );
          request.useCORSPreflightFlag = !0;
        }
        let finalBody = inputOrInitBody;
        if (initBody == null && inputBody != null) {
          if (bodyUnusable(input))
            throw new TypeError(
              "Cannot construct a Request with a Request object that has already been used."
            );
          let identityTransform = new TransformStream();
          inputBody.stream.pipeThrough(identityTransform), finalBody = {
            source: inputBody.source,
            length: inputBody.length,
            stream: identityTransform.readable
          };
        }
        this[kState].body = finalBody;
      }
      // Returns request’s HTTP method, which is "GET" by default.
      get method() {
        return webidl.brandCheck(this, _Request), this[kState].method;
      }
      // Returns the URL of request as a string.
      get url() {
        return webidl.brandCheck(this, _Request), URLSerializer(this[kState].url);
      }
      // Returns a Headers object consisting of the headers associated with request.
      // Note that headers added in the network layer by the user agent will not
      // be accounted for in this object, e.g., the "Host" header.
      get headers() {
        return webidl.brandCheck(this, _Request), this[kHeaders];
      }
      // Returns the kind of resource requested by request, e.g., "document"
      // or "script".
      get destination() {
        return webidl.brandCheck(this, _Request), this[kState].destination;
      }
      // Returns the referrer of request. Its value can be a same-origin URL if
      // explicitly set in init, the empty string to indicate no referrer, and
      // "about:client" when defaulting to the global’s default. This is used
      // during fetching to determine the value of the `Referer` header of the
      // request being made.
      get referrer() {
        return webidl.brandCheck(this, _Request), this[kState].referrer === "no-referrer" ? "" : this[kState].referrer === "client" ? "about:client" : this[kState].referrer.toString();
      }
      // Returns the referrer policy associated with request.
      // This is used during fetching to compute the value of the request’s
      // referrer.
      get referrerPolicy() {
        return webidl.brandCheck(this, _Request), this[kState].referrerPolicy;
      }
      // Returns the mode associated with request, which is a string indicating
      // whether the request will use CORS, or will be restricted to same-origin
      // URLs.
      get mode() {
        return webidl.brandCheck(this, _Request), this[kState].mode;
      }
      // Returns the credentials mode associated with request,
      // which is a string indicating whether credentials will be sent with the
      // request always, never, or only when sent to a same-origin URL.
      get credentials() {
        return this[kState].credentials;
      }
      // Returns the cache mode associated with request,
      // which is a string indicating how the request will
      // interact with the browser’s cache when fetching.
      get cache() {
        return webidl.brandCheck(this, _Request), this[kState].cache;
      }
      // Returns the redirect mode associated with request,
      // which is a string indicating how redirects for the
      // request will be handled during fetching. A request
      // will follow redirects by default.
      get redirect() {
        return webidl.brandCheck(this, _Request), this[kState].redirect;
      }
      // Returns request’s subresource integrity metadata, which is a
      // cryptographic hash of the resource being fetched. Its value
      // consists of multiple hashes separated by whitespace. [SRI]
      get integrity() {
        return webidl.brandCheck(this, _Request), this[kState].integrity;
      }
      // Returns a boolean indicating whether or not request can outlive the
      // global in which it was created.
      get keepalive() {
        return webidl.brandCheck(this, _Request), this[kState].keepalive;
      }
      // Returns a boolean indicating whether or not request is for a reload
      // navigation.
      get isReloadNavigation() {
        return webidl.brandCheck(this, _Request), this[kState].reloadNavigation;
      }
      // Returns a boolean indicating whether or not request is for a history
      // navigation (a.k.a. back-forward navigation).
      get isHistoryNavigation() {
        return webidl.brandCheck(this, _Request), this[kState].historyNavigation;
      }
      // Returns the signal associated with request, which is an AbortSignal
      // object indicating whether or not request has been aborted, and its
      // abort event handler.
      get signal() {
        return webidl.brandCheck(this, _Request), this[kSignal];
      }
      get body() {
        return webidl.brandCheck(this, _Request), this[kState].body ? this[kState].body.stream : null;
      }
      get bodyUsed() {
        return webidl.brandCheck(this, _Request), !!this[kState].body && util.isDisturbed(this[kState].body.stream);
      }
      get duplex() {
        return webidl.brandCheck(this, _Request), "half";
      }
      // Returns a clone of request.
      clone() {
        if (webidl.brandCheck(this, _Request), bodyUnusable(this))
          throw new TypeError("unusable");
        let clonedRequest = cloneRequest(this[kState]), ac = new AbortController();
        if (this.signal.aborted)
          ac.abort(this.signal.reason);
        else {
          let list = dependentControllerMap.get(this.signal);
          list === void 0 && (list = /* @__PURE__ */ new Set(), dependentControllerMap.set(this.signal, list));
          let acRef = new WeakRef(ac);
          list.add(acRef), util.addAbortListener(
            ac.signal,
            buildAbort(acRef)
          );
        }
        return fromInnerRequest(clonedRequest, ac.signal, getHeadersGuard(this[kHeaders]));
      }
      [nodeUtil.inspect.custom](depth, options) {
        options.depth === null && (options.depth = 2), options.colors ??= !0;
        let properties = {
          method: this.method,
          url: this.url,
          headers: this.headers,
          destination: this.destination,
          referrer: this.referrer,
          referrerPolicy: this.referrerPolicy,
          mode: this.mode,
          credentials: this.credentials,
          cache: this.cache,
          redirect: this.redirect,
          integrity: this.integrity,
          keepalive: this.keepalive,
          isReloadNavigation: this.isReloadNavigation,
          isHistoryNavigation: this.isHistoryNavigation,
          signal: this.signal
        };
        return `Request ${nodeUtil.formatWithOptions(options, properties)}`;
      }
    };
    mixinBody(Request);
    function makeRequest(init) {
      return {
        method: init.method ?? "GET",
        localURLsOnly: init.localURLsOnly ?? !1,
        unsafeRequest: init.unsafeRequest ?? !1,
        body: init.body ?? null,
        client: init.client ?? null,
        reservedClient: init.reservedClient ?? null,
        replacesClientId: init.replacesClientId ?? "",
        window: init.window ?? "client",
        keepalive: init.keepalive ?? !1,
        serviceWorkers: init.serviceWorkers ?? "all",
        initiator: init.initiator ?? "",
        destination: init.destination ?? "",
        priority: init.priority ?? null,
        origin: init.origin ?? "client",
        policyContainer: init.policyContainer ?? "client",
        referrer: init.referrer ?? "client",
        referrerPolicy: init.referrerPolicy ?? "",
        mode: init.mode ?? "no-cors",
        useCORSPreflightFlag: init.useCORSPreflightFlag ?? !1,
        credentials: init.credentials ?? "same-origin",
        useCredentials: init.useCredentials ?? !1,
        cache: init.cache ?? "default",
        redirect: init.redirect ?? "follow",
        integrity: init.integrity ?? "",
        cryptoGraphicsNonceMetadata: init.cryptoGraphicsNonceMetadata ?? "",
        parserMetadata: init.parserMetadata ?? "",
        reloadNavigation: init.reloadNavigation ?? !1,
        historyNavigation: init.historyNavigation ?? !1,
        userActivation: init.userActivation ?? !1,
        taintedOrigin: init.taintedOrigin ?? !1,
        redirectCount: init.redirectCount ?? 0,
        responseTainting: init.responseTainting ?? "basic",
        preventNoCacheCacheControlHeaderModification: init.preventNoCacheCacheControlHeaderModification ?? !1,
        done: init.done ?? !1,
        timingAllowFailed: init.timingAllowFailed ?? !1,
        urlList: init.urlList,
        url: init.urlList[0],
        headersList: init.headersList ? new HeadersList(init.headersList) : new HeadersList()
      };
    }
    function cloneRequest(request) {
      let newRequest = makeRequest({ ...request, body: null });
      return request.body != null && (newRequest.body = cloneBody(newRequest, request.body)), newRequest;
    }
    function fromInnerRequest(innerRequest, signal, guard) {
      let request = new Request(kConstruct);
      return request[kState] = innerRequest, request[kSignal] = signal, request[kHeaders] = new Headers2(kConstruct), setHeadersList(request[kHeaders], innerRequest.headersList), setHeadersGuard(request[kHeaders], guard), request;
    }
    Object.defineProperties(Request.prototype, {
      method: kEnumerableProperty,
      url: kEnumerableProperty,
      headers: kEnumerableProperty,
      redirect: kEnumerableProperty,
      clone: kEnumerableProperty,
      signal: kEnumerableProperty,
      duplex: kEnumerableProperty,
      destination: kEnumerableProperty,
      body: kEnumerableProperty,
      bodyUsed: kEnumerableProperty,
      isHistoryNavigation: kEnumerableProperty,
      isReloadNavigation: kEnumerableProperty,
      keepalive: kEnumerableProperty,
      integrity: kEnumerableProperty,
      cache: kEnumerableProperty,
      credentials: kEnumerableProperty,
      attribute: kEnumerableProperty,
      referrerPolicy: kEnumerableProperty,
      referrer: kEnumerableProperty,
      mode: kEnumerableProperty,
      [Symbol.toStringTag]: {
        value: "Request",
        configurable: !0
      }
    });
    webidl.converters.Request = webidl.interfaceConverter(
      Request
    );
    webidl.converters.RequestInfo = function(V, prefix, argument) {
      return typeof V == "string" ? webidl.converters.USVString(V, prefix, argument) : V instanceof Request ? webidl.converters.Request(V, prefix, argument) : webidl.converters.USVString(V, prefix, argument);
    };
    webidl.converters.AbortSignal = webidl.interfaceConverter(
      AbortSignal
    );
    webidl.converters.RequestInit = webidl.dictionaryConverter([
      {
        key: "method",
        converter: webidl.converters.ByteString
      },
      {
        key: "headers",
        converter: webidl.converters.HeadersInit
      },
      {
        key: "body",
        converter: webidl.nullableConverter(
          webidl.converters.BodyInit
        )
      },
      {
        key: "referrer",
        converter: webidl.converters.USVString
      },
      {
        key: "referrerPolicy",
        converter: webidl.converters.DOMString,
        // https://w3c.github.io/webappsec-referrer-policy/#referrer-policy
        allowedValues: referrerPolicy
      },
      {
        key: "mode",
        converter: webidl.converters.DOMString,
        // https://fetch.spec.whatwg.org/#concept-request-mode
        allowedValues: requestMode
      },
      {
        key: "credentials",
        converter: webidl.converters.DOMString,
        // https://fetch.spec.whatwg.org/#requestcredentials
        allowedValues: requestCredentials
      },
      {
        key: "cache",
        converter: webidl.converters.DOMString,
        // https://fetch.spec.whatwg.org/#requestcache
        allowedValues: requestCache
      },
      {
        key: "redirect",
        converter: webidl.converters.DOMString,
        // https://fetch.spec.whatwg.org/#requestredirect
        allowedValues: requestRedirect
      },
      {
        key: "integrity",
        converter: webidl.converters.DOMString
      },
      {
        key: "keepalive",
        converter: webidl.converters.boolean
      },
      {
        key: "signal",
        converter: webidl.nullableConverter(
          (signal) => webidl.converters.AbortSignal(
            signal,
            "RequestInit",
            "signal",
            { strict: !1 }
          )
        )
      },
      {
        key: "window",
        converter: webidl.converters.any
      },
      {
        key: "duplex",
        converter: webidl.converters.DOMString,
        allowedValues: requestDuplex
      },
      {
        key: "dispatcher",
        // undici specific option
        converter: webidl.converters.any
      }
    ]);
    module.exports = { Request, makeRequest, fromInnerRequest, cloneRequest };
  }
});

// node_modules/undici/lib/web/fetch/index.js
var require_fetch = __commonJS({
  "node_modules/undici/lib/web/fetch/index.js"(exports, module) {
    "use strict";
    var {
      makeNetworkError,
      makeAppropriateNetworkError,
      filterResponse,
      makeResponse,
      fromInnerResponse
    } = require_response(), { HeadersList } = require_headers(), { Request, cloneRequest } = require_request2(), zlib = __require("node:zlib"), {
      bytesMatch,
      makePolicyContainer,
      clonePolicyContainer,
      requestBadPort,
      TAOCheck,
      appendRequestOriginHeader,
      responseLocationURL,
      requestCurrentURL,
      setRequestReferrerPolicyOnRedirect,
      tryUpgradeRequestToAPotentiallyTrustworthyURL,
      createOpaqueTimingInfo,
      appendFetchMetadata,
      corsCheck,
      crossOriginResourcePolicyCheck,
      determineRequestsReferrer,
      coarsenedSharedCurrentTime,
      createDeferredPromise,
      isBlobLike,
      sameOrigin,
      isCancelled,
      isAborted,
      isErrorLike,
      fullyReadBody,
      readableStreamClose,
      isomorphicEncode,
      urlIsLocal,
      urlIsHttpHttpsScheme,
      urlHasHttpsScheme,
      clampAndCoarsenConnectionTimingInfo,
      simpleRangeHeaderValue,
      buildContentRange,
      createInflate,
      extractMimeType
    } = require_util2(), { kState, kDispatcher } = require_symbols2(), assert = __require("node:assert"), { safelyExtractBody, extractBody } = require_body(), {
      redirectStatusSet,
      nullBodyStatus,
      safeMethodsSet,
      requestBodyHeader,
      subresourceSet
    } = require_constants3(), EE = __require("node:events"), { Readable, pipeline: pipeline3, finished } = __require("node:stream"), { addAbortListener, isErrored, isReadable, bufferToLowerCasedHeaderName } = require_util(), { dataURLProcessor, serializeAMimeType, minimizeSupportedMimeType } = require_data_url(), { getGlobalDispatcher } = require_global2(), { webidl } = require_webidl(), { STATUS_CODES } = __require("node:http"), GET_OR_HEAD = ["GET", "HEAD"], defaultUserAgent = typeof __UNDICI_IS_NODE__ < "u" || typeof esbuildDetection < "u" ? "node" : "undici", resolveObjectURL, Fetch = class extends EE {
      constructor(dispatcher) {
        super(), this.dispatcher = dispatcher, this.connection = null, this.dump = !1, this.state = "ongoing";
      }
      terminate(reason) {
        this.state === "ongoing" && (this.state = "terminated", this.connection?.destroy(reason), this.emit("terminated", reason));
      }
      // https://fetch.spec.whatwg.org/#fetch-controller-abort
      abort(error2) {
        this.state === "ongoing" && (this.state = "aborted", error2 || (error2 = new DOMException("The operation was aborted.", "AbortError")), this.serializedAbortReason = error2, this.connection?.destroy(error2), this.emit("terminated", error2));
      }
    };
    function handleFetchDone(response) {
      finalizeAndReportTiming(response, "fetch");
    }
    function fetch(input, init = void 0) {
      webidl.argumentLengthCheck(arguments, 1, "globalThis.fetch");
      let p = createDeferredPromise(), requestObject;
      try {
        requestObject = new Request(input, init);
      } catch (e) {
        return p.reject(e), p.promise;
      }
      let request = requestObject[kState];
      if (requestObject.signal.aborted)
        return abortFetch(p, request, null, requestObject.signal.reason), p.promise;
      request.client.globalObject?.constructor?.name === "ServiceWorkerGlobalScope" && (request.serviceWorkers = "none");
      let responseObject = null, locallyAborted = !1, controller = null;
      return addAbortListener(
        requestObject.signal,
        () => {
          locallyAborted = !0, assert(controller != null), controller.abort(requestObject.signal.reason);
          let realResponse = responseObject?.deref();
          abortFetch(p, request, realResponse, requestObject.signal.reason);
        }
      ), controller = fetching({
        request,
        processResponseEndOfBody: handleFetchDone,
        processResponse: (response) => {
          if (!locallyAborted) {
            if (response.aborted) {
              abortFetch(p, request, responseObject, controller.serializedAbortReason);
              return;
            }
            if (response.type === "error") {
              p.reject(new TypeError("fetch failed", { cause: response.error }));
              return;
            }
            responseObject = new WeakRef(fromInnerResponse(response, "immutable")), p.resolve(responseObject.deref()), p = null;
          }
        },
        dispatcher: requestObject[kDispatcher]
        // undici
      }), p.promise;
    }
    function finalizeAndReportTiming(response, initiatorType = "other") {
      if (response.type === "error" && response.aborted || !response.urlList?.length)
        return;
      let originalURL = response.urlList[0], timingInfo = response.timingInfo, cacheState = response.cacheState;
      urlIsHttpHttpsScheme(originalURL) && timingInfo !== null && (response.timingAllowPassed || (timingInfo = createOpaqueTimingInfo({
        startTime: timingInfo.startTime
      }), cacheState = ""), timingInfo.endTime = coarsenedSharedCurrentTime(), response.timingInfo = timingInfo, markResourceTiming(
        timingInfo,
        originalURL.href,
        initiatorType,
        globalThis,
        cacheState
      ));
    }
    var markResourceTiming = performance.markResourceTiming;
    function abortFetch(p, request, responseObject, error2) {
      if (p && p.reject(error2), request.body != null && isReadable(request.body?.stream) && request.body.stream.cancel(error2).catch((err) => {
        if (err.code !== "ERR_INVALID_STATE")
          throw err;
      }), responseObject == null)
        return;
      let response = responseObject[kState];
      response.body != null && isReadable(response.body?.stream) && response.body.stream.cancel(error2).catch((err) => {
        if (err.code !== "ERR_INVALID_STATE")
          throw err;
      });
    }
    function fetching({
      request,
      processRequestBodyChunkLength,
      processRequestEndOfBody,
      processResponse,
      processResponseEndOfBody,
      processResponseConsumeBody,
      useParallelQueue = !1,
      dispatcher = getGlobalDispatcher()
      // undici
    }) {
      assert(dispatcher);
      let taskDestination = null, crossOriginIsolatedCapability = !1;
      request.client != null && (taskDestination = request.client.globalObject, crossOriginIsolatedCapability = request.client.crossOriginIsolatedCapability);
      let currentTime = coarsenedSharedCurrentTime(crossOriginIsolatedCapability), timingInfo = createOpaqueTimingInfo({
        startTime: currentTime
      }), fetchParams = {
        controller: new Fetch(dispatcher),
        request,
        timingInfo,
        processRequestBodyChunkLength,
        processRequestEndOfBody,
        processResponse,
        processResponseConsumeBody,
        processResponseEndOfBody,
        taskDestination,
        crossOriginIsolatedCapability
      };
      return assert(!request.body || request.body.stream), request.window === "client" && (request.window = request.client?.globalObject?.constructor?.name === "Window" ? request.client : "no-window"), request.origin === "client" && (request.origin = request.client.origin), request.policyContainer === "client" && (request.client != null ? request.policyContainer = clonePolicyContainer(
        request.client.policyContainer
      ) : request.policyContainer = makePolicyContainer()), request.headersList.contains("accept", !0) || request.headersList.append("accept", "*/*", !0), request.headersList.contains("accept-language", !0) || request.headersList.append("accept-language", "*", !0), request.priority, subresourceSet.has(request.destination), mainFetch(fetchParams).catch((err) => {
        fetchParams.controller.terminate(err);
      }), fetchParams.controller;
    }
    async function mainFetch(fetchParams, recursive = !1) {
      let request = fetchParams.request, response = null;
      if (request.localURLsOnly && !urlIsLocal(requestCurrentURL(request)) && (response = makeNetworkError("local URLs only")), tryUpgradeRequestToAPotentiallyTrustworthyURL(request), requestBadPort(request) === "blocked" && (response = makeNetworkError("bad port")), request.referrerPolicy === "" && (request.referrerPolicy = request.policyContainer.referrerPolicy), request.referrer !== "no-referrer" && (request.referrer = determineRequestsReferrer(request)), response === null && (response = await (async () => {
        let currentURL = requestCurrentURL(request);
        return (
          // - request’s current URL’s origin is same origin with request’s origin,
          //   and request’s response tainting is "basic"
          sameOrigin(currentURL, request.url) && request.responseTainting === "basic" || // request’s current URL’s scheme is "data"
          currentURL.protocol === "data:" || // - request’s mode is "navigate" or "websocket"
          request.mode === "navigate" || request.mode === "websocket" ? (request.responseTainting = "basic", await schemeFetch(fetchParams)) : request.mode === "same-origin" ? makeNetworkError('request mode cannot be "same-origin"') : request.mode === "no-cors" ? request.redirect !== "follow" ? makeNetworkError(
            'redirect mode cannot be "follow" for "no-cors" request'
          ) : (request.responseTainting = "opaque", await schemeFetch(fetchParams)) : urlIsHttpHttpsScheme(requestCurrentURL(request)) ? (request.responseTainting = "cors", await httpFetch(fetchParams)) : makeNetworkError("URL scheme must be a HTTP(S) scheme")
        );
      })()), recursive)
        return response;
      response.status !== 0 && !response.internalResponse && (request.responseTainting, request.responseTainting === "basic" ? response = filterResponse(response, "basic") : request.responseTainting === "cors" ? response = filterResponse(response, "cors") : request.responseTainting === "opaque" ? response = filterResponse(response, "opaque") : assert(!1));
      let internalResponse = response.status === 0 ? response : response.internalResponse;
      if (internalResponse.urlList.length === 0 && internalResponse.urlList.push(...request.urlList), request.timingAllowFailed || (response.timingAllowPassed = !0), response.type === "opaque" && internalResponse.status === 206 && internalResponse.rangeRequested && !request.headers.contains("range", !0) && (response = internalResponse = makeNetworkError()), response.status !== 0 && (request.method === "HEAD" || request.method === "CONNECT" || nullBodyStatus.includes(internalResponse.status)) && (internalResponse.body = null, fetchParams.controller.dump = !0), request.integrity) {
        let processBodyError = (reason) => fetchFinale(fetchParams, makeNetworkError(reason));
        if (request.responseTainting === "opaque" || response.body == null) {
          processBodyError(response.error);
          return;
        }
        let processBody = (bytes) => {
          if (!bytesMatch(bytes, request.integrity)) {
            processBodyError("integrity mismatch");
            return;
          }
          response.body = safelyExtractBody(bytes)[0], fetchFinale(fetchParams, response);
        };
        await fullyReadBody(response.body, processBody, processBodyError);
      } else
        fetchFinale(fetchParams, response);
    }
    function schemeFetch(fetchParams) {
      if (isCancelled(fetchParams) && fetchParams.request.redirectCount === 0)
        return Promise.resolve(makeAppropriateNetworkError(fetchParams));
      let { request } = fetchParams, { protocol: scheme } = requestCurrentURL(request);
      switch (scheme) {
        case "about:":
          return Promise.resolve(makeNetworkError("about scheme is not supported"));
        case "blob:": {
          resolveObjectURL || (resolveObjectURL = __require("node:buffer").resolveObjectURL);
          let blobURLEntry = requestCurrentURL(request);
          if (blobURLEntry.search.length !== 0)
            return Promise.resolve(makeNetworkError("NetworkError when attempting to fetch resource."));
          let blob = resolveObjectURL(blobURLEntry.toString());
          if (request.method !== "GET" || !isBlobLike(blob))
            return Promise.resolve(makeNetworkError("invalid method"));
          let response = makeResponse(), fullLength = blob.size, serializedFullLength = isomorphicEncode(`${fullLength}`), type = blob.type;
          if (request.headersList.contains("range", !0)) {
            response.rangeRequested = !0;
            let rangeHeader = request.headersList.get("range", !0), rangeValue = simpleRangeHeaderValue(rangeHeader, !0);
            if (rangeValue === "failure")
              return Promise.resolve(makeNetworkError("failed to fetch the data URL"));
            let { rangeStartValue: rangeStart, rangeEndValue: rangeEnd } = rangeValue;
            if (rangeStart === null)
              rangeStart = fullLength - rangeEnd, rangeEnd = rangeStart + rangeEnd - 1;
            else {
              if (rangeStart >= fullLength)
                return Promise.resolve(makeNetworkError("Range start is greater than the blob's size."));
              (rangeEnd === null || rangeEnd >= fullLength) && (rangeEnd = fullLength - 1);
            }
            let slicedBlob = blob.slice(rangeStart, rangeEnd, type), slicedBodyWithType = extractBody(slicedBlob);
            response.body = slicedBodyWithType[0];
            let serializedSlicedLength = isomorphicEncode(`${slicedBlob.size}`), contentRange = buildContentRange(rangeStart, rangeEnd, fullLength);
            response.status = 206, response.statusText = "Partial Content", response.headersList.set("content-length", serializedSlicedLength, !0), response.headersList.set("content-type", type, !0), response.headersList.set("content-range", contentRange, !0);
          } else {
            let bodyWithType = extractBody(blob);
            response.statusText = "OK", response.body = bodyWithType[0], response.headersList.set("content-length", serializedFullLength, !0), response.headersList.set("content-type", type, !0);
          }
          return Promise.resolve(response);
        }
        case "data:": {
          let currentURL = requestCurrentURL(request), dataURLStruct = dataURLProcessor(currentURL);
          if (dataURLStruct === "failure")
            return Promise.resolve(makeNetworkError("failed to fetch the data URL"));
          let mimeType = serializeAMimeType(dataURLStruct.mimeType);
          return Promise.resolve(makeResponse({
            statusText: "OK",
            headersList: [
              ["content-type", { name: "Content-Type", value: mimeType }]
            ],
            body: safelyExtractBody(dataURLStruct.body)[0]
          }));
        }
        case "file:":
          return Promise.resolve(makeNetworkError("not implemented... yet..."));
        case "http:":
        case "https:":
          return httpFetch(fetchParams).catch((err) => makeNetworkError(err));
        default:
          return Promise.resolve(makeNetworkError("unknown scheme"));
      }
    }
    function finalizeResponse(fetchParams, response) {
      fetchParams.request.done = !0, fetchParams.processResponseDone != null && queueMicrotask(() => fetchParams.processResponseDone(response));
    }
    function fetchFinale(fetchParams, response) {
      let timingInfo = fetchParams.timingInfo, processResponseEndOfBody = () => {
        let unsafeEndTime = Date.now();
        fetchParams.request.destination === "document" && (fetchParams.controller.fullTimingInfo = timingInfo), fetchParams.controller.reportTimingSteps = () => {
          if (fetchParams.request.url.protocol !== "https:")
            return;
          timingInfo.endTime = unsafeEndTime;
          let cacheState = response.cacheState, bodyInfo = response.bodyInfo;
          response.timingAllowPassed || (timingInfo = createOpaqueTimingInfo(timingInfo), cacheState = "");
          let responseStatus = 0;
          if (fetchParams.request.mode !== "navigator" || !response.hasCrossOriginRedirects) {
            responseStatus = response.status;
            let mimeType = extractMimeType(response.headersList);
            mimeType !== "failure" && (bodyInfo.contentType = minimizeSupportedMimeType(mimeType));
          }
          fetchParams.request.initiatorType != null && markResourceTiming(timingInfo, fetchParams.request.url.href, fetchParams.request.initiatorType, globalThis, cacheState, bodyInfo, responseStatus);
        };
        let processResponseEndOfBodyTask = () => {
          fetchParams.request.done = !0, fetchParams.processResponseEndOfBody != null && queueMicrotask(() => fetchParams.processResponseEndOfBody(response)), fetchParams.request.initiatorType != null && fetchParams.controller.reportTimingSteps();
        };
        queueMicrotask(() => processResponseEndOfBodyTask());
      };
      fetchParams.processResponse != null && queueMicrotask(() => {
        fetchParams.processResponse(response), fetchParams.processResponse = null;
      });
      let internalResponse = response.type === "error" ? response : response.internalResponse ?? response;
      internalResponse.body == null ? processResponseEndOfBody() : finished(internalResponse.body.stream, () => {
        processResponseEndOfBody();
      });
    }
    async function httpFetch(fetchParams) {
      let request = fetchParams.request, response = null, actualResponse = null, timingInfo = fetchParams.timingInfo;
      if (request.serviceWorkers, response === null) {
        if (request.redirect === "follow" && (request.serviceWorkers = "none"), actualResponse = response = await httpNetworkOrCacheFetch(fetchParams), request.responseTainting === "cors" && corsCheck(request, response) === "failure")
          return makeNetworkError("cors failure");
        TAOCheck(request, response) === "failure" && (request.timingAllowFailed = !0);
      }
      return (request.responseTainting === "opaque" || response.type === "opaque") && crossOriginResourcePolicyCheck(
        request.origin,
        request.client,
        request.destination,
        actualResponse
      ) === "blocked" ? makeNetworkError("blocked") : (redirectStatusSet.has(actualResponse.status) && (request.redirect !== "manual" && fetchParams.controller.connection.destroy(void 0, !1), request.redirect === "error" ? response = makeNetworkError("unexpected redirect") : request.redirect === "manual" ? response = actualResponse : request.redirect === "follow" ? response = await httpRedirectFetch(fetchParams, response) : assert(!1)), response.timingInfo = timingInfo, response);
    }
    function httpRedirectFetch(fetchParams, response) {
      let request = fetchParams.request, actualResponse = response.internalResponse ? response.internalResponse : response, locationURL;
      try {
        if (locationURL = responseLocationURL(
          actualResponse,
          requestCurrentURL(request).hash
        ), locationURL == null)
          return response;
      } catch (err) {
        return Promise.resolve(makeNetworkError(err));
      }
      if (!urlIsHttpHttpsScheme(locationURL))
        return Promise.resolve(makeNetworkError("URL scheme must be a HTTP(S) scheme"));
      if (request.redirectCount === 20)
        return Promise.resolve(makeNetworkError("redirect count exceeded"));
      if (request.redirectCount += 1, request.mode === "cors" && (locationURL.username || locationURL.password) && !sameOrigin(request, locationURL))
        return Promise.resolve(makeNetworkError('cross origin not allowed for request mode "cors"'));
      if (request.responseTainting === "cors" && (locationURL.username || locationURL.password))
        return Promise.resolve(makeNetworkError(
          'URL cannot contain credentials for request mode "cors"'
        ));
      if (actualResponse.status !== 303 && request.body != null && request.body.source == null)
        return Promise.resolve(makeNetworkError());
      if ([301, 302].includes(actualResponse.status) && request.method === "POST" || actualResponse.status === 303 && !GET_OR_HEAD.includes(request.method)) {
        request.method = "GET", request.body = null;
        for (let headerName of requestBodyHeader)
          request.headersList.delete(headerName);
      }
      sameOrigin(requestCurrentURL(request), locationURL) || (request.headersList.delete("authorization", !0), request.headersList.delete("proxy-authorization", !0), request.headersList.delete("cookie", !0), request.headersList.delete("host", !0)), request.body != null && (assert(request.body.source != null), request.body = safelyExtractBody(request.body.source)[0]);
      let timingInfo = fetchParams.timingInfo;
      return timingInfo.redirectEndTime = timingInfo.postRedirectStartTime = coarsenedSharedCurrentTime(fetchParams.crossOriginIsolatedCapability), timingInfo.redirectStartTime === 0 && (timingInfo.redirectStartTime = timingInfo.startTime), request.urlList.push(locationURL), setRequestReferrerPolicyOnRedirect(request, actualResponse), mainFetch(fetchParams, !0);
    }
    async function httpNetworkOrCacheFetch(fetchParams, isAuthenticationFetch = !1, isNewConnectionFetch = !1) {
      let request = fetchParams.request, httpFetchParams = null, httpRequest = null, response = null, httpCache = null, revalidatingFlag = !1;
      request.window === "no-window" && request.redirect === "error" ? (httpFetchParams = fetchParams, httpRequest = request) : (httpRequest = cloneRequest(request), httpFetchParams = { ...fetchParams }, httpFetchParams.request = httpRequest);
      let includeCredentials = request.credentials === "include" || request.credentials === "same-origin" && request.responseTainting === "basic", contentLength = httpRequest.body ? httpRequest.body.length : null, contentLengthHeaderValue = null;
      if (httpRequest.body == null && ["POST", "PUT"].includes(httpRequest.method) && (contentLengthHeaderValue = "0"), contentLength != null && (contentLengthHeaderValue = isomorphicEncode(`${contentLength}`)), contentLengthHeaderValue != null && httpRequest.headersList.append("content-length", contentLengthHeaderValue, !0), contentLength != null && httpRequest.keepalive, httpRequest.referrer instanceof URL && httpRequest.headersList.append("referer", isomorphicEncode(httpRequest.referrer.href), !0), appendRequestOriginHeader(httpRequest), appendFetchMetadata(httpRequest), httpRequest.headersList.contains("user-agent", !0) || httpRequest.headersList.append("user-agent", defaultUserAgent), httpRequest.cache === "default" && (httpRequest.headersList.contains("if-modified-since", !0) || httpRequest.headersList.contains("if-none-match", !0) || httpRequest.headersList.contains("if-unmodified-since", !0) || httpRequest.headersList.contains("if-match", !0) || httpRequest.headersList.contains("if-range", !0)) && (httpRequest.cache = "no-store"), httpRequest.cache === "no-cache" && !httpRequest.preventNoCacheCacheControlHeaderModification && !httpRequest.headersList.contains("cache-control", !0) && httpRequest.headersList.append("cache-control", "max-age=0", !0), (httpRequest.cache === "no-store" || httpRequest.cache === "reload") && (httpRequest.headersList.contains("pragma", !0) || httpRequest.headersList.append("pragma", "no-cache", !0), httpRequest.headersList.contains("cache-control", !0) || httpRequest.headersList.append("cache-control", "no-cache", !0)), httpRequest.headersList.contains("range", !0) && httpRequest.headersList.append("accept-encoding", "identity", !0), httpRequest.headersList.contains("accept-encoding", !0) || (urlHasHttpsScheme(requestCurrentURL(httpRequest)) ? httpRequest.headersList.append("accept-encoding", "br, gzip, deflate", !0) : httpRequest.headersList.append("accept-encoding", "gzip, deflate", !0)), httpRequest.headersList.delete("host", !0), httpCache == null && (httpRequest.cache = "no-store"), httpRequest.cache !== "no-store" && httpRequest.cache, response == null) {
        if (httpRequest.cache === "only-if-cached")
          return makeNetworkError("only if cached");
        let forwardResponse = await httpNetworkFetch(
          httpFetchParams,
          includeCredentials,
          isNewConnectionFetch
        );
        !safeMethodsSet.has(httpRequest.method) && forwardResponse.status >= 200 && forwardResponse.status <= 399, revalidatingFlag && forwardResponse.status, response == null && (response = forwardResponse);
      }
      if (response.urlList = [...httpRequest.urlList], httpRequest.headersList.contains("range", !0) && (response.rangeRequested = !0), response.requestIncludesCredentials = includeCredentials, response.status === 407)
        return request.window === "no-window" ? makeNetworkError() : isCancelled(fetchParams) ? makeAppropriateNetworkError(fetchParams) : makeNetworkError("proxy authentication required");
      if (
        // response’s status is 421
        response.status === 421 && // isNewConnectionFetch is false
        !isNewConnectionFetch && // request’s body is null, or request’s body is non-null and request’s body’s source is non-null
        (request.body == null || request.body.source != null)
      ) {
        if (isCancelled(fetchParams))
          return makeAppropriateNetworkError(fetchParams);
        fetchParams.controller.connection.destroy(), response = await httpNetworkOrCacheFetch(
          fetchParams,
          isAuthenticationFetch,
          !0
        );
      }
      return response;
    }
    async function httpNetworkFetch(fetchParams, includeCredentials = !1, forceNewConnection = !1) {
      assert(!fetchParams.controller.connection || fetchParams.controller.connection.destroyed), fetchParams.controller.connection = {
        abort: null,
        destroyed: !1,
        destroy(err, abort = !0) {
          this.destroyed || (this.destroyed = !0, abort && this.abort?.(err ?? new DOMException("The operation was aborted.", "AbortError")));
        }
      };
      let request = fetchParams.request, response = null, timingInfo = fetchParams.timingInfo;
      null == null && (request.cache = "no-store");
      let newConnection = forceNewConnection ? "yes" : "no";
      request.mode;
      let requestBody = null;
      if (request.body == null && fetchParams.processRequestEndOfBody)
        queueMicrotask(() => fetchParams.processRequestEndOfBody());
      else if (request.body != null) {
        let processBodyChunk = async function* (bytes) {
          isCancelled(fetchParams) || (yield bytes, fetchParams.processRequestBodyChunkLength?.(bytes.byteLength));
        }, processEndOfBody = () => {
          isCancelled(fetchParams) || fetchParams.processRequestEndOfBody && fetchParams.processRequestEndOfBody();
        }, processBodyError = (e) => {
          isCancelled(fetchParams) || (e.name === "AbortError" ? fetchParams.controller.abort() : fetchParams.controller.terminate(e));
        };
        requestBody = (async function* () {
          try {
            for await (let bytes of request.body.stream)
              yield* processBodyChunk(bytes);
            processEndOfBody();
          } catch (err) {
            processBodyError(err);
          }
        })();
      }
      try {
        let { body, status, statusText, headersList, socket } = await dispatch({ body: requestBody });
        if (socket)
          response = makeResponse({ status, statusText, headersList, socket });
        else {
          let iterator = body[Symbol.asyncIterator]();
          fetchParams.controller.next = () => iterator.next(), response = makeResponse({ status, statusText, headersList });
        }
      } catch (err) {
        return err.name === "AbortError" ? (fetchParams.controller.connection.destroy(), makeAppropriateNetworkError(fetchParams, err)) : makeNetworkError(err);
      }
      let pullAlgorithm = async () => {
        await fetchParams.controller.resume();
      }, cancelAlgorithm = (reason) => {
        isCancelled(fetchParams) || fetchParams.controller.abort(reason);
      }, stream = new ReadableStream(
        {
          async start(controller) {
            fetchParams.controller.controller = controller;
          },
          async pull(controller) {
            await pullAlgorithm(controller);
          },
          async cancel(reason) {
            await cancelAlgorithm(reason);
          },
          type: "bytes"
        }
      );
      response.body = { stream, source: null, length: null }, fetchParams.controller.onAborted = onAborted, fetchParams.controller.on("terminated", onAborted), fetchParams.controller.resume = async () => {
        for (; ; ) {
          let bytes, isFailure;
          try {
            let { done, value } = await fetchParams.controller.next();
            if (isAborted(fetchParams))
              break;
            bytes = done ? void 0 : value;
          } catch (err) {
            fetchParams.controller.ended && !timingInfo.encodedBodySize ? bytes = void 0 : (bytes = err, isFailure = !0);
          }
          if (bytes === void 0) {
            readableStreamClose(fetchParams.controller.controller), finalizeResponse(fetchParams, response);
            return;
          }
          if (timingInfo.decodedBodySize += bytes?.byteLength ?? 0, isFailure) {
            fetchParams.controller.terminate(bytes);
            return;
          }
          let buffer = new Uint8Array(bytes);
          if (buffer.byteLength && fetchParams.controller.controller.enqueue(buffer), isErrored(stream)) {
            fetchParams.controller.terminate();
            return;
          }
          if (fetchParams.controller.controller.desiredSize <= 0)
            return;
        }
      };
      function onAborted(reason) {
        isAborted(fetchParams) ? (response.aborted = !0, isReadable(stream) && fetchParams.controller.controller.error(
          fetchParams.controller.serializedAbortReason
        )) : isReadable(stream) && fetchParams.controller.controller.error(new TypeError("terminated", {
          cause: isErrorLike(reason) ? reason : void 0
        })), fetchParams.controller.connection.destroy();
      }
      return response;
      function dispatch({ body }) {
        let url = requestCurrentURL(request), agent = fetchParams.controller.dispatcher;
        return new Promise((resolve2, reject) => agent.dispatch(
          {
            path: url.pathname + url.search,
            origin: url.origin,
            method: request.method,
            body: agent.isMockActive ? request.body && (request.body.source || request.body.stream) : body,
            headers: request.headersList.entries,
            maxRedirections: 0,
            upgrade: request.mode === "websocket" ? "websocket" : void 0
          },
          {
            body: null,
            abort: null,
            onConnect(abort) {
              let { connection } = fetchParams.controller;
              timingInfo.finalConnectionTimingInfo = clampAndCoarsenConnectionTimingInfo(void 0, timingInfo.postRedirectStartTime, fetchParams.crossOriginIsolatedCapability), connection.destroyed ? abort(new DOMException("The operation was aborted.", "AbortError")) : (fetchParams.controller.on("terminated", abort), this.abort = connection.abort = abort), timingInfo.finalNetworkRequestStartTime = coarsenedSharedCurrentTime(fetchParams.crossOriginIsolatedCapability);
            },
            onResponseStarted() {
              timingInfo.finalNetworkResponseStartTime = coarsenedSharedCurrentTime(fetchParams.crossOriginIsolatedCapability);
            },
            onHeaders(status, rawHeaders, resume, statusText) {
              if (status < 200)
                return;
              let location = "", headersList = new HeadersList();
              for (let i = 0; i < rawHeaders.length; i += 2)
                headersList.append(bufferToLowerCasedHeaderName(rawHeaders[i]), rawHeaders[i + 1].toString("latin1"), !0);
              location = headersList.get("location", !0), this.body = new Readable({ read: resume });
              let decoders = [], willFollow = location && request.redirect === "follow" && redirectStatusSet.has(status);
              if (request.method !== "HEAD" && request.method !== "CONNECT" && !nullBodyStatus.includes(status) && !willFollow) {
                let contentEncoding = headersList.get("content-encoding", !0), codings = contentEncoding ? contentEncoding.toLowerCase().split(",") : [], maxContentEncodings = 5;
                if (codings.length > maxContentEncodings)
                  return reject(new Error(`too many content-encodings in response: ${codings.length}, maximum allowed is ${maxContentEncodings}`)), !0;
                for (let i = codings.length - 1; i >= 0; --i) {
                  let coding = codings[i].trim();
                  if (coding === "x-gzip" || coding === "gzip")
                    decoders.push(zlib.createGunzip({
                      // Be less strict when decoding compressed responses, since sometimes
                      // servers send slightly invalid responses that are still accepted
                      // by common browsers.
                      // Always using Z_SYNC_FLUSH is what cURL does.
                      flush: zlib.constants.Z_SYNC_FLUSH,
                      finishFlush: zlib.constants.Z_SYNC_FLUSH
                    }));
                  else if (coding === "deflate")
                    decoders.push(createInflate({
                      flush: zlib.constants.Z_SYNC_FLUSH,
                      finishFlush: zlib.constants.Z_SYNC_FLUSH
                    }));
                  else if (coding === "br")
                    decoders.push(zlib.createBrotliDecompress({
                      flush: zlib.constants.BROTLI_OPERATION_FLUSH,
                      finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH
                    }));
                  else {
                    decoders.length = 0;
                    break;
                  }
                }
              }
              let onError = this.onError.bind(this);
              return resolve2({
                status,
                statusText,
                headersList,
                body: decoders.length ? pipeline3(this.body, ...decoders, (err) => {
                  err && this.onError(err);
                }).on("error", onError) : this.body.on("error", onError)
              }), !0;
            },
            onData(chunk) {
              if (fetchParams.controller.dump)
                return;
              let bytes = chunk;
              return timingInfo.encodedBodySize += bytes.byteLength, this.body.push(bytes);
            },
            onComplete() {
              this.abort && fetchParams.controller.off("terminated", this.abort), fetchParams.controller.onAborted && fetchParams.controller.off("terminated", fetchParams.controller.onAborted), fetchParams.controller.ended = !0, this.body.push(null);
            },
            onError(error2) {
              this.abort && fetchParams.controller.off("terminated", this.abort), this.body?.destroy(error2), fetchParams.controller.terminate(error2), reject(error2);
            },
            onUpgrade(status, rawHeaders, socket) {
              if (status !== 101)
                return;
              let headersList = new HeadersList();
              for (let i = 0; i < rawHeaders.length; i += 2)
                headersList.append(bufferToLowerCasedHeaderName(rawHeaders[i]), rawHeaders[i + 1].toString("latin1"), !0);
              return resolve2({
                status,
                statusText: STATUS_CODES[status],
                headersList,
                socket
              }), !0;
            }
          }
        ));
      }
    }
    module.exports = {
      fetch,
      Fetch,
      fetching,
      finalizeAndReportTiming
    };
  }
});

// node_modules/undici/lib/web/fileapi/symbols.js
var require_symbols3 = __commonJS({
  "node_modules/undici/lib/web/fileapi/symbols.js"(exports, module) {
    "use strict";
    module.exports = {
      kState: /* @__PURE__ */ Symbol("FileReader state"),
      kResult: /* @__PURE__ */ Symbol("FileReader result"),
      kError: /* @__PURE__ */ Symbol("FileReader error"),
      kLastProgressEventFired: /* @__PURE__ */ Symbol("FileReader last progress event fired timestamp"),
      kEvents: /* @__PURE__ */ Symbol("FileReader events"),
      kAborted: /* @__PURE__ */ Symbol("FileReader aborted")
    };
  }
});

// node_modules/undici/lib/web/fileapi/progressevent.js
var require_progressevent = __commonJS({
  "node_modules/undici/lib/web/fileapi/progressevent.js"(exports, module) {
    "use strict";
    var { webidl } = require_webidl(), kState = /* @__PURE__ */ Symbol("ProgressEvent state"), ProgressEvent = class _ProgressEvent extends Event {
      constructor(type, eventInitDict = {}) {
        type = webidl.converters.DOMString(type, "ProgressEvent constructor", "type"), eventInitDict = webidl.converters.ProgressEventInit(eventInitDict ?? {}), super(type, eventInitDict), this[kState] = {
          lengthComputable: eventInitDict.lengthComputable,
          loaded: eventInitDict.loaded,
          total: eventInitDict.total
        };
      }
      get lengthComputable() {
        return webidl.brandCheck(this, _ProgressEvent), this[kState].lengthComputable;
      }
      get loaded() {
        return webidl.brandCheck(this, _ProgressEvent), this[kState].loaded;
      }
      get total() {
        return webidl.brandCheck(this, _ProgressEvent), this[kState].total;
      }
    };
    webidl.converters.ProgressEventInit = webidl.dictionaryConverter([
      {
        key: "lengthComputable",
        converter: webidl.converters.boolean,
        defaultValue: () => !1
      },
      {
        key: "loaded",
        converter: webidl.converters["unsigned long long"],
        defaultValue: () => 0
      },
      {
        key: "total",
        converter: webidl.converters["unsigned long long"],
        defaultValue: () => 0
      },
      {
        key: "bubbles",
        converter: webidl.converters.boolean,
        defaultValue: () => !1
      },
      {
        key: "cancelable",
        converter: webidl.converters.boolean,
        defaultValue: () => !1
      },
      {
        key: "composed",
        converter: webidl.converters.boolean,
        defaultValue: () => !1
      }
    ]);
    module.exports = {
      ProgressEvent
    };
  }
});

// node_modules/undici/lib/web/fileapi/encoding.js
var require_encoding = __commonJS({
  "node_modules/undici/lib/web/fileapi/encoding.js"(exports, module) {
    "use strict";
    function getEncoding(label) {
      if (!label)
        return "failure";
      switch (label.trim().toLowerCase()) {
        case "unicode-1-1-utf-8":
        case "unicode11utf8":
        case "unicode20utf8":
        case "utf-8":
        case "utf8":
        case "x-unicode20utf8":
          return "UTF-8";
        case "866":
        case "cp866":
        case "csibm866":
        case "ibm866":
          return "IBM866";
        case "csisolatin2":
        case "iso-8859-2":
        case "iso-ir-101":
        case "iso8859-2":
        case "iso88592":
        case "iso_8859-2":
        case "iso_8859-2:1987":
        case "l2":
        case "latin2":
          return "ISO-8859-2";
        case "csisolatin3":
        case "iso-8859-3":
        case "iso-ir-109":
        case "iso8859-3":
        case "iso88593":
        case "iso_8859-3":
        case "iso_8859-3:1988":
        case "l3":
        case "latin3":
          return "ISO-8859-3";
        case "csisolatin4":
        case "iso-8859-4":
        case "iso-ir-110":
        case "iso8859-4":
        case "iso88594":
        case "iso_8859-4":
        case "iso_8859-4:1988":
        case "l4":
        case "latin4":
          return "ISO-8859-4";
        case "csisolatincyrillic":
        case "cyrillic":
        case "iso-8859-5":
        case "iso-ir-144":
        case "iso8859-5":
        case "iso88595":
        case "iso_8859-5":
        case "iso_8859-5:1988":
          return "ISO-8859-5";
        case "arabic":
        case "asmo-708":
        case "csiso88596e":
        case "csiso88596i":
        case "csisolatinarabic":
        case "ecma-114":
        case "iso-8859-6":
        case "iso-8859-6-e":
        case "iso-8859-6-i":
        case "iso-ir-127":
        case "iso8859-6":
        case "iso88596":
        case "iso_8859-6":
        case "iso_8859-6:1987":
          return "ISO-8859-6";
        case "csisolatingreek":
        case "ecma-118":
        case "elot_928":
        case "greek":
        case "greek8":
        case "iso-8859-7":
        case "iso-ir-126":
        case "iso8859-7":
        case "iso88597":
        case "iso_8859-7":
        case "iso_8859-7:1987":
        case "sun_eu_greek":
          return "ISO-8859-7";
        case "csiso88598e":
        case "csisolatinhebrew":
        case "hebrew":
        case "iso-8859-8":
        case "iso-8859-8-e":
        case "iso-ir-138":
        case "iso8859-8":
        case "iso88598":
        case "iso_8859-8":
        case "iso_8859-8:1988":
        case "visual":
          return "ISO-8859-8";
        case "csiso88598i":
        case "iso-8859-8-i":
        case "logical":
          return "ISO-8859-8-I";
        case "csisolatin6":
        case "iso-8859-10":
        case "iso-ir-157":
        case "iso8859-10":
        case "iso885910":
        case "l6":
        case "latin6":
          return "ISO-8859-10";
        case "iso-8859-13":
        case "iso8859-13":
        case "iso885913":
          return "ISO-8859-13";
        case "iso-8859-14":
        case "iso8859-14":
        case "iso885914":
          return "ISO-8859-14";
        case "csisolatin9":
        case "iso-8859-15":
        case "iso8859-15":
        case "iso885915":
        case "iso_8859-15":
        case "l9":
          return "ISO-8859-15";
        case "iso-8859-16":
          return "ISO-8859-16";
        case "cskoi8r":
        case "koi":
        case "koi8":
        case "koi8-r":
        case "koi8_r":
          return "KOI8-R";
        case "koi8-ru":
        case "koi8-u":
          return "KOI8-U";
        case "csmacintosh":
        case "mac":
        case "macintosh":
        case "x-mac-roman":
          return "macintosh";
        case "iso-8859-11":
        case "iso8859-11":
        case "iso885911":
        case "tis-620":
        case "windows-874":
          return "windows-874";
        case "cp1250":
        case "windows-1250":
        case "x-cp1250":
          return "windows-1250";
        case "cp1251":
        case "windows-1251":
        case "x-cp1251":
          return "windows-1251";
        case "ansi_x3.4-1968":
        case "ascii":
        case "cp1252":
        case "cp819":
        case "csisolatin1":
        case "ibm819":
        case "iso-8859-1":
        case "iso-ir-100":
        case "iso8859-1":
        case "iso88591":
        case "iso_8859-1":
        case "iso_8859-1:1987":
        case "l1":
        case "latin1":
        case "us-ascii":
        case "windows-1252":
        case "x-cp1252":
          return "windows-1252";
        case "cp1253":
        case "windows-1253":
        case "x-cp1253":
          return "windows-1253";
        case "cp1254":
        case "csisolatin5":
        case "iso-8859-9":
        case "iso-ir-148":
        case "iso8859-9":
        case "iso88599":
        case "iso_8859-9":
        case "iso_8859-9:1989":
        case "l5":
        case "latin5":
        case "windows-1254":
        case "x-cp1254":
          return "windows-1254";
        case "cp1255":
        case "windows-1255":
        case "x-cp1255":
          return "windows-1255";
        case "cp1256":
        case "windows-1256":
        case "x-cp1256":
          return "windows-1256";
        case "cp1257":
        case "windows-1257":
        case "x-cp1257":
          return "windows-1257";
        case "cp1258":
        case "windows-1258":
        case "x-cp1258":
          return "windows-1258";
        case "x-mac-cyrillic":
        case "x-mac-ukrainian":
          return "x-mac-cyrillic";
        case "chinese":
        case "csgb2312":
        case "csiso58gb231280":
        case "gb2312":
        case "gb_2312":
        case "gb_2312-80":
        case "gbk":
        case "iso-ir-58":
        case "x-gbk":
          return "GBK";
        case "gb18030":
          return "gb18030";
        case "big5":
        case "big5-hkscs":
        case "cn-big5":
        case "csbig5":
        case "x-x-big5":
          return "Big5";
        case "cseucpkdfmtjapanese":
        case "euc-jp":
        case "x-euc-jp":
          return "EUC-JP";
        case "csiso2022jp":
        case "iso-2022-jp":
          return "ISO-2022-JP";
        case "csshiftjis":
        case "ms932":
        case "ms_kanji":
        case "shift-jis":
        case "shift_jis":
        case "sjis":
        case "windows-31j":
        case "x-sjis":
          return "Shift_JIS";
        case "cseuckr":
        case "csksc56011987":
        case "euc-kr":
        case "iso-ir-149":
        case "korean":
        case "ks_c_5601-1987":
        case "ks_c_5601-1989":
        case "ksc5601":
        case "ksc_5601":
        case "windows-949":
          return "EUC-KR";
        case "csiso2022kr":
        case "hz-gb-2312":
        case "iso-2022-cn":
        case "iso-2022-cn-ext":
        case "iso-2022-kr":
        case "replacement":
          return "replacement";
        case "unicodefffe":
        case "utf-16be":
          return "UTF-16BE";
        case "csunicode":
        case "iso-10646-ucs-2":
        case "ucs-2":
        case "unicode":
        case "unicodefeff":
        case "utf-16":
        case "utf-16le":
          return "UTF-16LE";
        case "x-user-defined":
          return "x-user-defined";
        default:
          return "failure";
      }
    }
    module.exports = {
      getEncoding
    };
  }
});

// node_modules/undici/lib/web/fileapi/util.js
var require_util4 = __commonJS({
  "node_modules/undici/lib/web/fileapi/util.js"(exports, module) {
    "use strict";
    var {
      kState,
      kError,
      kResult,
      kAborted,
      kLastProgressEventFired
    } = require_symbols3(), { ProgressEvent } = require_progressevent(), { getEncoding } = require_encoding(), { serializeAMimeType, parseMIMEType } = require_data_url(), { types } = __require("node:util"), { StringDecoder: StringDecoder2 } = __require("string_decoder"), { btoa } = __require("node:buffer"), staticPropertyDescriptors = {
      enumerable: !0,
      writable: !1,
      configurable: !1
    };
    function readOperation(fr, blob, type, encodingName) {
      if (fr[kState] === "loading")
        throw new DOMException("Invalid state", "InvalidStateError");
      fr[kState] = "loading", fr[kResult] = null, fr[kError] = null;
      let reader = blob.stream().getReader(), bytes = [], chunkPromise = reader.read(), isFirstChunk = !0;
      (async () => {
        for (; !fr[kAborted]; )
          try {
            let { done, value } = await chunkPromise;
            if (isFirstChunk && !fr[kAborted] && queueMicrotask(() => {
              fireAProgressEvent("loadstart", fr);
            }), isFirstChunk = !1, !done && types.isUint8Array(value))
              bytes.push(value), (fr[kLastProgressEventFired] === void 0 || Date.now() - fr[kLastProgressEventFired] >= 50) && !fr[kAborted] && (fr[kLastProgressEventFired] = Date.now(), queueMicrotask(() => {
                fireAProgressEvent("progress", fr);
              })), chunkPromise = reader.read();
            else if (done) {
              queueMicrotask(() => {
                fr[kState] = "done";
                try {
                  let result = packageData(bytes, type, blob.type, encodingName);
                  if (fr[kAborted])
                    return;
                  fr[kResult] = result, fireAProgressEvent("load", fr);
                } catch (error2) {
                  fr[kError] = error2, fireAProgressEvent("error", fr);
                }
                fr[kState] !== "loading" && fireAProgressEvent("loadend", fr);
              });
              break;
            }
          } catch (error2) {
            if (fr[kAborted])
              return;
            queueMicrotask(() => {
              fr[kState] = "done", fr[kError] = error2, fireAProgressEvent("error", fr), fr[kState] !== "loading" && fireAProgressEvent("loadend", fr);
            });
            break;
          }
      })();
    }
    function fireAProgressEvent(e, reader) {
      let event = new ProgressEvent(e, {
        bubbles: !1,
        cancelable: !1
      });
      reader.dispatchEvent(event);
    }
    function packageData(bytes, type, mimeType, encodingName) {
      switch (type) {
        case "DataURL": {
          let dataURL = "data:", parsed = parseMIMEType(mimeType || "application/octet-stream");
          parsed !== "failure" && (dataURL += serializeAMimeType(parsed)), dataURL += ";base64,";
          let decoder = new StringDecoder2("latin1");
          for (let chunk of bytes)
            dataURL += btoa(decoder.write(chunk));
          return dataURL += btoa(decoder.end()), dataURL;
        }
        case "Text": {
          let encoding = "failure";
          if (encodingName && (encoding = getEncoding(encodingName)), encoding === "failure" && mimeType) {
            let type2 = parseMIMEType(mimeType);
            type2 !== "failure" && (encoding = getEncoding(type2.parameters.get("charset")));
          }
          return encoding === "failure" && (encoding = "UTF-8"), decode(bytes, encoding);
        }
        case "ArrayBuffer":
          return combineByteSequences(bytes).buffer;
        case "BinaryString": {
          let binaryString = "", decoder = new StringDecoder2("latin1");
          for (let chunk of bytes)
            binaryString += decoder.write(chunk);
          return binaryString += decoder.end(), binaryString;
        }
      }
    }
    function decode(ioQueue, encoding) {
      let bytes = combineByteSequences(ioQueue), BOMEncoding = BOMSniffing(bytes), slice = 0;
      BOMEncoding !== null && (encoding = BOMEncoding, slice = BOMEncoding === "UTF-8" ? 3 : 2);
      let sliced = bytes.slice(slice);
      return new TextDecoder(encoding).decode(sliced);
    }
    function BOMSniffing(ioQueue) {
      let [a, b, c] = ioQueue;
      return a === 239 && b === 187 && c === 191 ? "UTF-8" : a === 254 && b === 255 ? "UTF-16BE" : a === 255 && b === 254 ? "UTF-16LE" : null;
    }
    function combineByteSequences(sequences) {
      let size = sequences.reduce((a, b) => a + b.byteLength, 0), offset = 0;
      return sequences.reduce((a, b) => (a.set(b, offset), offset += b.byteLength, a), new Uint8Array(size));
    }
    module.exports = {
      staticPropertyDescriptors,
      readOperation,
      fireAProgressEvent
    };
  }
});

// node_modules/undici/lib/web/fileapi/filereader.js
var require_filereader = __commonJS({
  "node_modules/undici/lib/web/fileapi/filereader.js"(exports, module) {
    "use strict";
    var {
      staticPropertyDescriptors,
      readOperation,
      fireAProgressEvent
    } = require_util4(), {
      kState,
      kError,
      kResult,
      kEvents,
      kAborted
    } = require_symbols3(), { webidl } = require_webidl(), { kEnumerableProperty } = require_util(), FileReader = class _FileReader extends EventTarget {
      constructor() {
        super(), this[kState] = "empty", this[kResult] = null, this[kError] = null, this[kEvents] = {
          loadend: null,
          error: null,
          abort: null,
          load: null,
          progress: null,
          loadstart: null
        };
      }
      /**
       * @see https://w3c.github.io/FileAPI/#dfn-readAsArrayBuffer
       * @param {import('buffer').Blob} blob
       */
      readAsArrayBuffer(blob) {
        webidl.brandCheck(this, _FileReader), webidl.argumentLengthCheck(arguments, 1, "FileReader.readAsArrayBuffer"), blob = webidl.converters.Blob(blob, { strict: !1 }), readOperation(this, blob, "ArrayBuffer");
      }
      /**
       * @see https://w3c.github.io/FileAPI/#readAsBinaryString
       * @param {import('buffer').Blob} blob
       */
      readAsBinaryString(blob) {
        webidl.brandCheck(this, _FileReader), webidl.argumentLengthCheck(arguments, 1, "FileReader.readAsBinaryString"), blob = webidl.converters.Blob(blob, { strict: !1 }), readOperation(this, blob, "BinaryString");
      }
      /**
       * @see https://w3c.github.io/FileAPI/#readAsDataText
       * @param {import('buffer').Blob} blob
       * @param {string?} encoding
       */
      readAsText(blob, encoding = void 0) {
        webidl.brandCheck(this, _FileReader), webidl.argumentLengthCheck(arguments, 1, "FileReader.readAsText"), blob = webidl.converters.Blob(blob, { strict: !1 }), encoding !== void 0 && (encoding = webidl.converters.DOMString(encoding, "FileReader.readAsText", "encoding")), readOperation(this, blob, "Text", encoding);
      }
      /**
       * @see https://w3c.github.io/FileAPI/#dfn-readAsDataURL
       * @param {import('buffer').Blob} blob
       */
      readAsDataURL(blob) {
        webidl.brandCheck(this, _FileReader), webidl.argumentLengthCheck(arguments, 1, "FileReader.readAsDataURL"), blob = webidl.converters.Blob(blob, { strict: !1 }), readOperation(this, blob, "DataURL");
      }
      /**
       * @see https://w3c.github.io/FileAPI/#dfn-abort
       */
      abort() {
        if (this[kState] === "empty" || this[kState] === "done") {
          this[kResult] = null;
          return;
        }
        this[kState] === "loading" && (this[kState] = "done", this[kResult] = null), this[kAborted] = !0, fireAProgressEvent("abort", this), this[kState] !== "loading" && fireAProgressEvent("loadend", this);
      }
      /**
       * @see https://w3c.github.io/FileAPI/#dom-filereader-readystate
       */
      get readyState() {
        switch (webidl.brandCheck(this, _FileReader), this[kState]) {
          case "empty":
            return this.EMPTY;
          case "loading":
            return this.LOADING;
          case "done":
            return this.DONE;
        }
      }
      /**
       * @see https://w3c.github.io/FileAPI/#dom-filereader-result
       */
      get result() {
        return webidl.brandCheck(this, _FileReader), this[kResult];
      }
      /**
       * @see https://w3c.github.io/FileAPI/#dom-filereader-error
       */
      get error() {
        return webidl.brandCheck(this, _FileReader), this[kError];
      }
      get onloadend() {
        return webidl.brandCheck(this, _FileReader), this[kEvents].loadend;
      }
      set onloadend(fn) {
        webidl.brandCheck(this, _FileReader), this[kEvents].loadend && this.removeEventListener("loadend", this[kEvents].loadend), typeof fn == "function" ? (this[kEvents].loadend = fn, this.addEventListener("loadend", fn)) : this[kEvents].loadend = null;
      }
      get onerror() {
        return webidl.brandCheck(this, _FileReader), this[kEvents].error;
      }
      set onerror(fn) {
        webidl.brandCheck(this, _FileReader), this[kEvents].error && this.removeEventListener("error", this[kEvents].error), typeof fn == "function" ? (this[kEvents].error = fn, this.addEventListener("error", fn)) : this[kEvents].error = null;
      }
      get onloadstart() {
        return webidl.brandCheck(this, _FileReader), this[kEvents].loadstart;
      }
      set onloadstart(fn) {
        webidl.brandCheck(this, _FileReader), this[kEvents].loadstart && this.removeEventListener("loadstart", this[kEvents].loadstart), typeof fn == "function" ? (this[kEvents].loadstart = fn, this.addEventListener("loadstart", fn)) : this[kEvents].loadstart = null;
      }
      get onprogress() {
        return webidl.brandCheck(this, _FileReader), this[kEvents].progress;
      }
      set onprogress(fn) {
        webidl.brandCheck(this, _FileReader), this[kEvents].progress && this.removeEventListener("progress", this[kEvents].progress), typeof fn == "function" ? (this[kEvents].progress = fn, this.addEventListener("progress", fn)) : this[kEvents].progress = null;
      }
      get onload() {
        return webidl.brandCheck(this, _FileReader), this[kEvents].load;
      }
      set onload(fn) {
        webidl.brandCheck(this, _FileReader), this[kEvents].load && this.removeEventListener("load", this[kEvents].load), typeof fn == "function" ? (this[kEvents].load = fn, this.addEventListener("load", fn)) : this[kEvents].load = null;
      }
      get onabort() {
        return webidl.brandCheck(this, _FileReader), this[kEvents].abort;
      }
      set onabort(fn) {
        webidl.brandCheck(this, _FileReader), this[kEvents].abort && this.removeEventListener("abort", this[kEvents].abort), typeof fn == "function" ? (this[kEvents].abort = fn, this.addEventListener("abort", fn)) : this[kEvents].abort = null;
      }
    };
    FileReader.EMPTY = FileReader.prototype.EMPTY = 0;
    FileReader.LOADING = FileReader.prototype.LOADING = 1;
    FileReader.DONE = FileReader.prototype.DONE = 2;
    Object.defineProperties(FileReader.prototype, {
      EMPTY: staticPropertyDescriptors,
      LOADING: staticPropertyDescriptors,
      DONE: staticPropertyDescriptors,
      readAsArrayBuffer: kEnumerableProperty,
      readAsBinaryString: kEnumerableProperty,
      readAsText: kEnumerableProperty,
      readAsDataURL: kEnumerableProperty,
      abort: kEnumerableProperty,
      readyState: kEnumerableProperty,
      result: kEnumerableProperty,
      error: kEnumerableProperty,
      onloadstart: kEnumerableProperty,
      onprogress: kEnumerableProperty,
      onload: kEnumerableProperty,
      onabort: kEnumerableProperty,
      onerror: kEnumerableProperty,
      onloadend: kEnumerableProperty,
      [Symbol.toStringTag]: {
        value: "FileReader",
        writable: !1,
        enumerable: !1,
        configurable: !0
      }
    });
    Object.defineProperties(FileReader, {
      EMPTY: staticPropertyDescriptors,
      LOADING: staticPropertyDescriptors,
      DONE: staticPropertyDescriptors
    });
    module.exports = {
      FileReader
    };
  }
});

// node_modules/undici/lib/web/cache/symbols.js
var require_symbols4 = __commonJS({
  "node_modules/undici/lib/web/cache/symbols.js"(exports, module) {
    "use strict";
    module.exports = {
      kConstruct: require_symbols().kConstruct
    };
  }
});

// node_modules/undici/lib/web/cache/util.js
var require_util5 = __commonJS({
  "node_modules/undici/lib/web/cache/util.js"(exports, module) {
    "use strict";
    var assert = __require("node:assert"), { URLSerializer } = require_data_url(), { isValidHeaderName } = require_util2();
    function urlEquals(A, B, excludeFragment = !1) {
      let serializedA = URLSerializer(A, excludeFragment), serializedB = URLSerializer(B, excludeFragment);
      return serializedA === serializedB;
    }
    function getFieldValues(header) {
      assert(header !== null);
      let values = [];
      for (let value of header.split(","))
        value = value.trim(), isValidHeaderName(value) && values.push(value);
      return values;
    }
    module.exports = {
      urlEquals,
      getFieldValues
    };
  }
});

// node_modules/undici/lib/web/cache/cache.js
var require_cache = __commonJS({
  "node_modules/undici/lib/web/cache/cache.js"(exports, module) {
    "use strict";
    var { kConstruct } = require_symbols4(), { urlEquals, getFieldValues } = require_util5(), { kEnumerableProperty, isDisturbed } = require_util(), { webidl } = require_webidl(), { Response, cloneResponse, fromInnerResponse } = require_response(), { Request, fromInnerRequest } = require_request2(), { kState } = require_symbols2(), { fetching } = require_fetch(), { urlIsHttpHttpsScheme, createDeferredPromise, readAllBytes } = require_util2(), assert = __require("node:assert"), Cache = class _Cache {
      /**
       * @see https://w3c.github.io/ServiceWorker/#dfn-relevant-request-response-list
       * @type {requestResponseList}
       */
      #relevantRequestResponseList;
      constructor() {
        arguments[0] !== kConstruct && webidl.illegalConstructor(), webidl.util.markAsUncloneable(this), this.#relevantRequestResponseList = arguments[1];
      }
      async match(request, options = {}) {
        webidl.brandCheck(this, _Cache);
        let prefix = "Cache.match";
        webidl.argumentLengthCheck(arguments, 1, prefix), request = webidl.converters.RequestInfo(request, prefix, "request"), options = webidl.converters.CacheQueryOptions(options, prefix, "options");
        let p = this.#internalMatchAll(request, options, 1);
        if (p.length !== 0)
          return p[0];
      }
      async matchAll(request = void 0, options = {}) {
        webidl.brandCheck(this, _Cache);
        let prefix = "Cache.matchAll";
        return request !== void 0 && (request = webidl.converters.RequestInfo(request, prefix, "request")), options = webidl.converters.CacheQueryOptions(options, prefix, "options"), this.#internalMatchAll(request, options);
      }
      async add(request) {
        webidl.brandCheck(this, _Cache);
        let prefix = "Cache.add";
        webidl.argumentLengthCheck(arguments, 1, prefix), request = webidl.converters.RequestInfo(request, prefix, "request");
        let requests = [request];
        return await this.addAll(requests);
      }
      async addAll(requests) {
        webidl.brandCheck(this, _Cache);
        let prefix = "Cache.addAll";
        webidl.argumentLengthCheck(arguments, 1, prefix);
        let responsePromises = [], requestList = [];
        for (let request of requests) {
          if (request === void 0)
            throw webidl.errors.conversionFailed({
              prefix,
              argument: "Argument 1",
              types: ["undefined is not allowed"]
            });
          if (request = webidl.converters.RequestInfo(request), typeof request == "string")
            continue;
          let r = request[kState];
          if (!urlIsHttpHttpsScheme(r.url) || r.method !== "GET")
            throw webidl.errors.exception({
              header: prefix,
              message: "Expected http/s scheme when method is not GET."
            });
        }
        let fetchControllers = [];
        for (let request of requests) {
          let r = new Request(request)[kState];
          if (!urlIsHttpHttpsScheme(r.url))
            throw webidl.errors.exception({
              header: prefix,
              message: "Expected http/s scheme."
            });
          r.initiator = "fetch", r.destination = "subresource", requestList.push(r);
          let responsePromise = createDeferredPromise();
          fetchControllers.push(fetching({
            request: r,
            processResponse(response) {
              if (response.type === "error" || response.status === 206 || response.status < 200 || response.status > 299)
                responsePromise.reject(webidl.errors.exception({
                  header: "Cache.addAll",
                  message: "Received an invalid status code or the request failed."
                }));
              else if (response.headersList.contains("vary")) {
                let fieldValues = getFieldValues(response.headersList.get("vary"));
                for (let fieldValue of fieldValues)
                  if (fieldValue === "*") {
                    responsePromise.reject(webidl.errors.exception({
                      header: "Cache.addAll",
                      message: "invalid vary field value"
                    }));
                    for (let controller of fetchControllers)
                      controller.abort();
                    return;
                  }
              }
            },
            processResponseEndOfBody(response) {
              if (response.aborted) {
                responsePromise.reject(new DOMException("aborted", "AbortError"));
                return;
              }
              responsePromise.resolve(response);
            }
          })), responsePromises.push(responsePromise.promise);
        }
        let responses = await Promise.all(responsePromises), operations = [], index = 0;
        for (let response of responses) {
          let operation = {
            type: "put",
            // 7.3.2
            request: requestList[index],
            // 7.3.3
            response
            // 7.3.4
          };
          operations.push(operation), index++;
        }
        let cacheJobPromise = createDeferredPromise(), errorData = null;
        try {
          this.#batchCacheOperations(operations);
        } catch (e) {
          errorData = e;
        }
        return queueMicrotask(() => {
          errorData === null ? cacheJobPromise.resolve(void 0) : cacheJobPromise.reject(errorData);
        }), cacheJobPromise.promise;
      }
      async put(request, response) {
        webidl.brandCheck(this, _Cache);
        let prefix = "Cache.put";
        webidl.argumentLengthCheck(arguments, 2, prefix), request = webidl.converters.RequestInfo(request, prefix, "request"), response = webidl.converters.Response(response, prefix, "response");
        let innerRequest = null;
        if (request instanceof Request ? innerRequest = request[kState] : innerRequest = new Request(request)[kState], !urlIsHttpHttpsScheme(innerRequest.url) || innerRequest.method !== "GET")
          throw webidl.errors.exception({
            header: prefix,
            message: "Expected an http/s scheme when method is not GET"
          });
        let innerResponse = response[kState];
        if (innerResponse.status === 206)
          throw webidl.errors.exception({
            header: prefix,
            message: "Got 206 status"
          });
        if (innerResponse.headersList.contains("vary")) {
          let fieldValues = getFieldValues(innerResponse.headersList.get("vary"));
          for (let fieldValue of fieldValues)
            if (fieldValue === "*")
              throw webidl.errors.exception({
                header: prefix,
                message: "Got * vary field value"
              });
        }
        if (innerResponse.body && (isDisturbed(innerResponse.body.stream) || innerResponse.body.stream.locked))
          throw webidl.errors.exception({
            header: prefix,
            message: "Response body is locked or disturbed"
          });
        let clonedResponse = cloneResponse(innerResponse), bodyReadPromise = createDeferredPromise();
        if (innerResponse.body != null) {
          let reader = innerResponse.body.stream.getReader();
          readAllBytes(reader).then(bodyReadPromise.resolve, bodyReadPromise.reject);
        } else
          bodyReadPromise.resolve(void 0);
        let operations = [], operation = {
          type: "put",
          // 14.
          request: innerRequest,
          // 15.
          response: clonedResponse
          // 16.
        };
        operations.push(operation);
        let bytes = await bodyReadPromise.promise;
        clonedResponse.body != null && (clonedResponse.body.source = bytes);
        let cacheJobPromise = createDeferredPromise(), errorData = null;
        try {
          this.#batchCacheOperations(operations);
        } catch (e) {
          errorData = e;
        }
        return queueMicrotask(() => {
          errorData === null ? cacheJobPromise.resolve() : cacheJobPromise.reject(errorData);
        }), cacheJobPromise.promise;
      }
      async delete(request, options = {}) {
        webidl.brandCheck(this, _Cache);
        let prefix = "Cache.delete";
        webidl.argumentLengthCheck(arguments, 1, prefix), request = webidl.converters.RequestInfo(request, prefix, "request"), options = webidl.converters.CacheQueryOptions(options, prefix, "options");
        let r = null;
        if (request instanceof Request) {
          if (r = request[kState], r.method !== "GET" && !options.ignoreMethod)
            return !1;
        } else
          assert(typeof request == "string"), r = new Request(request)[kState];
        let operations = [], operation = {
          type: "delete",
          request: r,
          options
        };
        operations.push(operation);
        let cacheJobPromise = createDeferredPromise(), errorData = null, requestResponses;
        try {
          requestResponses = this.#batchCacheOperations(operations);
        } catch (e) {
          errorData = e;
        }
        return queueMicrotask(() => {
          errorData === null ? cacheJobPromise.resolve(!!requestResponses?.length) : cacheJobPromise.reject(errorData);
        }), cacheJobPromise.promise;
      }
      /**
       * @see https://w3c.github.io/ServiceWorker/#dom-cache-keys
       * @param {any} request
       * @param {import('../../types/cache').CacheQueryOptions} options
       * @returns {Promise<readonly Request[]>}
       */
      async keys(request = void 0, options = {}) {
        webidl.brandCheck(this, _Cache);
        let prefix = "Cache.keys";
        request !== void 0 && (request = webidl.converters.RequestInfo(request, prefix, "request")), options = webidl.converters.CacheQueryOptions(options, prefix, "options");
        let r = null;
        if (request !== void 0)
          if (request instanceof Request) {
            if (r = request[kState], r.method !== "GET" && !options.ignoreMethod)
              return [];
          } else typeof request == "string" && (r = new Request(request)[kState]);
        let promise = createDeferredPromise(), requests = [];
        if (request === void 0)
          for (let requestResponse of this.#relevantRequestResponseList)
            requests.push(requestResponse[0]);
        else {
          let requestResponses = this.#queryCache(r, options);
          for (let requestResponse of requestResponses)
            requests.push(requestResponse[0]);
        }
        return queueMicrotask(() => {
          let requestList = [];
          for (let request2 of requests) {
            let requestObject = fromInnerRequest(
              request2,
              new AbortController().signal,
              "immutable"
            );
            requestList.push(requestObject);
          }
          promise.resolve(Object.freeze(requestList));
        }), promise.promise;
      }
      /**
       * @see https://w3c.github.io/ServiceWorker/#batch-cache-operations-algorithm
       * @param {CacheBatchOperation[]} operations
       * @returns {requestResponseList}
       */
      #batchCacheOperations(operations) {
        let cache = this.#relevantRequestResponseList, backupCache = [...cache], addedItems = [], resultList = [];
        try {
          for (let operation of operations) {
            if (operation.type !== "delete" && operation.type !== "put")
              throw webidl.errors.exception({
                header: "Cache.#batchCacheOperations",
                message: 'operation type does not match "delete" or "put"'
              });
            if (operation.type === "delete" && operation.response != null)
              throw webidl.errors.exception({
                header: "Cache.#batchCacheOperations",
                message: "delete operation should not have an associated response"
              });
            if (this.#queryCache(operation.request, operation.options, addedItems).length)
              throw new DOMException("???", "InvalidStateError");
            let requestResponses;
            if (operation.type === "delete") {
              if (requestResponses = this.#queryCache(operation.request, operation.options), requestResponses.length === 0)
                return [];
              for (let requestResponse of requestResponses) {
                let idx = cache.indexOf(requestResponse);
                assert(idx !== -1), cache.splice(idx, 1);
              }
            } else if (operation.type === "put") {
              if (operation.response == null)
                throw webidl.errors.exception({
                  header: "Cache.#batchCacheOperations",
                  message: "put operation should have an associated response"
                });
              let r = operation.request;
              if (!urlIsHttpHttpsScheme(r.url))
                throw webidl.errors.exception({
                  header: "Cache.#batchCacheOperations",
                  message: "expected http or https scheme"
                });
              if (r.method !== "GET")
                throw webidl.errors.exception({
                  header: "Cache.#batchCacheOperations",
                  message: "not get method"
                });
              if (operation.options != null)
                throw webidl.errors.exception({
                  header: "Cache.#batchCacheOperations",
                  message: "options must not be defined"
                });
              requestResponses = this.#queryCache(operation.request);
              for (let requestResponse of requestResponses) {
                let idx = cache.indexOf(requestResponse);
                assert(idx !== -1), cache.splice(idx, 1);
              }
              cache.push([operation.request, operation.response]), addedItems.push([operation.request, operation.response]);
            }
            resultList.push([operation.request, operation.response]);
          }
          return resultList;
        } catch (e) {
          throw this.#relevantRequestResponseList.length = 0, this.#relevantRequestResponseList = backupCache, e;
        }
      }
      /**
       * @see https://w3c.github.io/ServiceWorker/#query-cache
       * @param {any} requestQuery
       * @param {import('../../types/cache').CacheQueryOptions} options
       * @param {requestResponseList} targetStorage
       * @returns {requestResponseList}
       */
      #queryCache(requestQuery, options, targetStorage) {
        let resultList = [], storage = targetStorage ?? this.#relevantRequestResponseList;
        for (let requestResponse of storage) {
          let [cachedRequest, cachedResponse] = requestResponse;
          this.#requestMatchesCachedItem(requestQuery, cachedRequest, cachedResponse, options) && resultList.push(requestResponse);
        }
        return resultList;
      }
      /**
       * @see https://w3c.github.io/ServiceWorker/#request-matches-cached-item-algorithm
       * @param {any} requestQuery
       * @param {any} request
       * @param {any | null} response
       * @param {import('../../types/cache').CacheQueryOptions | undefined} options
       * @returns {boolean}
       */
      #requestMatchesCachedItem(requestQuery, request, response = null, options) {
        let queryURL = new URL(requestQuery.url), cachedURL = new URL(request.url);
        if (options?.ignoreSearch && (cachedURL.search = "", queryURL.search = ""), !urlEquals(queryURL, cachedURL, !0))
          return !1;
        if (response == null || options?.ignoreVary || !response.headersList.contains("vary"))
          return !0;
        let fieldValues = getFieldValues(response.headersList.get("vary"));
        for (let fieldValue of fieldValues) {
          if (fieldValue === "*")
            return !1;
          let requestValue = request.headersList.get(fieldValue), queryValue = requestQuery.headersList.get(fieldValue);
          if (requestValue !== queryValue)
            return !1;
        }
        return !0;
      }
      #internalMatchAll(request, options, maxResponses = 1 / 0) {
        let r = null;
        if (request !== void 0)
          if (request instanceof Request) {
            if (r = request[kState], r.method !== "GET" && !options.ignoreMethod)
              return [];
          } else typeof request == "string" && (r = new Request(request)[kState]);
        let responses = [];
        if (request === void 0)
          for (let requestResponse of this.#relevantRequestResponseList)
            responses.push(requestResponse[1]);
        else {
          let requestResponses = this.#queryCache(r, options);
          for (let requestResponse of requestResponses)
            responses.push(requestResponse[1]);
        }
        let responseList = [];
        for (let response of responses) {
          let responseObject = fromInnerResponse(response, "immutable");
          if (responseList.push(responseObject.clone()), responseList.length >= maxResponses)
            break;
        }
        return Object.freeze(responseList);
      }
    };
    Object.defineProperties(Cache.prototype, {
      [Symbol.toStringTag]: {
        value: "Cache",
        configurable: !0
      },
      match: kEnumerableProperty,
      matchAll: kEnumerableProperty,
      add: kEnumerableProperty,
      addAll: kEnumerableProperty,
      put: kEnumerableProperty,
      delete: kEnumerableProperty,
      keys: kEnumerableProperty
    });
    var cacheQueryOptionConverters = [
      {
        key: "ignoreSearch",
        converter: webidl.converters.boolean,
        defaultValue: () => !1
      },
      {
        key: "ignoreMethod",
        converter: webidl.converters.boolean,
        defaultValue: () => !1
      },
      {
        key: "ignoreVary",
        converter: webidl.converters.boolean,
        defaultValue: () => !1
      }
    ];
    webidl.converters.CacheQueryOptions = webidl.dictionaryConverter(cacheQueryOptionConverters);
    webidl.converters.MultiCacheQueryOptions = webidl.dictionaryConverter([
      ...cacheQueryOptionConverters,
      {
        key: "cacheName",
        converter: webidl.converters.DOMString
      }
    ]);
    webidl.converters.Response = webidl.interfaceConverter(Response);
    webidl.converters["sequence<RequestInfo>"] = webidl.sequenceConverter(
      webidl.converters.RequestInfo
    );
    module.exports = {
      Cache
    };
  }
});

// node_modules/undici/lib/web/cache/cachestorage.js
var require_cachestorage = __commonJS({
  "node_modules/undici/lib/web/cache/cachestorage.js"(exports, module) {
    "use strict";
    var { kConstruct } = require_symbols4(), { Cache } = require_cache(), { webidl } = require_webidl(), { kEnumerableProperty } = require_util(), CacheStorage = class _CacheStorage {
      /**
       * @see https://w3c.github.io/ServiceWorker/#dfn-relevant-name-to-cache-map
       * @type {Map<string, import('./cache').requestResponseList}
       */
      #caches = /* @__PURE__ */ new Map();
      constructor() {
        arguments[0] !== kConstruct && webidl.illegalConstructor(), webidl.util.markAsUncloneable(this);
      }
      async match(request, options = {}) {
        if (webidl.brandCheck(this, _CacheStorage), webidl.argumentLengthCheck(arguments, 1, "CacheStorage.match"), request = webidl.converters.RequestInfo(request), options = webidl.converters.MultiCacheQueryOptions(options), options.cacheName != null) {
          if (this.#caches.has(options.cacheName)) {
            let cacheList = this.#caches.get(options.cacheName);
            return await new Cache(kConstruct, cacheList).match(request, options);
          }
        } else
          for (let cacheList of this.#caches.values()) {
            let response = await new Cache(kConstruct, cacheList).match(request, options);
            if (response !== void 0)
              return response;
          }
      }
      /**
       * @see https://w3c.github.io/ServiceWorker/#cache-storage-has
       * @param {string} cacheName
       * @returns {Promise<boolean>}
       */
      async has(cacheName) {
        webidl.brandCheck(this, _CacheStorage);
        let prefix = "CacheStorage.has";
        return webidl.argumentLengthCheck(arguments, 1, prefix), cacheName = webidl.converters.DOMString(cacheName, prefix, "cacheName"), this.#caches.has(cacheName);
      }
      /**
       * @see https://w3c.github.io/ServiceWorker/#dom-cachestorage-open
       * @param {string} cacheName
       * @returns {Promise<Cache>}
       */
      async open(cacheName) {
        webidl.brandCheck(this, _CacheStorage);
        let prefix = "CacheStorage.open";
        if (webidl.argumentLengthCheck(arguments, 1, prefix), cacheName = webidl.converters.DOMString(cacheName, prefix, "cacheName"), this.#caches.has(cacheName)) {
          let cache2 = this.#caches.get(cacheName);
          return new Cache(kConstruct, cache2);
        }
        let cache = [];
        return this.#caches.set(cacheName, cache), new Cache(kConstruct, cache);
      }
      /**
       * @see https://w3c.github.io/ServiceWorker/#cache-storage-delete
       * @param {string} cacheName
       * @returns {Promise<boolean>}
       */
      async delete(cacheName) {
        webidl.brandCheck(this, _CacheStorage);
        let prefix = "CacheStorage.delete";
        return webidl.argumentLengthCheck(arguments, 1, prefix), cacheName = webidl.converters.DOMString(cacheName, prefix, "cacheName"), this.#caches.delete(cacheName);
      }
      /**
       * @see https://w3c.github.io/ServiceWorker/#cache-storage-keys
       * @returns {Promise<string[]>}
       */
      async keys() {
        return webidl.brandCheck(this, _CacheStorage), [...this.#caches.keys()];
      }
    };
    Object.defineProperties(CacheStorage.prototype, {
      [Symbol.toStringTag]: {
        value: "CacheStorage",
        configurable: !0
      },
      match: kEnumerableProperty,
      has: kEnumerableProperty,
      open: kEnumerableProperty,
      delete: kEnumerableProperty,
      keys: kEnumerableProperty
    });
    module.exports = {
      CacheStorage
    };
  }
});

// node_modules/undici/lib/web/cookies/constants.js
var require_constants4 = __commonJS({
  "node_modules/undici/lib/web/cookies/constants.js"(exports, module) {
    "use strict";
    module.exports = {
      maxAttributeValueSize: 1024,
      maxNameValuePairSize: 4096
    };
  }
});

// node_modules/undici/lib/web/cookies/util.js
var require_util6 = __commonJS({
  "node_modules/undici/lib/web/cookies/util.js"(exports, module) {
    "use strict";
    function isCTLExcludingHtab(value) {
      for (let i = 0; i < value.length; ++i) {
        let code = value.charCodeAt(i);
        if (code >= 0 && code <= 8 || code >= 10 && code <= 31 || code === 127)
          return !0;
      }
      return !1;
    }
    function validateCookieName(name) {
      for (let i = 0; i < name.length; ++i) {
        let code = name.charCodeAt(i);
        if (code < 33 || // exclude CTLs (0-31), SP and HT
        code > 126 || // exclude non-ascii and DEL
        code === 34 || // "
        code === 40 || // (
        code === 41 || // )
        code === 60 || // <
        code === 62 || // >
        code === 64 || // @
        code === 44 || // ,
        code === 59 || // ;
        code === 58 || // :
        code === 92 || // \
        code === 47 || // /
        code === 91 || // [
        code === 93 || // ]
        code === 63 || // ?
        code === 61 || // =
        code === 123 || // {
        code === 125)
          throw new Error("Invalid cookie name");
      }
    }
    function validateCookieValue(value) {
      let len = value.length, i = 0;
      if (value[0] === '"') {
        if (len === 1 || value[len - 1] !== '"')
          throw new Error("Invalid cookie value");
        --len, ++i;
      }
      for (; i < len; ) {
        let code = value.charCodeAt(i++);
        if (code < 33 || // exclude CTLs (0-31)
        code > 126 || // non-ascii and DEL (127)
        code === 34 || // "
        code === 44 || // ,
        code === 59 || // ;
        code === 92)
          throw new Error("Invalid cookie value");
      }
    }
    function validateCookiePath(path4) {
      for (let i = 0; i < path4.length; ++i) {
        let code = path4.charCodeAt(i);
        if (code < 32 || // exclude CTLs (0-31)
        code === 127 || // DEL
        code === 59)
          throw new Error("Invalid cookie path");
      }
    }
    function validateCookieDomain(domain) {
      if (domain.startsWith("-") || domain.endsWith(".") || domain.endsWith("-"))
        throw new Error("Invalid cookie domain");
    }
    var IMFDays = [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat"
    ], IMFMonths = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ], IMFPaddedNumbers = Array(61).fill(0).map((_, i) => i.toString().padStart(2, "0"));
    function toIMFDate(date) {
      return typeof date == "number" && (date = new Date(date)), `${IMFDays[date.getUTCDay()]}, ${IMFPaddedNumbers[date.getUTCDate()]} ${IMFMonths[date.getUTCMonth()]} ${date.getUTCFullYear()} ${IMFPaddedNumbers[date.getUTCHours()]}:${IMFPaddedNumbers[date.getUTCMinutes()]}:${IMFPaddedNumbers[date.getUTCSeconds()]} GMT`;
    }
    function validateCookieMaxAge(maxAge) {
      if (maxAge < 0)
        throw new Error("Invalid cookie max-age");
    }
    function stringify(cookie) {
      if (cookie.name.length === 0)
        return null;
      validateCookieName(cookie.name), validateCookieValue(cookie.value);
      let out = [`${cookie.name}=${cookie.value}`];
      cookie.name.startsWith("__Secure-") && (cookie.secure = !0), cookie.name.startsWith("__Host-") && (cookie.secure = !0, cookie.domain = null, cookie.path = "/"), cookie.secure && out.push("Secure"), cookie.httpOnly && out.push("HttpOnly"), typeof cookie.maxAge == "number" && (validateCookieMaxAge(cookie.maxAge), out.push(`Max-Age=${cookie.maxAge}`)), cookie.domain && (validateCookieDomain(cookie.domain), out.push(`Domain=${cookie.domain}`)), cookie.path && (validateCookiePath(cookie.path), out.push(`Path=${cookie.path}`)), cookie.expires && cookie.expires.toString() !== "Invalid Date" && out.push(`Expires=${toIMFDate(cookie.expires)}`), cookie.sameSite && out.push(`SameSite=${cookie.sameSite}`);
      for (let part of cookie.unparsed) {
        if (!part.includes("="))
          throw new Error("Invalid unparsed");
        let [key, ...value] = part.split("=");
        out.push(`${key.trim()}=${value.join("=")}`);
      }
      return out.join("; ");
    }
    module.exports = {
      isCTLExcludingHtab,
      validateCookieName,
      validateCookiePath,
      validateCookieValue,
      toIMFDate,
      stringify
    };
  }
});

// node_modules/undici/lib/web/cookies/parse.js
var require_parse = __commonJS({
  "node_modules/undici/lib/web/cookies/parse.js"(exports, module) {
    "use strict";
    var { maxNameValuePairSize, maxAttributeValueSize } = require_constants4(), { isCTLExcludingHtab } = require_util6(), { collectASequenceOfCodePointsFast } = require_data_url(), assert = __require("node:assert");
    function parseSetCookie(header) {
      if (isCTLExcludingHtab(header))
        return null;
      let nameValuePair = "", unparsedAttributes = "", name = "", value = "";
      if (header.includes(";")) {
        let position = { position: 0 };
        nameValuePair = collectASequenceOfCodePointsFast(";", header, position), unparsedAttributes = header.slice(position.position);
      } else
        nameValuePair = header;
      if (!nameValuePair.includes("="))
        value = nameValuePair;
      else {
        let position = { position: 0 };
        name = collectASequenceOfCodePointsFast(
          "=",
          nameValuePair,
          position
        ), value = nameValuePair.slice(position.position + 1);
      }
      return name = name.trim(), value = value.trim(), name.length + value.length > maxNameValuePairSize ? null : {
        name,
        value,
        ...parseUnparsedAttributes(unparsedAttributes)
      };
    }
    function parseUnparsedAttributes(unparsedAttributes, cookieAttributeList = {}) {
      if (unparsedAttributes.length === 0)
        return cookieAttributeList;
      assert(unparsedAttributes[0] === ";"), unparsedAttributes = unparsedAttributes.slice(1);
      let cookieAv = "";
      unparsedAttributes.includes(";") ? (cookieAv = collectASequenceOfCodePointsFast(
        ";",
        unparsedAttributes,
        { position: 0 }
      ), unparsedAttributes = unparsedAttributes.slice(cookieAv.length)) : (cookieAv = unparsedAttributes, unparsedAttributes = "");
      let attributeName = "", attributeValue = "";
      if (cookieAv.includes("=")) {
        let position = { position: 0 };
        attributeName = collectASequenceOfCodePointsFast(
          "=",
          cookieAv,
          position
        ), attributeValue = cookieAv.slice(position.position + 1);
      } else
        attributeName = cookieAv;
      if (attributeName = attributeName.trim(), attributeValue = attributeValue.trim(), attributeValue.length > maxAttributeValueSize)
        return parseUnparsedAttributes(unparsedAttributes, cookieAttributeList);
      let attributeNameLowercase = attributeName.toLowerCase();
      if (attributeNameLowercase === "expires") {
        let expiryTime = new Date(attributeValue);
        cookieAttributeList.expires = expiryTime;
      } else if (attributeNameLowercase === "max-age") {
        let charCode = attributeValue.charCodeAt(0);
        if ((charCode < 48 || charCode > 57) && attributeValue[0] !== "-" || !/^\d+$/.test(attributeValue))
          return parseUnparsedAttributes(unparsedAttributes, cookieAttributeList);
        let deltaSeconds = Number(attributeValue);
        cookieAttributeList.maxAge = deltaSeconds;
      } else if (attributeNameLowercase === "domain") {
        let cookieDomain = attributeValue;
        cookieDomain[0] === "." && (cookieDomain = cookieDomain.slice(1)), cookieDomain = cookieDomain.toLowerCase(), cookieAttributeList.domain = cookieDomain;
      } else if (attributeNameLowercase === "path") {
        let cookiePath = "";
        attributeValue.length === 0 || attributeValue[0] !== "/" ? cookiePath = "/" : cookiePath = attributeValue, cookieAttributeList.path = cookiePath;
      } else if (attributeNameLowercase === "secure")
        cookieAttributeList.secure = !0;
      else if (attributeNameLowercase === "httponly")
        cookieAttributeList.httpOnly = !0;
      else if (attributeNameLowercase === "samesite") {
        let enforcement = "Default", attributeValueLowercase = attributeValue.toLowerCase();
        attributeValueLowercase.includes("none") && (enforcement = "None"), attributeValueLowercase.includes("strict") && (enforcement = "Strict"), attributeValueLowercase.includes("lax") && (enforcement = "Lax"), cookieAttributeList.sameSite = enforcement;
      } else
        cookieAttributeList.unparsed ??= [], cookieAttributeList.unparsed.push(`${attributeName}=${attributeValue}`);
      return parseUnparsedAttributes(unparsedAttributes, cookieAttributeList);
    }
    module.exports = {
      parseSetCookie,
      parseUnparsedAttributes
    };
  }
});

// node_modules/undici/lib/web/cookies/index.js
var require_cookies = __commonJS({
  "node_modules/undici/lib/web/cookies/index.js"(exports, module) {
    "use strict";
    var { parseSetCookie } = require_parse(), { stringify } = require_util6(), { webidl } = require_webidl(), { Headers: Headers2 } = require_headers();
    function getCookies(headers) {
      webidl.argumentLengthCheck(arguments, 1, "getCookies"), webidl.brandCheck(headers, Headers2, { strict: !1 });
      let cookie = headers.get("cookie"), out = {};
      if (!cookie)
        return out;
      for (let piece of cookie.split(";")) {
        let [name, ...value] = piece.split("=");
        out[name.trim()] = value.join("=");
      }
      return out;
    }
    function deleteCookie(headers, name, attributes) {
      webidl.brandCheck(headers, Headers2, { strict: !1 });
      let prefix = "deleteCookie";
      webidl.argumentLengthCheck(arguments, 2, prefix), name = webidl.converters.DOMString(name, prefix, "name"), attributes = webidl.converters.DeleteCookieAttributes(attributes), setCookie(headers, {
        name,
        value: "",
        expires: /* @__PURE__ */ new Date(0),
        ...attributes
      });
    }
    function getSetCookies(headers) {
      webidl.argumentLengthCheck(arguments, 1, "getSetCookies"), webidl.brandCheck(headers, Headers2, { strict: !1 });
      let cookies = headers.getSetCookie();
      return cookies ? cookies.map((pair) => parseSetCookie(pair)) : [];
    }
    function setCookie(headers, cookie) {
      webidl.argumentLengthCheck(arguments, 2, "setCookie"), webidl.brandCheck(headers, Headers2, { strict: !1 }), cookie = webidl.converters.Cookie(cookie);
      let str = stringify(cookie);
      str && headers.append("Set-Cookie", str);
    }
    webidl.converters.DeleteCookieAttributes = webidl.dictionaryConverter([
      {
        converter: webidl.nullableConverter(webidl.converters.DOMString),
        key: "path",
        defaultValue: () => null
      },
      {
        converter: webidl.nullableConverter(webidl.converters.DOMString),
        key: "domain",
        defaultValue: () => null
      }
    ]);
    webidl.converters.Cookie = webidl.dictionaryConverter([
      {
        converter: webidl.converters.DOMString,
        key: "name"
      },
      {
        converter: webidl.converters.DOMString,
        key: "value"
      },
      {
        converter: webidl.nullableConverter((value) => typeof value == "number" ? webidl.converters["unsigned long long"](value) : new Date(value)),
        key: "expires",
        defaultValue: () => null
      },
      {
        converter: webidl.nullableConverter(webidl.converters["long long"]),
        key: "maxAge",
        defaultValue: () => null
      },
      {
        converter: webidl.nullableConverter(webidl.converters.DOMString),
        key: "domain",
        defaultValue: () => null
      },
      {
        converter: webidl.nullableConverter(webidl.converters.DOMString),
        key: "path",
        defaultValue: () => null
      },
      {
        converter: webidl.nullableConverter(webidl.converters.boolean),
        key: "secure",
        defaultValue: () => null
      },
      {
        converter: webidl.nullableConverter(webidl.converters.boolean),
        key: "httpOnly",
        defaultValue: () => null
      },
      {
        converter: webidl.converters.USVString,
        key: "sameSite",
        allowedValues: ["Strict", "Lax", "None"]
      },
      {
        converter: webidl.sequenceConverter(webidl.converters.DOMString),
        key: "unparsed",
        defaultValue: () => new Array(0)
      }
    ]);
    module.exports = {
      getCookies,
      deleteCookie,
      getSetCookies,
      setCookie
    };
  }
});

// node_modules/undici/lib/web/websocket/events.js
var require_events = __commonJS({
  "node_modules/undici/lib/web/websocket/events.js"(exports, module) {
    "use strict";
    var { webidl } = require_webidl(), { kEnumerableProperty } = require_util(), { kConstruct } = require_symbols(), { MessagePort } = __require("node:worker_threads"), MessageEvent = class _MessageEvent extends Event {
      #eventInit;
      constructor(type, eventInitDict = {}) {
        if (type === kConstruct) {
          super(arguments[1], arguments[2]), webidl.util.markAsUncloneable(this);
          return;
        }
        let prefix = "MessageEvent constructor";
        webidl.argumentLengthCheck(arguments, 1, prefix), type = webidl.converters.DOMString(type, prefix, "type"), eventInitDict = webidl.converters.MessageEventInit(eventInitDict, prefix, "eventInitDict"), super(type, eventInitDict), this.#eventInit = eventInitDict, webidl.util.markAsUncloneable(this);
      }
      get data() {
        return webidl.brandCheck(this, _MessageEvent), this.#eventInit.data;
      }
      get origin() {
        return webidl.brandCheck(this, _MessageEvent), this.#eventInit.origin;
      }
      get lastEventId() {
        return webidl.brandCheck(this, _MessageEvent), this.#eventInit.lastEventId;
      }
      get source() {
        return webidl.brandCheck(this, _MessageEvent), this.#eventInit.source;
      }
      get ports() {
        return webidl.brandCheck(this, _MessageEvent), Object.isFrozen(this.#eventInit.ports) || Object.freeze(this.#eventInit.ports), this.#eventInit.ports;
      }
      initMessageEvent(type, bubbles = !1, cancelable = !1, data = null, origin = "", lastEventId = "", source = null, ports = []) {
        return webidl.brandCheck(this, _MessageEvent), webidl.argumentLengthCheck(arguments, 1, "MessageEvent.initMessageEvent"), new _MessageEvent(type, {
          bubbles,
          cancelable,
          data,
          origin,
          lastEventId,
          source,
          ports
        });
      }
      static createFastMessageEvent(type, init) {
        let messageEvent = new _MessageEvent(kConstruct, type, init);
        return messageEvent.#eventInit = init, messageEvent.#eventInit.data ??= null, messageEvent.#eventInit.origin ??= "", messageEvent.#eventInit.lastEventId ??= "", messageEvent.#eventInit.source ??= null, messageEvent.#eventInit.ports ??= [], messageEvent;
      }
    }, { createFastMessageEvent } = MessageEvent;
    delete MessageEvent.createFastMessageEvent;
    var CloseEvent = class _CloseEvent extends Event {
      #eventInit;
      constructor(type, eventInitDict = {}) {
        let prefix = "CloseEvent constructor";
        webidl.argumentLengthCheck(arguments, 1, prefix), type = webidl.converters.DOMString(type, prefix, "type"), eventInitDict = webidl.converters.CloseEventInit(eventInitDict), super(type, eventInitDict), this.#eventInit = eventInitDict, webidl.util.markAsUncloneable(this);
      }
      get wasClean() {
        return webidl.brandCheck(this, _CloseEvent), this.#eventInit.wasClean;
      }
      get code() {
        return webidl.brandCheck(this, _CloseEvent), this.#eventInit.code;
      }
      get reason() {
        return webidl.brandCheck(this, _CloseEvent), this.#eventInit.reason;
      }
    }, ErrorEvent = class _ErrorEvent extends Event {
      #eventInit;
      constructor(type, eventInitDict) {
        let prefix = "ErrorEvent constructor";
        webidl.argumentLengthCheck(arguments, 1, prefix), super(type, eventInitDict), webidl.util.markAsUncloneable(this), type = webidl.converters.DOMString(type, prefix, "type"), eventInitDict = webidl.converters.ErrorEventInit(eventInitDict ?? {}), this.#eventInit = eventInitDict;
      }
      get message() {
        return webidl.brandCheck(this, _ErrorEvent), this.#eventInit.message;
      }
      get filename() {
        return webidl.brandCheck(this, _ErrorEvent), this.#eventInit.filename;
      }
      get lineno() {
        return webidl.brandCheck(this, _ErrorEvent), this.#eventInit.lineno;
      }
      get colno() {
        return webidl.brandCheck(this, _ErrorEvent), this.#eventInit.colno;
      }
      get error() {
        return webidl.brandCheck(this, _ErrorEvent), this.#eventInit.error;
      }
    };
    Object.defineProperties(MessageEvent.prototype, {
      [Symbol.toStringTag]: {
        value: "MessageEvent",
        configurable: !0
      },
      data: kEnumerableProperty,
      origin: kEnumerableProperty,
      lastEventId: kEnumerableProperty,
      source: kEnumerableProperty,
      ports: kEnumerableProperty,
      initMessageEvent: kEnumerableProperty
    });
    Object.defineProperties(CloseEvent.prototype, {
      [Symbol.toStringTag]: {
        value: "CloseEvent",
        configurable: !0
      },
      reason: kEnumerableProperty,
      code: kEnumerableProperty,
      wasClean: kEnumerableProperty
    });
    Object.defineProperties(ErrorEvent.prototype, {
      [Symbol.toStringTag]: {
        value: "ErrorEvent",
        configurable: !0
      },
      message: kEnumerableProperty,
      filename: kEnumerableProperty,
      lineno: kEnumerableProperty,
      colno: kEnumerableProperty,
      error: kEnumerableProperty
    });
    webidl.converters.MessagePort = webidl.interfaceConverter(MessagePort);
    webidl.converters["sequence<MessagePort>"] = webidl.sequenceConverter(
      webidl.converters.MessagePort
    );
    var eventInit = [
      {
        key: "bubbles",
        converter: webidl.converters.boolean,
        defaultValue: () => !1
      },
      {
        key: "cancelable",
        converter: webidl.converters.boolean,
        defaultValue: () => !1
      },
      {
        key: "composed",
        converter: webidl.converters.boolean,
        defaultValue: () => !1
      }
    ];
    webidl.converters.MessageEventInit = webidl.dictionaryConverter([
      ...eventInit,
      {
        key: "data",
        converter: webidl.converters.any,
        defaultValue: () => null
      },
      {
        key: "origin",
        converter: webidl.converters.USVString,
        defaultValue: () => ""
      },
      {
        key: "lastEventId",
        converter: webidl.converters.DOMString,
        defaultValue: () => ""
      },
      {
        key: "source",
        // Node doesn't implement WindowProxy or ServiceWorker, so the only
        // valid value for source is a MessagePort.
        converter: webidl.nullableConverter(webidl.converters.MessagePort),
        defaultValue: () => null
      },
      {
        key: "ports",
        converter: webidl.converters["sequence<MessagePort>"],
        defaultValue: () => new Array(0)
      }
    ]);
    webidl.converters.CloseEventInit = webidl.dictionaryConverter([
      ...eventInit,
      {
        key: "wasClean",
        converter: webidl.converters.boolean,
        defaultValue: () => !1
      },
      {
        key: "code",
        converter: webidl.converters["unsigned short"],
        defaultValue: () => 0
      },
      {
        key: "reason",
        converter: webidl.converters.USVString,
        defaultValue: () => ""
      }
    ]);
    webidl.converters.ErrorEventInit = webidl.dictionaryConverter([
      ...eventInit,
      {
        key: "message",
        converter: webidl.converters.DOMString,
        defaultValue: () => ""
      },
      {
        key: "filename",
        converter: webidl.converters.USVString,
        defaultValue: () => ""
      },
      {
        key: "lineno",
        converter: webidl.converters["unsigned long"],
        defaultValue: () => 0
      },
      {
        key: "colno",
        converter: webidl.converters["unsigned long"],
        defaultValue: () => 0
      },
      {
        key: "error",
        converter: webidl.converters.any
      }
    ]);
    module.exports = {
      MessageEvent,
      CloseEvent,
      ErrorEvent,
      createFastMessageEvent
    };
  }
});

// node_modules/undici/lib/web/websocket/constants.js
var require_constants5 = __commonJS({
  "node_modules/undici/lib/web/websocket/constants.js"(exports, module) {
    "use strict";
    var uid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11", staticPropertyDescriptors = {
      enumerable: !0,
      writable: !1,
      configurable: !1
    }, states = {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3
    }, sentCloseFrameState = {
      NOT_SENT: 0,
      PROCESSING: 1,
      SENT: 2
    }, opcodes = {
      CONTINUATION: 0,
      TEXT: 1,
      BINARY: 2,
      CLOSE: 8,
      PING: 9,
      PONG: 10
    }, maxUnsigned16Bit = 2 ** 16 - 1, parserStates = {
      INFO: 0,
      PAYLOADLENGTH_16: 2,
      PAYLOADLENGTH_64: 3,
      READ_DATA: 4
    }, emptyBuffer = Buffer.allocUnsafe(0), sendHints = {
      string: 1,
      typedArray: 2,
      arrayBuffer: 3,
      blob: 4
    };
    module.exports = {
      uid,
      sentCloseFrameState,
      staticPropertyDescriptors,
      states,
      opcodes,
      maxUnsigned16Bit,
      parserStates,
      emptyBuffer,
      sendHints
    };
  }
});

// node_modules/undici/lib/web/websocket/symbols.js
var require_symbols5 = __commonJS({
  "node_modules/undici/lib/web/websocket/symbols.js"(exports, module) {
    "use strict";
    module.exports = {
      kWebSocketURL: /* @__PURE__ */ Symbol("url"),
      kReadyState: /* @__PURE__ */ Symbol("ready state"),
      kController: /* @__PURE__ */ Symbol("controller"),
      kResponse: /* @__PURE__ */ Symbol("response"),
      kBinaryType: /* @__PURE__ */ Symbol("binary type"),
      kSentClose: /* @__PURE__ */ Symbol("sent close"),
      kReceivedClose: /* @__PURE__ */ Symbol("received close"),
      kByteParser: /* @__PURE__ */ Symbol("byte parser")
    };
  }
});

// node_modules/undici/lib/web/websocket/util.js
var require_util7 = __commonJS({
  "node_modules/undici/lib/web/websocket/util.js"(exports, module) {
    "use strict";
    var { kReadyState, kController, kResponse, kBinaryType, kWebSocketURL } = require_symbols5(), { states, opcodes } = require_constants5(), { ErrorEvent, createFastMessageEvent } = require_events(), { isUtf8 } = __require("node:buffer"), { collectASequenceOfCodePointsFast, removeHTTPWhitespace } = require_data_url();
    function isConnecting(ws) {
      return ws[kReadyState] === states.CONNECTING;
    }
    function isEstablished(ws) {
      return ws[kReadyState] === states.OPEN;
    }
    function isClosing(ws) {
      return ws[kReadyState] === states.CLOSING;
    }
    function isClosed(ws) {
      return ws[kReadyState] === states.CLOSED;
    }
    function fireEvent(e, target, eventFactory = (type, init) => new Event(type, init), eventInitDict = {}) {
      let event = eventFactory(e, eventInitDict);
      target.dispatchEvent(event);
    }
    function websocketMessageReceived(ws, type, data) {
      if (ws[kReadyState] !== states.OPEN)
        return;
      let dataForEvent;
      if (type === opcodes.TEXT)
        try {
          dataForEvent = utf8Decode(data);
        } catch {
          failWebsocketConnection(ws, "Received invalid UTF-8 in text frame.");
          return;
        }
      else type === opcodes.BINARY && (ws[kBinaryType] === "blob" ? dataForEvent = new Blob([data]) : dataForEvent = toArrayBuffer2(data));
      fireEvent("message", ws, createFastMessageEvent, {
        origin: ws[kWebSocketURL].origin,
        data: dataForEvent
      });
    }
    function toArrayBuffer2(buffer) {
      return buffer.byteLength === buffer.buffer.byteLength ? buffer.buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    function isValidSubprotocol(protocol) {
      if (protocol.length === 0)
        return !1;
      for (let i = 0; i < protocol.length; ++i) {
        let code = protocol.charCodeAt(i);
        if (code < 33 || // CTL, contains SP (0x20) and HT (0x09)
        code > 126 || code === 34 || // "
        code === 40 || // (
        code === 41 || // )
        code === 44 || // ,
        code === 47 || // /
        code === 58 || // :
        code === 59 || // ;
        code === 60 || // <
        code === 61 || // =
        code === 62 || // >
        code === 63 || // ?
        code === 64 || // @
        code === 91 || // [
        code === 92 || // \
        code === 93 || // ]
        code === 123 || // {
        code === 125)
          return !1;
      }
      return !0;
    }
    function isValidStatusCode(code) {
      return code >= 1e3 && code < 1015 ? code !== 1004 && // reserved
      code !== 1005 && // "MUST NOT be set as a status code"
      code !== 1006 : code >= 3e3 && code <= 4999;
    }
    function failWebsocketConnection(ws, reason) {
      let { [kController]: controller, [kResponse]: response } = ws;
      controller.abort(), response?.socket && !response.socket.destroyed && response.socket.destroy(), reason && fireEvent("error", ws, (type, init) => new ErrorEvent(type, init), {
        error: new Error(reason),
        message: reason
      });
    }
    function isControlFrame(opcode) {
      return opcode === opcodes.CLOSE || opcode === opcodes.PING || opcode === opcodes.PONG;
    }
    function isContinuationFrame(opcode) {
      return opcode === opcodes.CONTINUATION;
    }
    function isTextBinaryFrame(opcode) {
      return opcode === opcodes.TEXT || opcode === opcodes.BINARY;
    }
    function isValidOpcode(opcode) {
      return isTextBinaryFrame(opcode) || isContinuationFrame(opcode) || isControlFrame(opcode);
    }
    function parseExtensions(extensions) {
      let position = { position: 0 }, extensionList = /* @__PURE__ */ new Map();
      for (; position.position < extensions.length; ) {
        let pair = collectASequenceOfCodePointsFast(";", extensions, position), [name, value = ""] = pair.split("=");
        extensionList.set(
          removeHTTPWhitespace(name, !0, !1),
          removeHTTPWhitespace(value, !1, !0)
        ), position.position++;
      }
      return extensionList;
    }
    function isValidClientWindowBits(value) {
      if (value.length === 0)
        return !1;
      for (let i = 0; i < value.length; i++) {
        let byte = value.charCodeAt(i);
        if (byte < 48 || byte > 57)
          return !1;
      }
      let num = Number.parseInt(value, 10);
      return num >= 8 && num <= 15;
    }
    var hasIntl = typeof process.versions.icu == "string", fatalDecoder = hasIntl ? new TextDecoder("utf-8", { fatal: !0 }) : void 0, utf8Decode = hasIntl ? fatalDecoder.decode.bind(fatalDecoder) : function(buffer) {
      if (isUtf8(buffer))
        return buffer.toString("utf-8");
      throw new TypeError("Invalid utf-8 received.");
    };
    module.exports = {
      isConnecting,
      isEstablished,
      isClosing,
      isClosed,
      fireEvent,
      isValidSubprotocol,
      isValidStatusCode,
      failWebsocketConnection,
      websocketMessageReceived,
      utf8Decode,
      isControlFrame,
      isContinuationFrame,
      isTextBinaryFrame,
      isValidOpcode,
      parseExtensions,
      isValidClientWindowBits
    };
  }
});

// node_modules/undici/lib/web/websocket/frame.js
var require_frame = __commonJS({
  "node_modules/undici/lib/web/websocket/frame.js"(exports, module) {
    "use strict";
    var { maxUnsigned16Bit } = require_constants5(), BUFFER_SIZE = 16386, crypto2, buffer = null, bufIdx = BUFFER_SIZE;
    try {
      crypto2 = __require("node:crypto");
    } catch {
      crypto2 = {
        // not full compatibility, but minimum.
        randomFillSync: function(buffer2, _offset, _size) {
          for (let i = 0; i < buffer2.length; ++i)
            buffer2[i] = Math.random() * 255 | 0;
          return buffer2;
        }
      };
    }
    function generateMask() {
      return bufIdx === BUFFER_SIZE && (bufIdx = 0, crypto2.randomFillSync(buffer ??= Buffer.allocUnsafe(BUFFER_SIZE), 0, BUFFER_SIZE)), [buffer[bufIdx++], buffer[bufIdx++], buffer[bufIdx++], buffer[bufIdx++]];
    }
    var WebsocketFrameSend = class {
      /**
       * @param {Buffer|undefined} data
       */
      constructor(data) {
        this.frameData = data;
      }
      createFrame(opcode) {
        let frameData = this.frameData, maskKey = generateMask(), bodyLength = frameData?.byteLength ?? 0, payloadLength = bodyLength, offset = 6;
        bodyLength > maxUnsigned16Bit ? (offset += 8, payloadLength = 127) : bodyLength > 125 && (offset += 2, payloadLength = 126);
        let buffer2 = Buffer.allocUnsafe(bodyLength + offset);
        buffer2[0] = buffer2[1] = 0, buffer2[0] |= 128, buffer2[0] = (buffer2[0] & 240) + opcode;
        /*! ws. MIT License. Einar Otto Stangvik <einaros@gmail.com> */
        buffer2[offset - 4] = maskKey[0], buffer2[offset - 3] = maskKey[1], buffer2[offset - 2] = maskKey[2], buffer2[offset - 1] = maskKey[3], buffer2[1] = payloadLength, payloadLength === 126 ? buffer2.writeUInt16BE(bodyLength, 2) : payloadLength === 127 && (buffer2[2] = buffer2[3] = 0, buffer2.writeUIntBE(bodyLength, 4, 6)), buffer2[1] |= 128;
        for (let i = 0; i < bodyLength; ++i)
          buffer2[offset + i] = frameData[i] ^ maskKey[i & 3];
        return buffer2;
      }
    };
    module.exports = {
      WebsocketFrameSend
    };
  }
});

// node_modules/undici/lib/web/websocket/connection.js
var require_connection = __commonJS({
  "node_modules/undici/lib/web/websocket/connection.js"(exports, module) {
    "use strict";
    var { uid, states, sentCloseFrameState, emptyBuffer, opcodes } = require_constants5(), {
      kReadyState,
      kSentClose,
      kByteParser,
      kReceivedClose,
      kResponse
    } = require_symbols5(), { fireEvent, failWebsocketConnection, isClosing, isClosed, isEstablished, parseExtensions } = require_util7(), { channels } = require_diagnostics(), { CloseEvent } = require_events(), { makeRequest } = require_request2(), { fetching } = require_fetch(), { Headers: Headers2, getHeadersList } = require_headers(), { getDecodeSplit } = require_util2(), { WebsocketFrameSend } = require_frame(), crypto2;
    try {
      crypto2 = __require("node:crypto");
    } catch {
    }
    function establishWebSocketConnection(url, protocols, client, ws, onEstablish, options) {
      let requestURL = url;
      requestURL.protocol = url.protocol === "ws:" ? "http:" : "https:";
      let request = makeRequest({
        urlList: [requestURL],
        client,
        serviceWorkers: "none",
        referrer: "no-referrer",
        mode: "websocket",
        credentials: "include",
        cache: "no-store",
        redirect: "error"
      });
      if (options.headers) {
        let headersList = getHeadersList(new Headers2(options.headers));
        request.headersList = headersList;
      }
      let keyValue = crypto2.randomBytes(16).toString("base64");
      request.headersList.append("sec-websocket-key", keyValue), request.headersList.append("sec-websocket-version", "13");
      for (let protocol of protocols)
        request.headersList.append("sec-websocket-protocol", protocol);
      return request.headersList.append("sec-websocket-extensions", "permessage-deflate; client_max_window_bits"), fetching({
        request,
        useParallelQueue: !0,
        dispatcher: options.dispatcher,
        processResponse(response) {
          if (response.type === "error" || response.status !== 101) {
            failWebsocketConnection(ws, "Received network error or non-101 status code.");
            return;
          }
          if (protocols.length !== 0 && !response.headersList.get("Sec-WebSocket-Protocol")) {
            failWebsocketConnection(ws, "Server did not respond with sent protocols.");
            return;
          }
          if (response.headersList.get("Upgrade")?.toLowerCase() !== "websocket") {
            failWebsocketConnection(ws, 'Server did not set Upgrade header to "websocket".');
            return;
          }
          if (response.headersList.get("Connection")?.toLowerCase() !== "upgrade") {
            failWebsocketConnection(ws, 'Server did not set Connection header to "upgrade".');
            return;
          }
          let secWSAccept = response.headersList.get("Sec-WebSocket-Accept"), digest = crypto2.createHash("sha1").update(keyValue + uid).digest("base64");
          if (secWSAccept !== digest) {
            failWebsocketConnection(ws, "Incorrect hash received in Sec-WebSocket-Accept header.");
            return;
          }
          let secExtension = response.headersList.get("Sec-WebSocket-Extensions"), extensions;
          if (secExtension !== null && (extensions = parseExtensions(secExtension), !extensions.has("permessage-deflate"))) {
            failWebsocketConnection(ws, "Sec-WebSocket-Extensions header does not match.");
            return;
          }
          let secProtocol = response.headersList.get("Sec-WebSocket-Protocol");
          if (secProtocol !== null && !getDecodeSplit("sec-websocket-protocol", request.headersList).includes(secProtocol)) {
            failWebsocketConnection(ws, "Protocol was not set in the opening handshake.");
            return;
          }
          response.socket.on("data", onSocketData), response.socket.on("close", onSocketClose), response.socket.on("error", onSocketError), channels.open.hasSubscribers && channels.open.publish({
            address: response.socket.address(),
            protocol: secProtocol,
            extensions: secExtension
          }), onEstablish(response, extensions);
        }
      });
    }
    function closeWebSocketConnection(ws, code, reason, reasonByteLength) {
      if (!(isClosing(ws) || isClosed(ws)))
        if (!isEstablished(ws))
          failWebsocketConnection(ws, "Connection was closed before it was established."), ws[kReadyState] = states.CLOSING;
        else if (ws[kSentClose] === sentCloseFrameState.NOT_SENT) {
          ws[kSentClose] = sentCloseFrameState.PROCESSING;
          let frame = new WebsocketFrameSend();
          code !== void 0 && reason === void 0 ? (frame.frameData = Buffer.allocUnsafe(2), frame.frameData.writeUInt16BE(code, 0)) : code !== void 0 && reason !== void 0 ? (frame.frameData = Buffer.allocUnsafe(2 + reasonByteLength), frame.frameData.writeUInt16BE(code, 0), frame.frameData.write(reason, 2, "utf-8")) : frame.frameData = emptyBuffer, ws[kResponse].socket.write(frame.createFrame(opcodes.CLOSE)), ws[kSentClose] = sentCloseFrameState.SENT, ws[kReadyState] = states.CLOSING;
        } else
          ws[kReadyState] = states.CLOSING;
    }
    function onSocketData(chunk) {
      this.ws[kByteParser].write(chunk) || this.pause();
    }
    function onSocketClose() {
      let { ws } = this, { [kResponse]: response } = ws;
      response.socket.off("data", onSocketData), response.socket.off("close", onSocketClose), response.socket.off("error", onSocketError);
      let wasClean = ws[kSentClose] === sentCloseFrameState.SENT && ws[kReceivedClose], code = 1005, reason = "", result = ws[kByteParser].closingInfo;
      result && !result.error ? (code = result.code ?? 1005, reason = result.reason) : ws[kReceivedClose] || (code = 1006), ws[kReadyState] = states.CLOSED, fireEvent("close", ws, (type, init) => new CloseEvent(type, init), {
        wasClean,
        code,
        reason
      }), channels.close.hasSubscribers && channels.close.publish({
        websocket: ws,
        code,
        reason
      });
    }
    function onSocketError(error2) {
      let { ws } = this;
      ws[kReadyState] = states.CLOSING, channels.socketError.hasSubscribers && channels.socketError.publish(error2), this.destroy();
    }
    module.exports = {
      establishWebSocketConnection,
      closeWebSocketConnection
    };
  }
});

// node_modules/undici/lib/web/websocket/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/undici/lib/web/websocket/permessage-deflate.js"(exports, module) {
    "use strict";
    var { createInflateRaw, Z_DEFAULT_WINDOWBITS } = __require("node:zlib"), { isValidClientWindowBits } = require_util7(), { MessageSizeExceededError } = require_errors(), tail = Buffer.from([0, 0, 255, 255]), kBuffer = /* @__PURE__ */ Symbol("kBuffer"), kLength = /* @__PURE__ */ Symbol("kLength"), PerMessageDeflate = class {
      /** @type {import('node:zlib').InflateRaw} */
      #inflate;
      #options = {};
      #maxPayloadSize = 0;
      /**
       * @param {Map<string, string>} extensions
       */
      constructor(extensions, options) {
        this.#options.serverNoContextTakeover = extensions.has("server_no_context_takeover"), this.#options.serverMaxWindowBits = extensions.get("server_max_window_bits"), this.#maxPayloadSize = options.maxPayloadSize;
      }
      /**
       * Decompress a compressed payload.
       * @param {Buffer} chunk Compressed data
       * @param {boolean} fin Final fragment flag
       * @param {Function} callback Callback function
       */
      decompress(chunk, fin, callback) {
        if (!this.#inflate) {
          let windowBits = Z_DEFAULT_WINDOWBITS;
          if (this.#options.serverMaxWindowBits) {
            if (!isValidClientWindowBits(this.#options.serverMaxWindowBits)) {
              callback(new Error("Invalid server_max_window_bits"));
              return;
            }
            windowBits = Number.parseInt(this.#options.serverMaxWindowBits);
          }
          try {
            this.#inflate = createInflateRaw({ windowBits });
          } catch (err) {
            callback(err);
            return;
          }
          this.#inflate[kBuffer] = [], this.#inflate[kLength] = 0, this.#inflate.on("data", (data) => {
            if (this.#inflate[kLength] += data.length, this.#maxPayloadSize > 0 && this.#inflate[kLength] > this.#maxPayloadSize) {
              callback(new MessageSizeExceededError()), this.#inflate.removeAllListeners(), this.#inflate = null;
              return;
            }
            this.#inflate[kBuffer].push(data);
          }), this.#inflate.on("error", (err) => {
            this.#inflate = null, callback(err);
          });
        }
        this.#inflate.write(chunk), fin && this.#inflate.write(tail), this.#inflate.flush(() => {
          if (!this.#inflate)
            return;
          let full = Buffer.concat(this.#inflate[kBuffer], this.#inflate[kLength]);
          this.#inflate[kBuffer].length = 0, this.#inflate[kLength] = 0, callback(null, full);
        });
      }
    };
    module.exports = { PerMessageDeflate };
  }
});

// node_modules/undici/lib/web/websocket/receiver.js
var require_receiver = __commonJS({
  "node_modules/undici/lib/web/websocket/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("node:stream"), assert = __require("node:assert"), { parserStates, opcodes, states, emptyBuffer, sentCloseFrameState } = require_constants5(), { kReadyState, kSentClose, kResponse, kReceivedClose } = require_symbols5(), { channels } = require_diagnostics(), {
      isValidStatusCode,
      isValidOpcode,
      failWebsocketConnection,
      websocketMessageReceived,
      utf8Decode,
      isControlFrame,
      isTextBinaryFrame,
      isContinuationFrame
    } = require_util7(), { WebsocketFrameSend } = require_frame(), { closeWebSocketConnection } = require_connection(), { PerMessageDeflate } = require_permessage_deflate(), { MessageSizeExceededError } = require_errors(), ByteParser = class extends Writable {
      #buffers = [];
      #fragmentsBytes = 0;
      #byteOffset = 0;
      #loop = !1;
      #state = parserStates.INFO;
      #info = {};
      #fragments = [];
      /** @type {Map<string, PerMessageDeflate>} */
      #extensions;
      /** @type {number} */
      #maxPayloadSize;
      /**
       * @param {import('./websocket').WebSocket} ws
       * @param {Map<string, string>|null} extensions
       * @param {{ maxPayloadSize?: number }} [options]
       */
      constructor(ws, extensions, options = {}) {
        super(), this.ws = ws, this.#extensions = extensions ?? /* @__PURE__ */ new Map(), this.#maxPayloadSize = options.maxPayloadSize ?? 0, this.#extensions.has("permessage-deflate") && this.#extensions.set("permessage-deflate", new PerMessageDeflate(extensions, options));
      }
      /**
       * @param {Buffer} chunk
       * @param {() => void} callback
       */
      _write(chunk, _, callback) {
        this.#buffers.push(chunk), this.#byteOffset += chunk.length, this.#loop = !0, this.run(callback);
      }
      #validatePayloadLength() {
        return this.#maxPayloadSize > 0 && !isControlFrame(this.#info.opcode) && this.#info.payloadLength > this.#maxPayloadSize ? (failWebsocketConnection(this.ws, "Payload size exceeds maximum allowed size"), !1) : !0;
      }
      /**
       * Runs whenever a new chunk is received.
       * Callback is called whenever there are no more chunks buffering,
       * or not enough bytes are buffered to parse.
       */
      run(callback) {
        for (; this.#loop; )
          if (this.#state === parserStates.INFO) {
            if (this.#byteOffset < 2)
              return callback();
            let buffer = this.consume(2), fin = (buffer[0] & 128) !== 0, opcode = buffer[0] & 15, masked = (buffer[1] & 128) === 128, fragmented = !fin && opcode !== opcodes.CONTINUATION, payloadLength = buffer[1] & 127, rsv1 = buffer[0] & 64, rsv2 = buffer[0] & 32, rsv3 = buffer[0] & 16;
            if (!isValidOpcode(opcode))
              return failWebsocketConnection(this.ws, "Invalid opcode received"), callback();
            if (masked)
              return failWebsocketConnection(this.ws, "Frame cannot be masked"), callback();
            if (rsv1 !== 0 && !this.#extensions.has("permessage-deflate")) {
              failWebsocketConnection(this.ws, "Expected RSV1 to be clear.");
              return;
            }
            if (rsv2 !== 0 || rsv3 !== 0) {
              failWebsocketConnection(this.ws, "RSV1, RSV2, RSV3 must be clear");
              return;
            }
            if (fragmented && !isTextBinaryFrame(opcode)) {
              failWebsocketConnection(this.ws, "Invalid frame type was fragmented.");
              return;
            }
            if (isTextBinaryFrame(opcode) && this.#fragments.length > 0) {
              failWebsocketConnection(this.ws, "Expected continuation frame");
              return;
            }
            if (this.#info.fragmented && fragmented) {
              failWebsocketConnection(this.ws, "Fragmented frame exceeded 125 bytes.");
              return;
            }
            if ((payloadLength > 125 || fragmented) && isControlFrame(opcode)) {
              failWebsocketConnection(this.ws, "Control frame either too large or fragmented");
              return;
            }
            if (isContinuationFrame(opcode) && this.#fragments.length === 0 && !this.#info.compressed) {
              failWebsocketConnection(this.ws, "Unexpected continuation frame");
              return;
            }
            if (payloadLength <= 125) {
              if (this.#info.payloadLength = payloadLength, this.#state = parserStates.READ_DATA, !this.#validatePayloadLength())
                return;
            } else payloadLength === 126 ? this.#state = parserStates.PAYLOADLENGTH_16 : payloadLength === 127 && (this.#state = parserStates.PAYLOADLENGTH_64);
            isTextBinaryFrame(opcode) && (this.#info.binaryType = opcode, this.#info.compressed = rsv1 !== 0), this.#info.opcode = opcode, this.#info.masked = masked, this.#info.fin = fin, this.#info.fragmented = fragmented;
          } else if (this.#state === parserStates.PAYLOADLENGTH_16) {
            if (this.#byteOffset < 2)
              return callback();
            let buffer = this.consume(2);
            if (this.#info.payloadLength = buffer.readUInt16BE(0), this.#state = parserStates.READ_DATA, !this.#validatePayloadLength())
              return;
          } else if (this.#state === parserStates.PAYLOADLENGTH_64) {
            if (this.#byteOffset < 8)
              return callback();
            let buffer = this.consume(8), upper = buffer.readUInt32BE(0), lower = buffer.readUInt32BE(4);
            if (upper !== 0 || lower > 2 ** 31 - 1) {
              failWebsocketConnection(this.ws, "Received payload length > 2^31 bytes.");
              return;
            }
            if (this.#info.payloadLength = lower, this.#state = parserStates.READ_DATA, !this.#validatePayloadLength())
              return;
          } else if (this.#state === parserStates.READ_DATA) {
            if (this.#byteOffset < this.#info.payloadLength)
              return callback();
            let body = this.consume(this.#info.payloadLength);
            if (isControlFrame(this.#info.opcode))
              this.#loop = this.parseControlFrame(body), this.#state = parserStates.INFO;
            else if (this.#info.compressed) {
              this.#extensions.get("permessage-deflate").decompress(
                body,
                this.#info.fin,
                (error2, data) => {
                  if (error2) {
                    failWebsocketConnection(this.ws, error2.message);
                    return;
                  }
                  if (this.writeFragments(data), this.#maxPayloadSize > 0 && this.#fragmentsBytes > this.#maxPayloadSize) {
                    failWebsocketConnection(this.ws, new MessageSizeExceededError().message);
                    return;
                  }
                  if (!this.#info.fin) {
                    this.#state = parserStates.INFO, this.#loop = !0, this.run(callback);
                    return;
                  }
                  websocketMessageReceived(this.ws, this.#info.binaryType, this.consumeFragments()), this.#loop = !0, this.#state = parserStates.INFO, this.run(callback);
                }
              ), this.#loop = !1;
              break;
            } else {
              if (this.writeFragments(body), this.#maxPayloadSize > 0 && this.#fragmentsBytes > this.#maxPayloadSize) {
                failWebsocketConnection(this.ws, new MessageSizeExceededError().message);
                return;
              }
              !this.#info.fragmented && this.#info.fin && websocketMessageReceived(this.ws, this.#info.binaryType, this.consumeFragments()), this.#state = parserStates.INFO;
            }
          }
      }
      /**
       * Take n bytes from the buffered Buffers
       * @param {number} n
       * @returns {Buffer}
       */
      consume(n) {
        if (n > this.#byteOffset)
          throw new Error("Called consume() before buffers satiated.");
        if (n === 0)
          return emptyBuffer;
        if (this.#buffers[0].length === n)
          return this.#byteOffset -= this.#buffers[0].length, this.#buffers.shift();
        let buffer = Buffer.allocUnsafe(n), offset = 0;
        for (; offset !== n; ) {
          let next = this.#buffers[0], { length } = next;
          if (length + offset === n) {
            buffer.set(this.#buffers.shift(), offset);
            break;
          } else if (length + offset > n) {
            buffer.set(next.subarray(0, n - offset), offset), this.#buffers[0] = next.subarray(n - offset);
            break;
          } else
            buffer.set(this.#buffers.shift(), offset), offset += next.length;
        }
        return this.#byteOffset -= n, buffer;
      }
      writeFragments(fragment) {
        this.#fragmentsBytes += fragment.length, this.#fragments.push(fragment);
      }
      consumeFragments() {
        let fragments = this.#fragments;
        if (fragments.length === 1)
          return this.#fragmentsBytes = 0, fragments.shift();
        let output = Buffer.concat(fragments, this.#fragmentsBytes);
        return this.#fragments = [], this.#fragmentsBytes = 0, output;
      }
      parseCloseBody(data) {
        assert(data.length !== 1);
        let code;
        if (data.length >= 2 && (code = data.readUInt16BE(0)), code !== void 0 && !isValidStatusCode(code))
          return { code: 1002, reason: "Invalid status code", error: !0 };
        let reason = data.subarray(2);
        reason[0] === 239 && reason[1] === 187 && reason[2] === 191 && (reason = reason.subarray(3));
        try {
          reason = utf8Decode(reason);
        } catch {
          return { code: 1007, reason: "Invalid UTF-8", error: !0 };
        }
        return { code, reason, error: !1 };
      }
      /**
       * Parses control frames.
       * @param {Buffer} body
       */
      parseControlFrame(body) {
        let { opcode, payloadLength } = this.#info;
        if (opcode === opcodes.CLOSE) {
          if (payloadLength === 1)
            return failWebsocketConnection(this.ws, "Received close frame with a 1-byte body."), !1;
          if (this.#info.closeInfo = this.parseCloseBody(body), this.#info.closeInfo.error) {
            let { code, reason } = this.#info.closeInfo;
            return closeWebSocketConnection(this.ws, code, reason, reason.length), failWebsocketConnection(this.ws, reason), !1;
          }
          if (this.ws[kSentClose] !== sentCloseFrameState.SENT) {
            let body2 = emptyBuffer;
            this.#info.closeInfo.code && (body2 = Buffer.allocUnsafe(2), body2.writeUInt16BE(this.#info.closeInfo.code, 0));
            let closeFrame = new WebsocketFrameSend(body2);
            this.ws[kResponse].socket.write(
              closeFrame.createFrame(opcodes.CLOSE),
              (err) => {
                err || (this.ws[kSentClose] = sentCloseFrameState.SENT);
              }
            );
          }
          return this.ws[kReadyState] = states.CLOSING, this.ws[kReceivedClose] = !0, !1;
        } else if (opcode === opcodes.PING) {
          if (!this.ws[kReceivedClose]) {
            let frame = new WebsocketFrameSend(body);
            this.ws[kResponse].socket.write(frame.createFrame(opcodes.PONG)), channels.ping.hasSubscribers && channels.ping.publish({
              payload: body
            });
          }
        } else opcode === opcodes.PONG && channels.pong.hasSubscribers && channels.pong.publish({
          payload: body
        });
        return !0;
      }
      get closingInfo() {
        return this.#info.closeInfo;
      }
    };
    module.exports = {
      ByteParser
    };
  }
});

// node_modules/undici/lib/web/websocket/sender.js
var require_sender = __commonJS({
  "node_modules/undici/lib/web/websocket/sender.js"(exports, module) {
    "use strict";
    var { WebsocketFrameSend } = require_frame(), { opcodes, sendHints } = require_constants5(), FixedQueue = require_fixed_queue(), FastBuffer = Buffer[Symbol.species], SendQueue = class {
      /**
       * @type {FixedQueue}
       */
      #queue = new FixedQueue();
      /**
       * @type {boolean}
       */
      #running = !1;
      /** @type {import('node:net').Socket} */
      #socket;
      constructor(socket) {
        this.#socket = socket;
      }
      add(item, cb, hint) {
        if (hint !== sendHints.blob) {
          let frame = createFrame(item, hint);
          if (!this.#running)
            this.#socket.write(frame, cb);
          else {
            let node2 = {
              promise: null,
              callback: cb,
              frame
            };
            this.#queue.push(node2);
          }
          return;
        }
        let node = {
          promise: item.arrayBuffer().then((ab) => {
            node.promise = null, node.frame = createFrame(ab, hint);
          }),
          callback: cb,
          frame: null
        };
        this.#queue.push(node), this.#running || this.#run();
      }
      async #run() {
        this.#running = !0;
        let queue = this.#queue;
        for (; !queue.isEmpty(); ) {
          let node = queue.shift();
          node.promise !== null && await node.promise, this.#socket.write(node.frame, node.callback), node.callback = node.frame = null;
        }
        this.#running = !1;
      }
    };
    function createFrame(data, hint) {
      return new WebsocketFrameSend(toBuffer(data, hint)).createFrame(hint === sendHints.string ? opcodes.TEXT : opcodes.BINARY);
    }
    function toBuffer(data, hint) {
      switch (hint) {
        case sendHints.string:
          return Buffer.from(data);
        case sendHints.arrayBuffer:
        case sendHints.blob:
          return new FastBuffer(data);
        case sendHints.typedArray:
          return new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      }
    }
    module.exports = { SendQueue };
  }
});

// node_modules/undici/lib/web/websocket/websocket.js
var require_websocket = __commonJS({
  "node_modules/undici/lib/web/websocket/websocket.js"(exports, module) {
    "use strict";
    var { webidl } = require_webidl(), { URLSerializer } = require_data_url(), { environmentSettingsObject } = require_util2(), { staticPropertyDescriptors, states, sentCloseFrameState, sendHints } = require_constants5(), {
      kWebSocketURL,
      kReadyState,
      kController,
      kBinaryType,
      kResponse,
      kSentClose,
      kByteParser
    } = require_symbols5(), {
      isConnecting,
      isEstablished,
      isClosing,
      isValidSubprotocol,
      fireEvent
    } = require_util7(), { establishWebSocketConnection, closeWebSocketConnection } = require_connection(), { ByteParser } = require_receiver(), { kEnumerableProperty, isBlobLike } = require_util(), { getGlobalDispatcher } = require_global2(), { types } = __require("node:util"), { ErrorEvent, CloseEvent } = require_events(), { SendQueue } = require_sender(), WebSocket = class _WebSocket extends EventTarget {
      #events = {
        open: null,
        error: null,
        close: null,
        message: null
      };
      #bufferedAmount = 0;
      #protocol = "";
      #extensions = "";
      /** @type {SendQueue} */
      #sendQueue;
      /**
       * @param {string} url
       * @param {string|string[]} protocols
       */
      constructor(url, protocols = []) {
        super(), webidl.util.markAsUncloneable(this);
        let prefix = "WebSocket constructor";
        webidl.argumentLengthCheck(arguments, 1, prefix);
        let options = webidl.converters["DOMString or sequence<DOMString> or WebSocketInit"](protocols, prefix, "options");
        url = webidl.converters.USVString(url, prefix, "url"), protocols = options.protocols;
        let baseURL = environmentSettingsObject.settingsObject.baseUrl, urlRecord;
        try {
          urlRecord = new URL(url, baseURL);
        } catch (e) {
          throw new DOMException(e, "SyntaxError");
        }
        if (urlRecord.protocol === "http:" ? urlRecord.protocol = "ws:" : urlRecord.protocol === "https:" && (urlRecord.protocol = "wss:"), urlRecord.protocol !== "ws:" && urlRecord.protocol !== "wss:")
          throw new DOMException(
            `Expected a ws: or wss: protocol, got ${urlRecord.protocol}`,
            "SyntaxError"
          );
        if (urlRecord.hash || urlRecord.href.endsWith("#"))
          throw new DOMException("Got fragment", "SyntaxError");
        if (typeof protocols == "string" && (protocols = [protocols]), protocols.length !== new Set(protocols.map((p) => p.toLowerCase())).size)
          throw new DOMException("Invalid Sec-WebSocket-Protocol value", "SyntaxError");
        if (protocols.length > 0 && !protocols.every((p) => isValidSubprotocol(p)))
          throw new DOMException("Invalid Sec-WebSocket-Protocol value", "SyntaxError");
        this[kWebSocketURL] = new URL(urlRecord.href);
        let client = environmentSettingsObject.settingsObject;
        this[kController] = establishWebSocketConnection(
          urlRecord,
          protocols,
          client,
          this,
          (response, extensions) => this.#onConnectionEstablished(response, extensions),
          options
        ), this[kReadyState] = _WebSocket.CONNECTING, this[kSentClose] = sentCloseFrameState.NOT_SENT, this[kBinaryType] = "blob";
      }
      /**
       * @see https://websockets.spec.whatwg.org/#dom-websocket-close
       * @param {number|undefined} code
       * @param {string|undefined} reason
       */
      close(code = void 0, reason = void 0) {
        webidl.brandCheck(this, _WebSocket);
        let prefix = "WebSocket.close";
        if (code !== void 0 && (code = webidl.converters["unsigned short"](code, prefix, "code", { clamp: !0 })), reason !== void 0 && (reason = webidl.converters.USVString(reason, prefix, "reason")), code !== void 0 && code !== 1e3 && (code < 3e3 || code > 4999))
          throw new DOMException("invalid code", "InvalidAccessError");
        let reasonByteLength = 0;
        if (reason !== void 0 && (reasonByteLength = Buffer.byteLength(reason), reasonByteLength > 123))
          throw new DOMException(
            `Reason must be less than 123 bytes; received ${reasonByteLength}`,
            "SyntaxError"
          );
        closeWebSocketConnection(this, code, reason, reasonByteLength);
      }
      /**
       * @see https://websockets.spec.whatwg.org/#dom-websocket-send
       * @param {NodeJS.TypedArray|ArrayBuffer|Blob|string} data
       */
      send(data) {
        webidl.brandCheck(this, _WebSocket);
        let prefix = "WebSocket.send";
        if (webidl.argumentLengthCheck(arguments, 1, prefix), data = webidl.converters.WebSocketSendData(data, prefix, "data"), isConnecting(this))
          throw new DOMException("Sent before connected.", "InvalidStateError");
        if (!(!isEstablished(this) || isClosing(this)))
          if (typeof data == "string") {
            let length = Buffer.byteLength(data);
            this.#bufferedAmount += length, this.#sendQueue.add(data, () => {
              this.#bufferedAmount -= length;
            }, sendHints.string);
          } else types.isArrayBuffer(data) ? (this.#bufferedAmount += data.byteLength, this.#sendQueue.add(data, () => {
            this.#bufferedAmount -= data.byteLength;
          }, sendHints.arrayBuffer)) : ArrayBuffer.isView(data) ? (this.#bufferedAmount += data.byteLength, this.#sendQueue.add(data, () => {
            this.#bufferedAmount -= data.byteLength;
          }, sendHints.typedArray)) : isBlobLike(data) && (this.#bufferedAmount += data.size, this.#sendQueue.add(data, () => {
            this.#bufferedAmount -= data.size;
          }, sendHints.blob));
      }
      get readyState() {
        return webidl.brandCheck(this, _WebSocket), this[kReadyState];
      }
      get bufferedAmount() {
        return webidl.brandCheck(this, _WebSocket), this.#bufferedAmount;
      }
      get url() {
        return webidl.brandCheck(this, _WebSocket), URLSerializer(this[kWebSocketURL]);
      }
      get extensions() {
        return webidl.brandCheck(this, _WebSocket), this.#extensions;
      }
      get protocol() {
        return webidl.brandCheck(this, _WebSocket), this.#protocol;
      }
      get onopen() {
        return webidl.brandCheck(this, _WebSocket), this.#events.open;
      }
      set onopen(fn) {
        webidl.brandCheck(this, _WebSocket), this.#events.open && this.removeEventListener("open", this.#events.open), typeof fn == "function" ? (this.#events.open = fn, this.addEventListener("open", fn)) : this.#events.open = null;
      }
      get onerror() {
        return webidl.brandCheck(this, _WebSocket), this.#events.error;
      }
      set onerror(fn) {
        webidl.brandCheck(this, _WebSocket), this.#events.error && this.removeEventListener("error", this.#events.error), typeof fn == "function" ? (this.#events.error = fn, this.addEventListener("error", fn)) : this.#events.error = null;
      }
      get onclose() {
        return webidl.brandCheck(this, _WebSocket), this.#events.close;
      }
      set onclose(fn) {
        webidl.brandCheck(this, _WebSocket), this.#events.close && this.removeEventListener("close", this.#events.close), typeof fn == "function" ? (this.#events.close = fn, this.addEventListener("close", fn)) : this.#events.close = null;
      }
      get onmessage() {
        return webidl.brandCheck(this, _WebSocket), this.#events.message;
      }
      set onmessage(fn) {
        webidl.brandCheck(this, _WebSocket), this.#events.message && this.removeEventListener("message", this.#events.message), typeof fn == "function" ? (this.#events.message = fn, this.addEventListener("message", fn)) : this.#events.message = null;
      }
      get binaryType() {
        return webidl.brandCheck(this, _WebSocket), this[kBinaryType];
      }
      set binaryType(type) {
        webidl.brandCheck(this, _WebSocket), type !== "blob" && type !== "arraybuffer" ? this[kBinaryType] = "blob" : this[kBinaryType] = type;
      }
      /**
       * @see https://websockets.spec.whatwg.org/#feedback-from-the-protocol
       */
      #onConnectionEstablished(response, parsedExtensions) {
        this[kResponse] = response;
        let maxPayloadSize = this[kController]?.dispatcher?.webSocketOptions?.maxPayloadSize, parser = new ByteParser(this, parsedExtensions, {
          maxPayloadSize
        });
        parser.on("drain", onParserDrain), parser.on("error", onParserError.bind(this)), response.socket.ws = this, this[kByteParser] = parser, this.#sendQueue = new SendQueue(response.socket), this[kReadyState] = states.OPEN;
        let extensions = response.headersList.get("sec-websocket-extensions");
        extensions !== null && (this.#extensions = extensions);
        let protocol = response.headersList.get("sec-websocket-protocol");
        protocol !== null && (this.#protocol = protocol), fireEvent("open", this);
      }
    };
    WebSocket.CONNECTING = WebSocket.prototype.CONNECTING = states.CONNECTING;
    WebSocket.OPEN = WebSocket.prototype.OPEN = states.OPEN;
    WebSocket.CLOSING = WebSocket.prototype.CLOSING = states.CLOSING;
    WebSocket.CLOSED = WebSocket.prototype.CLOSED = states.CLOSED;
    Object.defineProperties(WebSocket.prototype, {
      CONNECTING: staticPropertyDescriptors,
      OPEN: staticPropertyDescriptors,
      CLOSING: staticPropertyDescriptors,
      CLOSED: staticPropertyDescriptors,
      url: kEnumerableProperty,
      readyState: kEnumerableProperty,
      bufferedAmount: kEnumerableProperty,
      onopen: kEnumerableProperty,
      onerror: kEnumerableProperty,
      onclose: kEnumerableProperty,
      close: kEnumerableProperty,
      onmessage: kEnumerableProperty,
      binaryType: kEnumerableProperty,
      send: kEnumerableProperty,
      extensions: kEnumerableProperty,
      protocol: kEnumerableProperty,
      [Symbol.toStringTag]: {
        value: "WebSocket",
        writable: !1,
        enumerable: !1,
        configurable: !0
      }
    });
    Object.defineProperties(WebSocket, {
      CONNECTING: staticPropertyDescriptors,
      OPEN: staticPropertyDescriptors,
      CLOSING: staticPropertyDescriptors,
      CLOSED: staticPropertyDescriptors
    });
    webidl.converters["sequence<DOMString>"] = webidl.sequenceConverter(
      webidl.converters.DOMString
    );
    webidl.converters["DOMString or sequence<DOMString>"] = function(V, prefix, argument) {
      return webidl.util.Type(V) === "Object" && Symbol.iterator in V ? webidl.converters["sequence<DOMString>"](V) : webidl.converters.DOMString(V, prefix, argument);
    };
    webidl.converters.WebSocketInit = webidl.dictionaryConverter([
      {
        key: "protocols",
        converter: webidl.converters["DOMString or sequence<DOMString>"],
        defaultValue: () => new Array(0)
      },
      {
        key: "dispatcher",
        converter: webidl.converters.any,
        defaultValue: () => getGlobalDispatcher()
      },
      {
        key: "headers",
        converter: webidl.nullableConverter(webidl.converters.HeadersInit)
      }
    ]);
    webidl.converters["DOMString or sequence<DOMString> or WebSocketInit"] = function(V) {
      return webidl.util.Type(V) === "Object" && !(Symbol.iterator in V) ? webidl.converters.WebSocketInit(V) : { protocols: webidl.converters["DOMString or sequence<DOMString>"](V) };
    };
    webidl.converters.WebSocketSendData = function(V) {
      if (webidl.util.Type(V) === "Object") {
        if (isBlobLike(V))
          return webidl.converters.Blob(V, { strict: !1 });
        if (ArrayBuffer.isView(V) || types.isArrayBuffer(V))
          return webidl.converters.BufferSource(V);
      }
      return webidl.converters.USVString(V);
    };
    function onParserDrain() {
      this.ws[kResponse].socket.resume();
    }
    function onParserError(err) {
      let message, code;
      err instanceof CloseEvent ? (message = err.reason, code = err.code) : message = err.message, fireEvent("error", this, () => new ErrorEvent("error", { error: err, message })), closeWebSocketConnection(this, code);
    }
    module.exports = {
      WebSocket
    };
  }
});

// node_modules/undici/lib/web/eventsource/util.js
var require_util8 = __commonJS({
  "node_modules/undici/lib/web/eventsource/util.js"(exports, module) {
    "use strict";
    function isValidLastEventId(value) {
      return value.indexOf("\0") === -1;
    }
    function isASCIINumber(value) {
      if (value.length === 0) return !1;
      for (let i = 0; i < value.length; i++)
        if (value.charCodeAt(i) < 48 || value.charCodeAt(i) > 57) return !1;
      return !0;
    }
    function delay(ms) {
      return new Promise((resolve2) => {
        setTimeout(resolve2, ms).unref();
      });
    }
    module.exports = {
      isValidLastEventId,
      isASCIINumber,
      delay
    };
  }
});

// node_modules/undici/lib/web/eventsource/eventsource-stream.js
var require_eventsource_stream = __commonJS({
  "node_modules/undici/lib/web/eventsource/eventsource-stream.js"(exports, module) {
    "use strict";
    var { Transform } = __require("node:stream"), { isASCIINumber, isValidLastEventId } = require_util8(), BOM = [239, 187, 191], LF = 10, CR = 13, COLON = 58, SPACE = 32, EventSourceStream = class extends Transform {
      /**
       * @type {eventSourceSettings}
       */
      state = null;
      /**
       * Leading byte-order-mark check.
       * @type {boolean}
       */
      checkBOM = !0;
      /**
       * @type {boolean}
       */
      crlfCheck = !1;
      /**
       * @type {boolean}
       */
      eventEndCheck = !1;
      /**
       * @type {Buffer}
       */
      buffer = null;
      pos = 0;
      event = {
        data: void 0,
        event: void 0,
        id: void 0,
        retry: void 0
      };
      /**
       * @param {object} options
       * @param {eventSourceSettings} options.eventSourceSettings
       * @param {Function} [options.push]
       */
      constructor(options = {}) {
        options.readableObjectMode = !0, super(options), this.state = options.eventSourceSettings || {}, options.push && (this.push = options.push);
      }
      /**
       * @param {Buffer} chunk
       * @param {string} _encoding
       * @param {Function} callback
       * @returns {void}
       */
      _transform(chunk, _encoding, callback) {
        if (chunk.length === 0) {
          callback();
          return;
        }
        if (this.buffer ? this.buffer = Buffer.concat([this.buffer, chunk]) : this.buffer = chunk, this.checkBOM)
          switch (this.buffer.length) {
            case 1:
              if (this.buffer[0] === BOM[0]) {
                callback();
                return;
              }
              this.checkBOM = !1, callback();
              return;
            case 2:
              if (this.buffer[0] === BOM[0] && this.buffer[1] === BOM[1]) {
                callback();
                return;
              }
              this.checkBOM = !1;
              break;
            case 3:
              if (this.buffer[0] === BOM[0] && this.buffer[1] === BOM[1] && this.buffer[2] === BOM[2]) {
                this.buffer = Buffer.alloc(0), this.checkBOM = !1, callback();
                return;
              }
              this.checkBOM = !1;
              break;
            default:
              this.buffer[0] === BOM[0] && this.buffer[1] === BOM[1] && this.buffer[2] === BOM[2] && (this.buffer = this.buffer.subarray(3)), this.checkBOM = !1;
              break;
          }
        for (; this.pos < this.buffer.length; ) {
          if (this.eventEndCheck) {
            if (this.crlfCheck) {
              if (this.buffer[this.pos] === LF) {
                this.buffer = this.buffer.subarray(this.pos + 1), this.pos = 0, this.crlfCheck = !1;
                continue;
              }
              this.crlfCheck = !1;
            }
            if (this.buffer[this.pos] === LF || this.buffer[this.pos] === CR) {
              this.buffer[this.pos] === CR && (this.crlfCheck = !0), this.buffer = this.buffer.subarray(this.pos + 1), this.pos = 0, (this.event.data !== void 0 || this.event.event || this.event.id || this.event.retry) && this.processEvent(this.event), this.clearEvent();
              continue;
            }
            this.eventEndCheck = !1;
            continue;
          }
          if (this.buffer[this.pos] === LF || this.buffer[this.pos] === CR) {
            this.buffer[this.pos] === CR && (this.crlfCheck = !0), this.parseLine(this.buffer.subarray(0, this.pos), this.event), this.buffer = this.buffer.subarray(this.pos + 1), this.pos = 0, this.eventEndCheck = !0;
            continue;
          }
          this.pos++;
        }
        callback();
      }
      /**
       * @param {Buffer} line
       * @param {EventStreamEvent} event
       */
      parseLine(line, event) {
        if (line.length === 0)
          return;
        let colonPosition = line.indexOf(COLON);
        if (colonPosition === 0)
          return;
        let field = "", value = "";
        if (colonPosition !== -1) {
          field = line.subarray(0, colonPosition).toString("utf8");
          let valueStart = colonPosition + 1;
          line[valueStart] === SPACE && ++valueStart, value = line.subarray(valueStart).toString("utf8");
        } else
          field = line.toString("utf8"), value = "";
        switch (field) {
          case "data":
            event[field] === void 0 ? event[field] = value : event[field] += `
${value}`;
            break;
          case "retry":
            isASCIINumber(value) && (event[field] = value);
            break;
          case "id":
            isValidLastEventId(value) && (event[field] = value);
            break;
          case "event":
            value.length > 0 && (event[field] = value);
            break;
        }
      }
      /**
       * @param {EventSourceStreamEvent} event
       */
      processEvent(event) {
        event.retry && isASCIINumber(event.retry) && (this.state.reconnectionTime = parseInt(event.retry, 10)), event.id && isValidLastEventId(event.id) && (this.state.lastEventId = event.id), event.data !== void 0 && this.push({
          type: event.event || "message",
          options: {
            data: event.data,
            lastEventId: this.state.lastEventId,
            origin: this.state.origin
          }
        });
      }
      clearEvent() {
        this.event = {
          data: void 0,
          event: void 0,
          id: void 0,
          retry: void 0
        };
      }
    };
    module.exports = {
      EventSourceStream
    };
  }
});

// node_modules/undici/lib/web/eventsource/eventsource.js
var require_eventsource = __commonJS({
  "node_modules/undici/lib/web/eventsource/eventsource.js"(exports, module) {
    "use strict";
    var { pipeline: pipeline3 } = __require("node:stream"), { fetching } = require_fetch(), { makeRequest } = require_request2(), { webidl } = require_webidl(), { EventSourceStream } = require_eventsource_stream(), { parseMIMEType } = require_data_url(), { createFastMessageEvent } = require_events(), { isNetworkError } = require_response(), { delay } = require_util8(), { kEnumerableProperty } = require_util(), { environmentSettingsObject } = require_util2(), experimentalWarned = !1, defaultReconnectionTime = 3e3, CONNECTING = 0, OPEN = 1, CLOSED = 2, ANONYMOUS = "anonymous", USE_CREDENTIALS = "use-credentials", EventSource = class _EventSource extends EventTarget {
      #events = {
        open: null,
        error: null,
        message: null
      };
      #url = null;
      #withCredentials = !1;
      #readyState = CONNECTING;
      #request = null;
      #controller = null;
      #dispatcher;
      /**
       * @type {import('./eventsource-stream').eventSourceSettings}
       */
      #state;
      /**
       * Creates a new EventSource object.
       * @param {string} url
       * @param {EventSourceInit} [eventSourceInitDict]
       * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface
       */
      constructor(url, eventSourceInitDict = {}) {
        super(), webidl.util.markAsUncloneable(this);
        let prefix = "EventSource constructor";
        webidl.argumentLengthCheck(arguments, 1, prefix), experimentalWarned || (experimentalWarned = !0, process.emitWarning("EventSource is experimental, expect them to change at any time.", {
          code: "UNDICI-ES"
        })), url = webidl.converters.USVString(url, prefix, "url"), eventSourceInitDict = webidl.converters.EventSourceInitDict(eventSourceInitDict, prefix, "eventSourceInitDict"), this.#dispatcher = eventSourceInitDict.dispatcher, this.#state = {
          lastEventId: "",
          reconnectionTime: defaultReconnectionTime
        };
        let settings = environmentSettingsObject, urlRecord;
        try {
          urlRecord = new URL(url, settings.settingsObject.baseUrl), this.#state.origin = urlRecord.origin;
        } catch (e) {
          throw new DOMException(e, "SyntaxError");
        }
        this.#url = urlRecord.href;
        let corsAttributeState = ANONYMOUS;
        eventSourceInitDict.withCredentials && (corsAttributeState = USE_CREDENTIALS, this.#withCredentials = !0);
        let initRequest = {
          redirect: "follow",
          keepalive: !0,
          // @see https://html.spec.whatwg.org/multipage/urls-and-fetching.html#cors-settings-attributes
          mode: "cors",
          credentials: corsAttributeState === "anonymous" ? "same-origin" : "omit",
          referrer: "no-referrer"
        };
        initRequest.client = environmentSettingsObject.settingsObject, initRequest.headersList = [["accept", { name: "accept", value: "text/event-stream" }]], initRequest.cache = "no-store", initRequest.initiator = "other", initRequest.urlList = [new URL(this.#url)], this.#request = makeRequest(initRequest), this.#connect();
      }
      /**
       * Returns the state of this EventSource object's connection. It can have the
       * values described below.
       * @returns {0|1|2}
       * @readonly
       */
      get readyState() {
        return this.#readyState;
      }
      /**
       * Returns the URL providing the event stream.
       * @readonly
       * @returns {string}
       */
      get url() {
        return this.#url;
      }
      /**
       * Returns a boolean indicating whether the EventSource object was
       * instantiated with CORS credentials set (true), or not (false, the default).
       */
      get withCredentials() {
        return this.#withCredentials;
      }
      #connect() {
        if (this.#readyState === CLOSED) return;
        this.#readyState = CONNECTING;
        let fetchParams = {
          request: this.#request,
          dispatcher: this.#dispatcher
        }, processEventSourceEndOfBody = (response) => {
          isNetworkError(response) && (this.dispatchEvent(new Event("error")), this.close()), this.#reconnect();
        };
        fetchParams.processResponseEndOfBody = processEventSourceEndOfBody, fetchParams.processResponse = (response) => {
          if (isNetworkError(response))
            if (response.aborted) {
              this.close(), this.dispatchEvent(new Event("error"));
              return;
            } else {
              this.#reconnect();
              return;
            }
          let contentType = response.headersList.get("content-type", !0), mimeType = contentType !== null ? parseMIMEType(contentType) : "failure", contentTypeValid = mimeType !== "failure" && mimeType.essence === "text/event-stream";
          if (response.status !== 200 || contentTypeValid === !1) {
            this.close(), this.dispatchEvent(new Event("error"));
            return;
          }
          this.#readyState = OPEN, this.dispatchEvent(new Event("open")), this.#state.origin = response.urlList[response.urlList.length - 1].origin;
          let eventSourceStream = new EventSourceStream({
            eventSourceSettings: this.#state,
            push: (event) => {
              this.dispatchEvent(createFastMessageEvent(
                event.type,
                event.options
              ));
            }
          });
          pipeline3(
            response.body.stream,
            eventSourceStream,
            (error2) => {
              error2?.aborted === !1 && (this.close(), this.dispatchEvent(new Event("error")));
            }
          );
        }, this.#controller = fetching(fetchParams);
      }
      /**
       * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#sse-processing-model
       * @returns {Promise<void>}
       */
      async #reconnect() {
        this.#readyState !== CLOSED && (this.#readyState = CONNECTING, this.dispatchEvent(new Event("error")), await delay(this.#state.reconnectionTime), this.#readyState === CONNECTING && (this.#state.lastEventId.length && this.#request.headersList.set("last-event-id", this.#state.lastEventId, !0), this.#connect()));
      }
      /**
       * Closes the connection, if any, and sets the readyState attribute to
       * CLOSED.
       */
      close() {
        webidl.brandCheck(this, _EventSource), this.#readyState !== CLOSED && (this.#readyState = CLOSED, this.#controller.abort(), this.#request = null);
      }
      get onopen() {
        return this.#events.open;
      }
      set onopen(fn) {
        this.#events.open && this.removeEventListener("open", this.#events.open), typeof fn == "function" ? (this.#events.open = fn, this.addEventListener("open", fn)) : this.#events.open = null;
      }
      get onmessage() {
        return this.#events.message;
      }
      set onmessage(fn) {
        this.#events.message && this.removeEventListener("message", this.#events.message), typeof fn == "function" ? (this.#events.message = fn, this.addEventListener("message", fn)) : this.#events.message = null;
      }
      get onerror() {
        return this.#events.error;
      }
      set onerror(fn) {
        this.#events.error && this.removeEventListener("error", this.#events.error), typeof fn == "function" ? (this.#events.error = fn, this.addEventListener("error", fn)) : this.#events.error = null;
      }
    }, constantsPropertyDescriptors = {
      CONNECTING: {
        __proto__: null,
        configurable: !1,
        enumerable: !0,
        value: CONNECTING,
        writable: !1
      },
      OPEN: {
        __proto__: null,
        configurable: !1,
        enumerable: !0,
        value: OPEN,
        writable: !1
      },
      CLOSED: {
        __proto__: null,
        configurable: !1,
        enumerable: !0,
        value: CLOSED,
        writable: !1
      }
    };
    Object.defineProperties(EventSource, constantsPropertyDescriptors);
    Object.defineProperties(EventSource.prototype, constantsPropertyDescriptors);
    Object.defineProperties(EventSource.prototype, {
      close: kEnumerableProperty,
      onerror: kEnumerableProperty,
      onmessage: kEnumerableProperty,
      onopen: kEnumerableProperty,
      readyState: kEnumerableProperty,
      url: kEnumerableProperty,
      withCredentials: kEnumerableProperty
    });
    webidl.converters.EventSourceInitDict = webidl.dictionaryConverter([
      {
        key: "withCredentials",
        converter: webidl.converters.boolean,
        defaultValue: () => !1
      },
      {
        key: "dispatcher",
        // undici only
        converter: webidl.converters.any
      }
    ]);
    module.exports = {
      EventSource,
      defaultReconnectionTime
    };
  }
});

// node_modules/undici/index.js
var require_undici = __commonJS({
  "node_modules/undici/index.js"(exports, module) {
    "use strict";
    var Client = require_client(), Dispatcher = require_dispatcher(), Pool = require_pool(), BalancedPool = require_balanced_pool(), Agent = require_agent(), ProxyAgent2 = require_proxy_agent(), EnvHttpProxyAgent = require_env_http_proxy_agent(), RetryAgent = require_retry_agent(), errors = require_errors(), util = require_util(), { InvalidArgumentError } = errors, api = require_api(), buildConnector = require_connect(), MockClient = require_mock_client(), MockAgent = require_mock_agent(), MockPool = require_mock_pool(), mockErrors = require_mock_errors(), RetryHandler = require_retry_handler(), { getGlobalDispatcher, setGlobalDispatcher } = require_global2(), DecoratorHandler = require_decorator_handler(), RedirectHandler = require_redirect_handler(), createRedirectInterceptor = require_redirect_interceptor();
    Object.assign(Dispatcher.prototype, api);
    module.exports.Dispatcher = Dispatcher;
    module.exports.Client = Client;
    module.exports.Pool = Pool;
    module.exports.BalancedPool = BalancedPool;
    module.exports.Agent = Agent;
    module.exports.ProxyAgent = ProxyAgent2;
    module.exports.EnvHttpProxyAgent = EnvHttpProxyAgent;
    module.exports.RetryAgent = RetryAgent;
    module.exports.RetryHandler = RetryHandler;
    module.exports.DecoratorHandler = DecoratorHandler;
    module.exports.RedirectHandler = RedirectHandler;
    module.exports.createRedirectInterceptor = createRedirectInterceptor;
    module.exports.interceptors = {
      redirect: require_redirect(),
      retry: require_retry(),
      dump: require_dump(),
      dns: require_dns()
    };
    module.exports.buildConnector = buildConnector;
    module.exports.errors = errors;
    module.exports.util = {
      parseHeaders: util.parseHeaders,
      headerNameToString: util.headerNameToString
    };
    function makeDispatcher(fn) {
      return (url, opts, handler) => {
        if (typeof opts == "function" && (handler = opts, opts = null), !url || typeof url != "string" && typeof url != "object" && !(url instanceof URL))
          throw new InvalidArgumentError("invalid url");
        if (opts != null && typeof opts != "object")
          throw new InvalidArgumentError("invalid opts");
        if (opts && opts.path != null) {
          if (typeof opts.path != "string")
            throw new InvalidArgumentError("invalid opts.path");
          let path4 = opts.path;
          opts.path.startsWith("/") || (path4 = `/${path4}`), url = new URL(util.parseOrigin(url).origin + path4);
        } else
          opts || (opts = typeof url == "object" ? url : {}), url = util.parseURL(url);
        let { agent, dispatcher = getGlobalDispatcher() } = opts;
        if (agent)
          throw new InvalidArgumentError("unsupported opts.agent. Did you mean opts.client?");
        return fn.call(dispatcher, {
          ...opts,
          origin: url.origin,
          path: url.search ? `${url.pathname}${url.search}` : url.pathname,
          method: opts.method || (opts.body ? "PUT" : "GET")
        }, handler);
      };
    }
    module.exports.setGlobalDispatcher = setGlobalDispatcher;
    module.exports.getGlobalDispatcher = getGlobalDispatcher;
    var fetchImpl = require_fetch().fetch;
    module.exports.fetch = async function(init, options = void 0) {
      try {
        return await fetchImpl(init, options);
      } catch (err) {
        throw err && typeof err == "object" && Error.captureStackTrace(err), err;
      }
    };
    module.exports.Headers = require_headers().Headers;
    module.exports.Response = require_response().Response;
    module.exports.Request = require_request2().Request;
    module.exports.FormData = require_formdata().FormData;
    module.exports.File = globalThis.File ?? __require("node:buffer").File;
    module.exports.FileReader = require_filereader().FileReader;
    var { setGlobalOrigin, getGlobalOrigin } = require_global();
    module.exports.setGlobalOrigin = setGlobalOrigin;
    module.exports.getGlobalOrigin = getGlobalOrigin;
    var { CacheStorage } = require_cachestorage(), { kConstruct } = require_symbols4();
    module.exports.caches = new CacheStorage(kConstruct);
    var { deleteCookie, getCookies, getSetCookies, setCookie } = require_cookies();
    module.exports.deleteCookie = deleteCookie;
    module.exports.getCookies = getCookies;
    module.exports.getSetCookies = getSetCookies;
    module.exports.setCookie = setCookie;
    var { parseMIMEType, serializeAMimeType } = require_data_url();
    module.exports.parseMIMEType = parseMIMEType;
    module.exports.serializeAMimeType = serializeAMimeType;
    var { CloseEvent, ErrorEvent, MessageEvent } = require_events();
    module.exports.WebSocket = require_websocket().WebSocket;
    module.exports.CloseEvent = CloseEvent;
    module.exports.ErrorEvent = ErrorEvent;
    module.exports.MessageEvent = MessageEvent;
    module.exports.request = makeDispatcher(api.request);
    module.exports.stream = makeDispatcher(api.stream);
    module.exports.pipeline = makeDispatcher(api.pipeline);
    module.exports.connect = makeDispatcher(api.connect);
    module.exports.upgrade = makeDispatcher(api.upgrade);
    module.exports.MockClient = MockClient;
    module.exports.MockPool = MockPool;
    module.exports.MockAgent = MockAgent;
    module.exports.mockErrors = mockErrors;
    var { EventSource } = require_eventsource();
    module.exports.EventSource = EventSource;
  }
});

// node_modules/buffer-crc32/dist/index.cjs
var require_dist = __commonJS({
  "node_modules/buffer-crc32/dist/index.cjs"(exports, module) {
    "use strict";
    function getDefaultExportFromCjs(x) {
      return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x.default : x;
    }
    var CRC_TABLE = new Int32Array([
      0,
      1996959894,
      3993919788,
      2567524794,
      124634137,
      1886057615,
      3915621685,
      2657392035,
      249268274,
      2044508324,
      3772115230,
      2547177864,
      162941995,
      2125561021,
      3887607047,
      2428444049,
      498536548,
      1789927666,
      4089016648,
      2227061214,
      450548861,
      1843258603,
      4107580753,
      2211677639,
      325883990,
      1684777152,
      4251122042,
      2321926636,
      335633487,
      1661365465,
      4195302755,
      2366115317,
      997073096,
      1281953886,
      3579855332,
      2724688242,
      1006888145,
      1258607687,
      3524101629,
      2768942443,
      901097722,
      1119000684,
      3686517206,
      2898065728,
      853044451,
      1172266101,
      3705015759,
      2882616665,
      651767980,
      1373503546,
      3369554304,
      3218104598,
      565507253,
      1454621731,
      3485111705,
      3099436303,
      671266974,
      1594198024,
      3322730930,
      2970347812,
      795835527,
      1483230225,
      3244367275,
      3060149565,
      1994146192,
      31158534,
      2563907772,
      4023717930,
      1907459465,
      112637215,
      2680153253,
      3904427059,
      2013776290,
      251722036,
      2517215374,
      3775830040,
      2137656763,
      141376813,
      2439277719,
      3865271297,
      1802195444,
      476864866,
      2238001368,
      4066508878,
      1812370925,
      453092731,
      2181625025,
      4111451223,
      1706088902,
      314042704,
      2344532202,
      4240017532,
      1658658271,
      366619977,
      2362670323,
      4224994405,
      1303535960,
      984961486,
      2747007092,
      3569037538,
      1256170817,
      1037604311,
      2765210733,
      3554079995,
      1131014506,
      879679996,
      2909243462,
      3663771856,
      1141124467,
      855842277,
      2852801631,
      3708648649,
      1342533948,
      654459306,
      3188396048,
      3373015174,
      1466479909,
      544179635,
      3110523913,
      3462522015,
      1591671054,
      702138776,
      2966460450,
      3352799412,
      1504918807,
      783551873,
      3082640443,
      3233442989,
      3988292384,
      2596254646,
      62317068,
      1957810842,
      3939845945,
      2647816111,
      81470997,
      1943803523,
      3814918930,
      2489596804,
      225274430,
      2053790376,
      3826175755,
      2466906013,
      167816743,
      2097651377,
      4027552580,
      2265490386,
      503444072,
      1762050814,
      4150417245,
      2154129355,
      426522225,
      1852507879,
      4275313526,
      2312317920,
      282753626,
      1742555852,
      4189708143,
      2394877945,
      397917763,
      1622183637,
      3604390888,
      2714866558,
      953729732,
      1340076626,
      3518719985,
      2797360999,
      1068828381,
      1219638859,
      3624741850,
      2936675148,
      906185462,
      1090812512,
      3747672003,
      2825379669,
      829329135,
      1181335161,
      3412177804,
      3160834842,
      628085408,
      1382605366,
      3423369109,
      3138078467,
      570562233,
      1426400815,
      3317316542,
      2998733608,
      733239954,
      1555261956,
      3268935591,
      3050360625,
      752459403,
      1541320221,
      2607071920,
      3965973030,
      1969922972,
      40735498,
      2617837225,
      3943577151,
      1913087877,
      83908371,
      2512341634,
      3803740692,
      2075208622,
      213261112,
      2463272603,
      3855990285,
      2094854071,
      198958881,
      2262029012,
      4057260610,
      1759359992,
      534414190,
      2176718541,
      4139329115,
      1873836001,
      414664567,
      2282248934,
      4279200368,
      1711684554,
      285281116,
      2405801727,
      4167216745,
      1634467795,
      376229701,
      2685067896,
      3608007406,
      1308918612,
      956543938,
      2808555105,
      3495958263,
      1231636301,
      1047427035,
      2932959818,
      3654703836,
      1088359270,
      936918e3,
      2847714899,
      3736837829,
      1202900863,
      817233897,
      3183342108,
      3401237130,
      1404277552,
      615818150,
      3134207493,
      3453421203,
      1423857449,
      601450431,
      3009837614,
      3294710456,
      1567103746,
      711928724,
      3020668471,
      3272380065,
      1510334235,
      755167117
    ]);
    function ensureBuffer(input) {
      if (Buffer.isBuffer(input))
        return input;
      if (typeof input == "number")
        return Buffer.alloc(input);
      if (typeof input == "string")
        return Buffer.from(input);
      throw new Error("input must be buffer, number, or string, received " + typeof input);
    }
    function bufferizeInt(num) {
      let tmp = ensureBuffer(4);
      return tmp.writeInt32BE(num, 0), tmp;
    }
    function _crc32(buf, previous) {
      buf = ensureBuffer(buf), Buffer.isBuffer(previous) && (previous = previous.readUInt32BE(0));
      let crc = ~~previous ^ -1;
      for (var n = 0; n < buf.length; n++)
        crc = CRC_TABLE[(crc ^ buf[n]) & 255] ^ crc >>> 8;
      return crc ^ -1;
    }
    function crc32() {
      return bufferizeInt(_crc32.apply(null, arguments));
    }
    crc32.signed = function() {
      return _crc32.apply(null, arguments);
    };
    crc32.unsigned = function() {
      return _crc32.apply(null, arguments) >>> 0;
    };
    var bufferCrc32 = crc32, index = /* @__PURE__ */ getDefaultExportFromCjs(bufferCrc32);
    module.exports = index;
  }
});

// node_modules/yazl/index.js
var require_yazl = __commonJS({
  "node_modules/yazl/index.js"(exports) {
    var fs3 = __require("fs"), Transform = __require("stream").Transform, PassThrough = __require("stream").PassThrough, zlib = __require("zlib"), util = __require("util"), EventEmitter2 = __require("events").EventEmitter, errorMonitor = __require("events").errorMonitor, crc32 = require_dist();
    exports.ZipFile = ZipFile;
    exports.dateToDosDateTime = dateToDosDateTime;
    util.inherits(ZipFile, EventEmitter2);
    function ZipFile() {
      this.outputStream = new PassThrough(), this.entries = [], this.outputStreamCursor = 0, this.ended = !1, this.allDone = !1, this.forceZip64Eocd = !1, this.errored = !1, this.on(errorMonitor, function() {
        this.errored = !0;
      });
    }
    ZipFile.prototype.addFile = function(realPath, metadataPath, options) {
      var self = this;
      if (metadataPath = validateMetadataPath(metadataPath, !1), options == null && (options = {}), !shouldIgnoreAdding(self)) {
        var entry = new Entry(metadataPath, !1, options);
        self.entries.push(entry), fs3.stat(realPath, function(err, stats) {
          if (err) return self.emit("error", err);
          if (!stats.isFile()) return self.emit("error", new Error("not a file: " + realPath));
          entry.uncompressedSize = stats.size, options.mtime == null && entry.setLastModDate(stats.mtime), options.mode == null && entry.setFileAttributesMode(stats.mode), entry.setFileDataPumpFunction(function() {
            var readStream = fs3.createReadStream(realPath);
            entry.state = Entry.FILE_DATA_IN_PROGRESS, readStream.on("error", function(err2) {
              self.emit("error", err2);
            }), pumpFileDataReadStream(self, entry, readStream);
          }), pumpEntries(self);
        });
      }
    };
    ZipFile.prototype.addReadStream = function(readStream, metadataPath, options) {
      this.addReadStreamLazy(metadataPath, options, function(cb) {
        cb(null, readStream);
      });
    };
    ZipFile.prototype.addReadStreamLazy = function(metadataPath, options, getReadStreamFunction) {
      var self = this;
      if (typeof options == "function" && (getReadStreamFunction = options, options = null), options == null && (options = {}), metadataPath = validateMetadataPath(metadataPath, !1), !shouldIgnoreAdding(self)) {
        var entry = new Entry(metadataPath, !1, options);
        self.entries.push(entry), entry.setFileDataPumpFunction(function() {
          entry.state = Entry.FILE_DATA_IN_PROGRESS, getReadStreamFunction(function(err, readStream) {
            if (err) return self.emit("error", err);
            pumpFileDataReadStream(self, entry, readStream);
          });
        }), pumpEntries(self);
      }
    };
    ZipFile.prototype.addBuffer = function(buffer, metadataPath, options) {
      var self = this;
      if (metadataPath = validateMetadataPath(metadataPath, !1), buffer.length > 1073741823) throw new Error("buffer too large: " + buffer.length + " > 1073741823");
      if (options == null && (options = {}), options.size != null) throw new Error("options.size not allowed");
      if (shouldIgnoreAdding(self)) return;
      var entry = new Entry(metadataPath, !1, options);
      entry.uncompressedSize = buffer.length, entry.crc32 = crc32.unsigned(buffer), entry.crcAndFileSizeKnown = !0, self.entries.push(entry), entry.compressionLevel === 0 ? setCompressedBuffer(buffer) : zlib.deflateRaw(buffer, { level: entry.compressionLevel }, function(err, compressedBuffer) {
        setCompressedBuffer(compressedBuffer);
      });
      function setCompressedBuffer(compressedBuffer) {
        entry.compressedSize = compressedBuffer.length, entry.setFileDataPumpFunction(function() {
          writeToOutputStream(self, compressedBuffer), writeToOutputStream(self, entry.getDataDescriptor()), entry.state = Entry.FILE_DATA_DONE, setImmediate(function() {
            pumpEntries(self);
          });
        }), pumpEntries(self);
      }
    };
    ZipFile.prototype.addEmptyDirectory = function(metadataPath, options) {
      var self = this;
      if (metadataPath = validateMetadataPath(metadataPath, !0), options == null && (options = {}), options.size != null) throw new Error("options.size not allowed");
      if (options.compress != null) throw new Error("options.compress not allowed");
      if (options.compressionLevel != null) throw new Error("options.compressionLevel not allowed");
      if (!shouldIgnoreAdding(self)) {
        var entry = new Entry(metadataPath, !0, options);
        self.entries.push(entry), entry.setFileDataPumpFunction(function() {
          writeToOutputStream(self, entry.getDataDescriptor()), entry.state = Entry.FILE_DATA_DONE, pumpEntries(self);
        }), pumpEntries(self);
      }
    };
    var eocdrSignatureBuffer = bufferFrom([80, 75, 5, 6]);
    ZipFile.prototype.end = function(options, calculatedTotalSizeCallback) {
      if (typeof options == "function" && (calculatedTotalSizeCallback = options, options = null), options == null && (options = {}), !this.ended && (this.ended = !0, !this.errored)) {
        if (this.calculatedTotalSizeCallback = calculatedTotalSizeCallback, this.forceZip64Eocd = !!options.forceZip64Format, options.comment) {
          if (typeof options.comment == "string" ? this.comment = encodeCp437(options.comment) : this.comment = options.comment, this.comment.length > 65535) throw new Error("comment is too large");
          if (bufferIncludes(this.comment, eocdrSignatureBuffer)) throw new Error("comment contains end of central directory record signature");
        } else
          this.comment = EMPTY_BUFFER;
        pumpEntries(this);
      }
    };
    function writeToOutputStream(self, buffer) {
      self.outputStream.write(buffer), self.outputStreamCursor += buffer.length;
    }
    function pumpFileDataReadStream(self, entry, readStream) {
      var crc32Watcher = new Crc32Watcher(), uncompressedSizeCounter = new ByteCounter(), compressor = entry.compressionLevel !== 0 ? new zlib.DeflateRaw({ level: entry.compressionLevel }) : new PassThrough(), compressedSizeCounter = new ByteCounter();
      readStream.pipe(crc32Watcher).pipe(uncompressedSizeCounter).pipe(compressor).pipe(compressedSizeCounter).pipe(self.outputStream, { end: !1 }), compressedSizeCounter.on("end", function() {
        if (entry.crc32 = crc32Watcher.crc32, entry.uncompressedSize == null)
          entry.uncompressedSize = uncompressedSizeCounter.byteCount;
        else if (entry.uncompressedSize !== uncompressedSizeCounter.byteCount) return self.emit("error", new Error("file data stream has unexpected number of bytes"));
        entry.compressedSize = compressedSizeCounter.byteCount, self.outputStreamCursor += entry.compressedSize, writeToOutputStream(self, entry.getDataDescriptor()), entry.state = Entry.FILE_DATA_DONE, pumpEntries(self);
      });
    }
    function determineCompressionLevel(options) {
      if (options.compress != null && options.compressionLevel != null && !!options.compress != !!options.compressionLevel)
        throw new Error("conflicting settings for compress and compressionLevel");
      return options.compressionLevel != null ? options.compressionLevel : options.compress === !1 ? 0 : 6;
    }
    function pumpEntries(self) {
      if (self.allDone || self.errored) return;
      if (self.ended && self.calculatedTotalSizeCallback != null) {
        var calculatedTotalSize = calculateTotalSize(self);
        calculatedTotalSize != null && (self.calculatedTotalSizeCallback(calculatedTotalSize), self.calculatedTotalSizeCallback = null);
      }
      var entry = getFirstNotDoneEntry();
      function getFirstNotDoneEntry() {
        for (var i = 0; i < self.entries.length; i++) {
          var entry2 = self.entries[i];
          if (entry2.state < Entry.FILE_DATA_DONE) return entry2;
        }
        return null;
      }
      if (entry != null) {
        if (entry.state < Entry.READY_TO_PUMP_FILE_DATA || entry.state === Entry.FILE_DATA_IN_PROGRESS) return;
        entry.relativeOffsetOfLocalHeader = self.outputStreamCursor;
        var localFileHeader = entry.getLocalFileHeader();
        writeToOutputStream(self, localFileHeader), entry.doFileDataPump();
      } else
        self.ended && (self.offsetOfStartOfCentralDirectory = self.outputStreamCursor, self.entries.forEach(function(entry2) {
          var centralDirectoryRecord = entry2.getCentralDirectoryRecord();
          writeToOutputStream(self, centralDirectoryRecord);
        }), writeToOutputStream(self, getEndOfCentralDirectoryRecord(self)), self.outputStream.end(), self.allDone = !0);
    }
    function calculateTotalSize(self) {
      for (var pretendOutputCursor = 0, centralDirectorySize = 0, i = 0; i < self.entries.length; i++) {
        var entry = self.entries[i];
        if (entry.compressionLevel !== 0) return -1;
        if (entry.state >= Entry.READY_TO_PUMP_FILE_DATA) {
          if (entry.uncompressedSize == null) return -1;
        } else if (entry.uncompressedSize == null) return null;
        entry.relativeOffsetOfLocalHeader = pretendOutputCursor;
        var useZip64Format = entry.useZip64Format();
        pretendOutputCursor += LOCAL_FILE_HEADER_FIXED_SIZE + entry.utf8FileName.length, pretendOutputCursor += entry.uncompressedSize, entry.crcAndFileSizeKnown || (useZip64Format ? pretendOutputCursor += ZIP64_DATA_DESCRIPTOR_SIZE : pretendOutputCursor += DATA_DESCRIPTOR_SIZE), centralDirectorySize += CENTRAL_DIRECTORY_RECORD_FIXED_SIZE + entry.utf8FileName.length + entry.fileComment.length, entry.forceDosTimestamp || (centralDirectorySize += INFO_ZIP_UNIVERSAL_TIMESTAMP_EXTRA_FIELD_SIZE), useZip64Format && (centralDirectorySize += ZIP64_EXTENDED_INFORMATION_EXTRA_FIELD_SIZE);
      }
      var endOfCentralDirectorySize = 0;
      return (self.forceZip64Eocd || self.entries.length >= 65535 || centralDirectorySize >= 65535 || pretendOutputCursor >= 4294967295) && (endOfCentralDirectorySize += ZIP64_END_OF_CENTRAL_DIRECTORY_RECORD_SIZE + ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIZE), endOfCentralDirectorySize += END_OF_CENTRAL_DIRECTORY_RECORD_SIZE + self.comment.length, pretendOutputCursor + centralDirectorySize + endOfCentralDirectorySize;
    }
    function shouldIgnoreAdding(self) {
      if (self.ended) throw new Error("cannot add entries after calling end()");
      return !!self.errored;
    }
    var ZIP64_END_OF_CENTRAL_DIRECTORY_RECORD_SIZE = 56, ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIZE = 20, END_OF_CENTRAL_DIRECTORY_RECORD_SIZE = 22;
    function getEndOfCentralDirectoryRecord(self, actuallyJustTellMeHowLongItWouldBe) {
      var needZip64Format = !1, normalEntriesLength = self.entries.length;
      (self.forceZip64Eocd || self.entries.length >= 65535) && (normalEntriesLength = 65535, needZip64Format = !0);
      var sizeOfCentralDirectory = self.outputStreamCursor - self.offsetOfStartOfCentralDirectory, normalSizeOfCentralDirectory = sizeOfCentralDirectory;
      (self.forceZip64Eocd || sizeOfCentralDirectory >= 4294967295) && (normalSizeOfCentralDirectory = 4294967295, needZip64Format = !0);
      var normalOffsetOfStartOfCentralDirectory = self.offsetOfStartOfCentralDirectory;
      if ((self.forceZip64Eocd || self.offsetOfStartOfCentralDirectory >= 4294967295) && (normalOffsetOfStartOfCentralDirectory = 4294967295, needZip64Format = !0), actuallyJustTellMeHowLongItWouldBe)
        return needZip64Format ? ZIP64_END_OF_CENTRAL_DIRECTORY_RECORD_SIZE + ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIZE + END_OF_CENTRAL_DIRECTORY_RECORD_SIZE : END_OF_CENTRAL_DIRECTORY_RECORD_SIZE;
      var eocdrBuffer = bufferAlloc(END_OF_CENTRAL_DIRECTORY_RECORD_SIZE + self.comment.length);
      if (eocdrBuffer.writeUInt32LE(101010256, 0), eocdrBuffer.writeUInt16LE(0, 4), eocdrBuffer.writeUInt16LE(0, 6), eocdrBuffer.writeUInt16LE(normalEntriesLength, 8), eocdrBuffer.writeUInt16LE(normalEntriesLength, 10), eocdrBuffer.writeUInt32LE(normalSizeOfCentralDirectory, 12), eocdrBuffer.writeUInt32LE(normalOffsetOfStartOfCentralDirectory, 16), eocdrBuffer.writeUInt16LE(self.comment.length, 20), self.comment.copy(eocdrBuffer, 22), !needZip64Format) return eocdrBuffer;
      var zip64EocdrBuffer = bufferAlloc(ZIP64_END_OF_CENTRAL_DIRECTORY_RECORD_SIZE);
      zip64EocdrBuffer.writeUInt32LE(101075792, 0), writeUInt64LE(zip64EocdrBuffer, ZIP64_END_OF_CENTRAL_DIRECTORY_RECORD_SIZE - 12, 4), zip64EocdrBuffer.writeUInt16LE(VERSION_MADE_BY, 12), zip64EocdrBuffer.writeUInt16LE(VERSION_NEEDED_TO_EXTRACT_ZIP64, 14), zip64EocdrBuffer.writeUInt32LE(0, 16), zip64EocdrBuffer.writeUInt32LE(0, 20), writeUInt64LE(zip64EocdrBuffer, self.entries.length, 24), writeUInt64LE(zip64EocdrBuffer, self.entries.length, 32), writeUInt64LE(zip64EocdrBuffer, sizeOfCentralDirectory, 40), writeUInt64LE(zip64EocdrBuffer, self.offsetOfStartOfCentralDirectory, 48);
      var zip64EocdlBuffer = bufferAlloc(ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIZE);
      return zip64EocdlBuffer.writeUInt32LE(117853008, 0), zip64EocdlBuffer.writeUInt32LE(0, 4), writeUInt64LE(zip64EocdlBuffer, self.outputStreamCursor, 8), zip64EocdlBuffer.writeUInt32LE(1, 16), Buffer.concat([
        zip64EocdrBuffer,
        zip64EocdlBuffer,
        eocdrBuffer
      ]);
    }
    function validateMetadataPath(metadataPath, isDirectory2) {
      if (metadataPath === "") throw new Error("empty metadataPath");
      if (metadataPath = metadataPath.replace(/\\/g, "/"), /^[a-zA-Z]:/.test(metadataPath) || /^\//.test(metadataPath)) throw new Error("absolute path: " + metadataPath);
      if (metadataPath.split("/").indexOf("..") !== -1) throw new Error("invalid relative path: " + metadataPath);
      var looksLikeDirectory = /\/$/.test(metadataPath);
      if (isDirectory2)
        looksLikeDirectory || (metadataPath += "/");
      else if (looksLikeDirectory) throw new Error("file path cannot end with '/': " + metadataPath);
      return metadataPath;
    }
    var EMPTY_BUFFER = bufferAlloc(0);
    function Entry(metadataPath, isDirectory2, options) {
      if (this.utf8FileName = bufferFrom(metadataPath), this.utf8FileName.length > 65535) throw new Error("utf8 file name too long. " + utf8FileName.length + " > 65535");
      if (this.isDirectory = isDirectory2, this.state = Entry.WAITING_FOR_METADATA, this.setLastModDate(options.mtime != null ? options.mtime : /* @__PURE__ */ new Date()), this.forceDosTimestamp = !!options.forceDosTimestamp, options.mode != null ? this.setFileAttributesMode(options.mode) : this.setFileAttributesMode(isDirectory2 ? 16893 : 33204), isDirectory2 ? (this.crcAndFileSizeKnown = !0, this.crc32 = 0, this.uncompressedSize = 0, this.compressedSize = 0) : (this.crcAndFileSizeKnown = !1, this.crc32 = null, this.uncompressedSize = null, this.compressedSize = null, options.size != null && (this.uncompressedSize = options.size)), isDirectory2 ? this.compressionLevel = 0 : this.compressionLevel = determineCompressionLevel(options), this.forceZip64Format = !!options.forceZip64Format, options.fileComment) {
        if (typeof options.fileComment == "string" ? this.fileComment = bufferFrom(options.fileComment, "utf-8") : this.fileComment = options.fileComment, this.fileComment.length > 65535) throw new Error("fileComment is too large");
      } else
        this.fileComment = EMPTY_BUFFER;
    }
    Entry.WAITING_FOR_METADATA = 0;
    Entry.READY_TO_PUMP_FILE_DATA = 1;
    Entry.FILE_DATA_IN_PROGRESS = 2;
    Entry.FILE_DATA_DONE = 3;
    Entry.prototype.setLastModDate = function(date) {
      this.mtime = date;
      var dosDateTime = dateToDosDateTime(date);
      this.lastModFileTime = dosDateTime.time, this.lastModFileDate = dosDateTime.date;
    };
    Entry.prototype.setFileAttributesMode = function(mode) {
      if ((mode & 65535) !== mode) throw new Error("invalid mode. expected: 0 <= " + mode + " <= 65535");
      this.externalFileAttributes = mode << 16 >>> 0;
    };
    Entry.prototype.setFileDataPumpFunction = function(doFileDataPump) {
      this.doFileDataPump = doFileDataPump, this.state = Entry.READY_TO_PUMP_FILE_DATA;
    };
    Entry.prototype.useZip64Format = function() {
      return this.forceZip64Format || this.uncompressedSize != null && this.uncompressedSize > 4294967294 || this.compressedSize != null && this.compressedSize > 4294967294 || this.relativeOffsetOfLocalHeader != null && this.relativeOffsetOfLocalHeader > 4294967294;
    };
    var LOCAL_FILE_HEADER_FIXED_SIZE = 30, VERSION_NEEDED_TO_EXTRACT_UTF8 = 20, VERSION_NEEDED_TO_EXTRACT_ZIP64 = 45, VERSION_MADE_BY = 831, FILE_NAME_IS_UTF8 = 2048, UNKNOWN_CRC32_AND_FILE_SIZES = 8;
    Entry.prototype.getLocalFileHeader = function() {
      var crc322 = 0, compressedSize = 0, uncompressedSize = 0;
      this.crcAndFileSizeKnown && (crc322 = this.crc32, compressedSize = this.compressedSize, uncompressedSize = this.uncompressedSize);
      var fixedSizeStuff = bufferAlloc(LOCAL_FILE_HEADER_FIXED_SIZE), generalPurposeBitFlag = FILE_NAME_IS_UTF8;
      return this.crcAndFileSizeKnown || (generalPurposeBitFlag |= UNKNOWN_CRC32_AND_FILE_SIZES), fixedSizeStuff.writeUInt32LE(67324752, 0), fixedSizeStuff.writeUInt16LE(VERSION_NEEDED_TO_EXTRACT_UTF8, 4), fixedSizeStuff.writeUInt16LE(generalPurposeBitFlag, 6), fixedSizeStuff.writeUInt16LE(this.getCompressionMethod(), 8), fixedSizeStuff.writeUInt16LE(this.lastModFileTime, 10), fixedSizeStuff.writeUInt16LE(this.lastModFileDate, 12), fixedSizeStuff.writeUInt32LE(crc322, 14), fixedSizeStuff.writeUInt32LE(compressedSize, 18), fixedSizeStuff.writeUInt32LE(uncompressedSize, 22), fixedSizeStuff.writeUInt16LE(this.utf8FileName.length, 26), fixedSizeStuff.writeUInt16LE(0, 28), Buffer.concat([
        fixedSizeStuff,
        // file name (variable size)
        this.utf8FileName
        // extra field (variable size)
        // no extra fields
      ]);
    };
    var DATA_DESCRIPTOR_SIZE = 16, ZIP64_DATA_DESCRIPTOR_SIZE = 24;
    Entry.prototype.getDataDescriptor = function() {
      if (this.crcAndFileSizeKnown)
        return EMPTY_BUFFER;
      if (this.useZip64Format()) {
        var buffer = bufferAlloc(ZIP64_DATA_DESCRIPTOR_SIZE);
        return buffer.writeUInt32LE(134695760, 0), buffer.writeUInt32LE(this.crc32, 4), writeUInt64LE(buffer, this.compressedSize, 8), writeUInt64LE(buffer, this.uncompressedSize, 16), buffer;
      } else {
        var buffer = bufferAlloc(DATA_DESCRIPTOR_SIZE);
        return buffer.writeUInt32LE(134695760, 0), buffer.writeUInt32LE(this.crc32, 4), buffer.writeUInt32LE(this.compressedSize, 8), buffer.writeUInt32LE(this.uncompressedSize, 12), buffer;
      }
    };
    var CENTRAL_DIRECTORY_RECORD_FIXED_SIZE = 46, INFO_ZIP_UNIVERSAL_TIMESTAMP_EXTRA_FIELD_SIZE = 9, ZIP64_EXTENDED_INFORMATION_EXTRA_FIELD_SIZE = 28;
    Entry.prototype.getCentralDirectoryRecord = function() {
      var fixedSizeStuff = bufferAlloc(CENTRAL_DIRECTORY_RECORD_FIXED_SIZE), generalPurposeBitFlag = FILE_NAME_IS_UTF8;
      this.crcAndFileSizeKnown || (generalPurposeBitFlag |= UNKNOWN_CRC32_AND_FILE_SIZES);
      var izutefBuffer = EMPTY_BUFFER;
      if (!this.forceDosTimestamp) {
        izutefBuffer = bufferAlloc(INFO_ZIP_UNIVERSAL_TIMESTAMP_EXTRA_FIELD_SIZE), izutefBuffer.writeUInt16LE(21589, 0), izutefBuffer.writeUInt16LE(INFO_ZIP_UNIVERSAL_TIMESTAMP_EXTRA_FIELD_SIZE - 4, 2);
        var EB_UT_FL_MTIME = 1, EB_UT_FL_ATIME = 2;
        izutefBuffer.writeUInt8(EB_UT_FL_MTIME | EB_UT_FL_ATIME, 4);
        var timestamp = Math.floor(this.mtime.getTime() / 1e3);
        timestamp < -2147483648 && (timestamp = -2147483648), timestamp > 2147483647 && (timestamp = 2147483647), izutefBuffer.writeUInt32LE(timestamp, 5);
      }
      var normalCompressedSize = this.compressedSize, normalUncompressedSize = this.uncompressedSize, normalRelativeOffsetOfLocalHeader = this.relativeOffsetOfLocalHeader, versionNeededToExtract = VERSION_NEEDED_TO_EXTRACT_UTF8, zeiefBuffer = EMPTY_BUFFER;
      return this.useZip64Format() && (normalCompressedSize = 4294967295, normalUncompressedSize = 4294967295, normalRelativeOffsetOfLocalHeader = 4294967295, versionNeededToExtract = VERSION_NEEDED_TO_EXTRACT_ZIP64, zeiefBuffer = bufferAlloc(ZIP64_EXTENDED_INFORMATION_EXTRA_FIELD_SIZE), zeiefBuffer.writeUInt16LE(1, 0), zeiefBuffer.writeUInt16LE(ZIP64_EXTENDED_INFORMATION_EXTRA_FIELD_SIZE - 4, 2), writeUInt64LE(zeiefBuffer, this.uncompressedSize, 4), writeUInt64LE(zeiefBuffer, this.compressedSize, 12), writeUInt64LE(zeiefBuffer, this.relativeOffsetOfLocalHeader, 20)), fixedSizeStuff.writeUInt32LE(33639248, 0), fixedSizeStuff.writeUInt16LE(VERSION_MADE_BY, 4), fixedSizeStuff.writeUInt16LE(versionNeededToExtract, 6), fixedSizeStuff.writeUInt16LE(generalPurposeBitFlag, 8), fixedSizeStuff.writeUInt16LE(this.getCompressionMethod(), 10), fixedSizeStuff.writeUInt16LE(this.lastModFileTime, 12), fixedSizeStuff.writeUInt16LE(this.lastModFileDate, 14), fixedSizeStuff.writeUInt32LE(this.crc32, 16), fixedSizeStuff.writeUInt32LE(normalCompressedSize, 20), fixedSizeStuff.writeUInt32LE(normalUncompressedSize, 24), fixedSizeStuff.writeUInt16LE(this.utf8FileName.length, 28), fixedSizeStuff.writeUInt16LE(izutefBuffer.length + zeiefBuffer.length, 30), fixedSizeStuff.writeUInt16LE(this.fileComment.length, 32), fixedSizeStuff.writeUInt16LE(0, 34), fixedSizeStuff.writeUInt16LE(0, 36), fixedSizeStuff.writeUInt32LE(this.externalFileAttributes, 38), fixedSizeStuff.writeUInt32LE(normalRelativeOffsetOfLocalHeader, 42), Buffer.concat([
        fixedSizeStuff,
        // file name (variable size)
        this.utf8FileName,
        // extra field (variable size)
        izutefBuffer,
        zeiefBuffer,
        // file comment (variable size)
        this.fileComment
      ]);
    };
    Entry.prototype.getCompressionMethod = function() {
      var NO_COMPRESSION = 0, DEFLATE_COMPRESSION = 8;
      return this.compressionLevel === 0 ? NO_COMPRESSION : DEFLATE_COMPRESSION;
    };
    var minDosDate = new Date(1980, 0, 1), maxDosDate = new Date(2107, 11, 31, 23, 59, 58);
    function dateToDosDateTime(jsDate) {
      jsDate < minDosDate ? jsDate = minDosDate : jsDate > maxDosDate && (jsDate = maxDosDate);
      var date = 0;
      date |= jsDate.getDate() & 31, date |= (jsDate.getMonth() + 1 & 15) << 5, date |= (jsDate.getFullYear() - 1980 & 127) << 9;
      var time = 0;
      return time |= Math.floor(jsDate.getSeconds() / 2), time |= (jsDate.getMinutes() & 63) << 5, time |= (jsDate.getHours() & 31) << 11, { date, time };
    }
    function writeUInt64LE(buffer, n, offset) {
      var high = Math.floor(n / 4294967296), low = n % 4294967296;
      buffer.writeUInt32LE(low, offset), buffer.writeUInt32LE(high, offset + 4);
    }
    util.inherits(ByteCounter, Transform);
    function ByteCounter(options) {
      Transform.call(this, options), this.byteCount = 0;
    }
    ByteCounter.prototype._transform = function(chunk, encoding, cb) {
      this.byteCount += chunk.length, cb(null, chunk);
    };
    util.inherits(Crc32Watcher, Transform);
    function Crc32Watcher(options) {
      Transform.call(this, options), this.crc32 = 0;
    }
    Crc32Watcher.prototype._transform = function(chunk, encoding, cb) {
      this.crc32 = crc32.unsigned(chunk, this.crc32), cb(null, chunk);
    };
    var cp437 = "\0\u263A\u263B\u2665\u2666\u2663\u2660\u2022\u25D8\u25CB\u25D9\u2642\u2640\u266A\u266B\u263C\u25BA\u25C4\u2195\u203C\xB6\xA7\u25AC\u21A8\u2191\u2193\u2192\u2190\u221F\u2194\u25B2\u25BC !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u2302\xC7\xFC\xE9\xE2\xE4\xE0\xE5\xE7\xEA\xEB\xE8\xEF\xEE\xEC\xC4\xC5\xC9\xE6\xC6\xF4\xF6\xF2\xFB\xF9\xFF\xD6\xDC\xA2\xA3\xA5\u20A7\u0192\xE1\xED\xF3\xFA\xF1\xD1\xAA\xBA\xBF\u2310\xAC\xBD\xBC\xA1\xAB\xBB\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255D\u255C\u255B\u2510\u2514\u2534\u252C\u251C\u2500\u253C\u255E\u255F\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256B\u256A\u2518\u250C\u2588\u2584\u258C\u2590\u2580\u03B1\xDF\u0393\u03C0\u03A3\u03C3\xB5\u03C4\u03A6\u0398\u03A9\u03B4\u221E\u03C6\u03B5\u2229\u2261\xB1\u2265\u2264\u2320\u2321\xF7\u2248\xB0\u2219\xB7\u221A\u207F\xB2\u25A0\xA0";
    if (cp437.length !== 256) throw new Error("assertion failure");
    var reverseCp437 = null;
    function encodeCp437(string) {
      if (/^[\x20-\x7e]*$/.test(string))
        return bufferFrom(string, "utf-8");
      if (reverseCp437 == null) {
        reverseCp437 = {};
        for (var i = 0; i < cp437.length; i++)
          reverseCp437[cp437[i]] = i;
      }
      for (var result = bufferAlloc(string.length), i = 0; i < string.length; i++) {
        var b = reverseCp437[string[i]];
        if (b == null) throw new Error("character not encodable in CP437: " + JSON.stringify(string[i]));
        result[i] = b;
      }
      return result;
    }
    function bufferAlloc(size) {
      bufferAlloc = modern;
      try {
        return bufferAlloc(size);
      } catch {
        return bufferAlloc = legacy, bufferAlloc(size);
      }
      function modern(size2) {
        return Buffer.allocUnsafe(size2);
      }
      function legacy(size2) {
        return new Buffer(size2);
      }
    }
    function bufferFrom(something, encoding) {
      bufferFrom = modern;
      try {
        return bufferFrom(something, encoding);
      } catch {
        return bufferFrom = legacy, bufferFrom(something, encoding);
      }
      function modern(something2, encoding2) {
        return Buffer.from(something2, encoding2);
      }
      function legacy(something2, encoding2) {
        return new Buffer(something2, encoding2);
      }
    }
    function bufferIncludes(buffer, content) {
      bufferIncludes = modern;
      try {
        return bufferIncludes(buffer, content);
      } catch {
        return bufferIncludes = legacy, bufferIncludes(buffer, content);
      }
      function modern(buffer2, content2) {
        return buffer2.includes(content2);
      }
      function legacy(buffer2, content2) {
        for (var i = 0; i <= buffer2.length - content2.length; i++)
          for (var j = 0; ; j++) {
            if (j === content2.length) return !0;
            if (buffer2[i + j] !== content2[j]) break;
          }
        return !1;
      }
    }
  }
});

// node_modules/@actions/core/lib/command.js
import * as os from "os";

// node_modules/@actions/core/lib/utils.js
function toCommandValue(input) {
  return input == null ? "" : typeof input == "string" || input instanceof String ? input : JSON.stringify(input);
}
function toCommandProperties(annotationProperties) {
  return Object.keys(annotationProperties).length ? {
    title: annotationProperties.title,
    file: annotationProperties.file,
    line: annotationProperties.startLine,
    endLine: annotationProperties.endLine,
    col: annotationProperties.startColumn,
    endColumn: annotationProperties.endColumn
  } : {};
}

// node_modules/@actions/core/lib/command.js
function issueCommand(command, properties, message) {
  let cmd = new Command(command, properties, message);
  process.stdout.write(cmd.toString() + os.EOL);
}
function issue(name, message = "") {
  issueCommand(name, {}, message);
}
var CMD_STRING = "::", Command = class {
  constructor(command, properties, message) {
    command || (command = "missing.command"), this.command = command, this.properties = properties, this.message = message;
  }
  toString() {
    let cmdStr = CMD_STRING + this.command;
    if (this.properties && Object.keys(this.properties).length > 0) {
      cmdStr += " ";
      let first = !0;
      for (let key in this.properties)
        if (this.properties.hasOwnProperty(key)) {
          let val = this.properties[key];
          val && (first ? first = !1 : cmdStr += ",", cmdStr += `${key}=${escapeProperty(val)}`);
        }
    }
    return cmdStr += `${CMD_STRING}${escapeData(this.message)}`, cmdStr;
  }
};
function escapeData(s) {
  return toCommandValue(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function escapeProperty(s) {
  return toCommandValue(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A").replace(/:/g, "%3A").replace(/,/g, "%2C");
}

// node_modules/@actions/core/lib/file-command.js
import * as crypto from "crypto";
import * as fs from "fs";
import * as os2 from "os";
function issueFileCommand(command, message) {
  let filePath = process.env[`GITHUB_${command}`];
  if (!filePath)
    throw new Error(`Unable to find environment variable for file command ${command}`);
  if (!fs.existsSync(filePath))
    throw new Error(`Missing file at path: ${filePath}`);
  fs.appendFileSync(filePath, `${toCommandValue(message)}${os2.EOL}`, {
    encoding: "utf8"
  });
}
function prepareKeyValueMessage(key, value) {
  let delimiter2 = `ghadelimiter_${crypto.randomUUID()}`, convertedValue = toCommandValue(value);
  if (key.includes(delimiter2))
    throw new Error(`Unexpected input: name should not contain the delimiter "${delimiter2}"`);
  if (convertedValue.includes(delimiter2))
    throw new Error(`Unexpected input: value should not contain the delimiter "${delimiter2}"`);
  return `${key}<<${delimiter2}${os2.EOL}${convertedValue}${os2.EOL}${delimiter2}`;
}

// node_modules/@actions/core/lib/core.js
import * as os5 from "os";

// node_modules/@actions/http-client/lib/index.js
var tunnel = __toESM(require_tunnel2(), 1), import_undici = __toESM(require_undici(), 1);
var HttpCodes;
(function(HttpCodes2) {
  HttpCodes2[HttpCodes2.OK = 200] = "OK", HttpCodes2[HttpCodes2.MultipleChoices = 300] = "MultipleChoices", HttpCodes2[HttpCodes2.MovedPermanently = 301] = "MovedPermanently", HttpCodes2[HttpCodes2.ResourceMoved = 302] = "ResourceMoved", HttpCodes2[HttpCodes2.SeeOther = 303] = "SeeOther", HttpCodes2[HttpCodes2.NotModified = 304] = "NotModified", HttpCodes2[HttpCodes2.UseProxy = 305] = "UseProxy", HttpCodes2[HttpCodes2.SwitchProxy = 306] = "SwitchProxy", HttpCodes2[HttpCodes2.TemporaryRedirect = 307] = "TemporaryRedirect", HttpCodes2[HttpCodes2.PermanentRedirect = 308] = "PermanentRedirect", HttpCodes2[HttpCodes2.BadRequest = 400] = "BadRequest", HttpCodes2[HttpCodes2.Unauthorized = 401] = "Unauthorized", HttpCodes2[HttpCodes2.PaymentRequired = 402] = "PaymentRequired", HttpCodes2[HttpCodes2.Forbidden = 403] = "Forbidden", HttpCodes2[HttpCodes2.NotFound = 404] = "NotFound", HttpCodes2[HttpCodes2.MethodNotAllowed = 405] = "MethodNotAllowed", HttpCodes2[HttpCodes2.NotAcceptable = 406] = "NotAcceptable", HttpCodes2[HttpCodes2.ProxyAuthenticationRequired = 407] = "ProxyAuthenticationRequired", HttpCodes2[HttpCodes2.RequestTimeout = 408] = "RequestTimeout", HttpCodes2[HttpCodes2.Conflict = 409] = "Conflict", HttpCodes2[HttpCodes2.Gone = 410] = "Gone", HttpCodes2[HttpCodes2.TooManyRequests = 429] = "TooManyRequests", HttpCodes2[HttpCodes2.InternalServerError = 500] = "InternalServerError", HttpCodes2[HttpCodes2.NotImplemented = 501] = "NotImplemented", HttpCodes2[HttpCodes2.BadGateway = 502] = "BadGateway", HttpCodes2[HttpCodes2.ServiceUnavailable = 503] = "ServiceUnavailable", HttpCodes2[HttpCodes2.GatewayTimeout = 504] = "GatewayTimeout";
})(HttpCodes || (HttpCodes = {}));
var Headers;
(function(Headers2) {
  Headers2.Accept = "accept", Headers2.ContentType = "content-type";
})(Headers || (Headers = {}));
var MediaTypes;
(function(MediaTypes2) {
  MediaTypes2.ApplicationJson = "application/json";
})(MediaTypes || (MediaTypes = {}));
var HttpRedirectCodes = [
  HttpCodes.MovedPermanently,
  HttpCodes.ResourceMoved,
  HttpCodes.SeeOther,
  HttpCodes.TemporaryRedirect,
  HttpCodes.PermanentRedirect
], HttpResponseRetryCodes = [
  HttpCodes.BadGateway,
  HttpCodes.ServiceUnavailable,
  HttpCodes.GatewayTimeout
];

// node_modules/@actions/core/lib/summary.js
import { EOL as EOL3 } from "os";
import { constants, promises } from "fs";
var __awaiter = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}, { access, appendFile, writeFile } = promises, SUMMARY_ENV_VAR = "GITHUB_STEP_SUMMARY";
var Summary = class {
  constructor() {
    this._buffer = "";
  }
  /**
   * Finds the summary file path from the environment, rejects if env var is not found or file does not exist
   * Also checks r/w permissions.
   *
   * @returns step summary file path
   */
  filePath() {
    return __awaiter(this, void 0, void 0, function* () {
      if (this._filePath)
        return this._filePath;
      let pathFromEnv = process.env[SUMMARY_ENV_VAR];
      if (!pathFromEnv)
        throw new Error(`Unable to find environment variable for $${SUMMARY_ENV_VAR}. Check if your runtime environment supports job summaries.`);
      try {
        yield access(pathFromEnv, constants.R_OK | constants.W_OK);
      } catch {
        throw new Error(`Unable to access summary file: '${pathFromEnv}'. Check if the file has correct read/write permissions.`);
      }
      return this._filePath = pathFromEnv, this._filePath;
    });
  }
  /**
   * Wraps content in an HTML tag, adding any HTML attributes
   *
   * @param {string} tag HTML tag to wrap
   * @param {string | null} content content within the tag
   * @param {[attribute: string]: string} attrs key-value list of HTML attributes to add
   *
   * @returns {string} content wrapped in HTML element
   */
  wrap(tag, content, attrs = {}) {
    let htmlAttrs = Object.entries(attrs).map(([key, value]) => ` ${key}="${value}"`).join("");
    return content ? `<${tag}${htmlAttrs}>${content}</${tag}>` : `<${tag}${htmlAttrs}>`;
  }
  /**
   * Writes text in the buffer to the summary buffer file and empties buffer. Will append by default.
   *
   * @param {SummaryWriteOptions} [options] (optional) options for write operation
   *
   * @returns {Promise<Summary>} summary instance
   */
  write(options) {
    return __awaiter(this, void 0, void 0, function* () {
      let overwrite = !!options?.overwrite, filePath = yield this.filePath();
      return yield (overwrite ? writeFile : appendFile)(filePath, this._buffer, { encoding: "utf8" }), this.emptyBuffer();
    });
  }
  /**
   * Clears the summary buffer and wipes the summary file
   *
   * @returns {Summary} summary instance
   */
  clear() {
    return __awaiter(this, void 0, void 0, function* () {
      return this.emptyBuffer().write({ overwrite: !0 });
    });
  }
  /**
   * Returns the current summary buffer as a string
   *
   * @returns {string} string of summary buffer
   */
  stringify() {
    return this._buffer;
  }
  /**
   * If the summary buffer is empty
   *
   * @returns {boolen} true if the buffer is empty
   */
  isEmptyBuffer() {
    return this._buffer.length === 0;
  }
  /**
   * Resets the summary buffer without writing to summary file
   *
   * @returns {Summary} summary instance
   */
  emptyBuffer() {
    return this._buffer = "", this;
  }
  /**
   * Adds raw text to the summary buffer
   *
   * @param {string} text content to add
   * @param {boolean} [addEOL=false] (optional) append an EOL to the raw text (default: false)
   *
   * @returns {Summary} summary instance
   */
  addRaw(text, addEOL = !1) {
    return this._buffer += text, addEOL ? this.addEOL() : this;
  }
  /**
   * Adds the operating system-specific end-of-line marker to the buffer
   *
   * @returns {Summary} summary instance
   */
  addEOL() {
    return this.addRaw(EOL3);
  }
  /**
   * Adds an HTML codeblock to the summary buffer
   *
   * @param {string} code content to render within fenced code block
   * @param {string} lang (optional) language to syntax highlight code
   *
   * @returns {Summary} summary instance
   */
  addCodeBlock(code, lang) {
    let attrs = Object.assign({}, lang && { lang }), element = this.wrap("pre", this.wrap("code", code), attrs);
    return this.addRaw(element).addEOL();
  }
  /**
   * Adds an HTML list to the summary buffer
   *
   * @param {string[]} items list of items to render
   * @param {boolean} [ordered=false] (optional) if the rendered list should be ordered or not (default: false)
   *
   * @returns {Summary} summary instance
   */
  addList(items, ordered = !1) {
    let tag = ordered ? "ol" : "ul", listItems = items.map((item) => this.wrap("li", item)).join(""), element = this.wrap(tag, listItems);
    return this.addRaw(element).addEOL();
  }
  /**
   * Adds an HTML table to the summary buffer
   *
   * @param {SummaryTableCell[]} rows table rows
   *
   * @returns {Summary} summary instance
   */
  addTable(rows) {
    let tableBody = rows.map((row) => {
      let cells = row.map((cell) => {
        if (typeof cell == "string")
          return this.wrap("td", cell);
        let { header, data, colspan, rowspan } = cell, tag = header ? "th" : "td", attrs = Object.assign(Object.assign({}, colspan && { colspan }), rowspan && { rowspan });
        return this.wrap(tag, data, attrs);
      }).join("");
      return this.wrap("tr", cells);
    }).join(""), element = this.wrap("table", tableBody);
    return this.addRaw(element).addEOL();
  }
  /**
   * Adds a collapsable HTML details element to the summary buffer
   *
   * @param {string} label text for the closed state
   * @param {string} content collapsable content
   *
   * @returns {Summary} summary instance
   */
  addDetails(label, content) {
    let element = this.wrap("details", this.wrap("summary", label) + content);
    return this.addRaw(element).addEOL();
  }
  /**
   * Adds an HTML image tag to the summary buffer
   *
   * @param {string} src path to the image you to embed
   * @param {string} alt text description of the image
   * @param {SummaryImageOptions} options (optional) addition image attributes
   *
   * @returns {Summary} summary instance
   */
  addImage(src, alt, options) {
    let { width, height } = options || {}, attrs = Object.assign(Object.assign({}, width && { width }), height && { height }), element = this.wrap("img", null, Object.assign({ src, alt }, attrs));
    return this.addRaw(element).addEOL();
  }
  /**
   * Adds an HTML section heading element
   *
   * @param {string} text heading text
   * @param {number | string} [level=1] (optional) the heading level, default: 1
   *
   * @returns {Summary} summary instance
   */
  addHeading(text, level) {
    let tag = `h${level}`, allowedTag = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag) ? tag : "h1", element = this.wrap(allowedTag, text);
    return this.addRaw(element).addEOL();
  }
  /**
   * Adds an HTML thematic break (<hr>) to the summary buffer
   *
   * @returns {Summary} summary instance
   */
  addSeparator() {
    let element = this.wrap("hr", null);
    return this.addRaw(element).addEOL();
  }
  /**
   * Adds an HTML line break (<br>) to the summary buffer
   *
   * @returns {Summary} summary instance
   */
  addBreak() {
    let element = this.wrap("br", null);
    return this.addRaw(element).addEOL();
  }
  /**
   * Adds an HTML blockquote to the summary buffer
   *
   * @param {string} text quote text
   * @param {string} cite (optional) citation url
   *
   * @returns {Summary} summary instance
   */
  addQuote(text, cite) {
    let attrs = Object.assign({}, cite && { cite }), element = this.wrap("blockquote", text, attrs);
    return this.addRaw(element).addEOL();
  }
  /**
   * Adds an HTML anchor tag to the summary buffer
   *
   * @param {string} text link text/content
   * @param {string} href hyperlink
   *
   * @returns {Summary} summary instance
   */
  addLink(text, href) {
    let element = this.wrap("a", text, { href });
    return this.addRaw(element).addEOL();
  }
}, _summary = new Summary();

// node_modules/@actions/core/lib/platform.js
import os4 from "os";

// node_modules/@actions/exec/lib/exec.js
import { StringDecoder } from "string_decoder";

// node_modules/@actions/exec/lib/toolrunner.js
import * as os3 from "os";
import * as events from "events";
import * as child from "child_process";
import * as path3 from "path";

// node_modules/@actions/io/lib/io.js
import * as path2 from "path";

// node_modules/@actions/io/lib/io-util.js
import * as fs2 from "fs";
import * as path from "path";
var __awaiter2 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}, { chmod, copyFile, lstat, mkdir, open, readdir, rename, rm, rmdir, stat, symlink, unlink } = fs2.promises, IS_WINDOWS = process.platform === "win32";
var READONLY = fs2.constants.O_RDONLY;
function exists(fsPath) {
  return __awaiter2(this, void 0, void 0, function* () {
    try {
      yield stat(fsPath);
    } catch (err) {
      if (err.code === "ENOENT")
        return !1;
      throw err;
    }
    return !0;
  });
}
function isRooted(p) {
  if (p = normalizeSeparators(p), !p)
    throw new Error('isRooted() parameter "p" cannot be empty');
  return IS_WINDOWS ? p.startsWith("\\") || /^[A-Z]:/i.test(p) : p.startsWith("/");
}
function tryGetExecutablePath(filePath, extensions) {
  return __awaiter2(this, void 0, void 0, function* () {
    let stats;
    try {
      stats = yield stat(filePath);
    } catch (err) {
      err.code !== "ENOENT" && console.log(`Unexpected error attempting to determine if executable file exists '${filePath}': ${err}`);
    }
    if (stats && stats.isFile()) {
      if (IS_WINDOWS) {
        let upperExt = path.extname(filePath).toUpperCase();
        if (extensions.some((validExt) => validExt.toUpperCase() === upperExt))
          return filePath;
      } else if (isUnixExecutable(stats))
        return filePath;
    }
    let originalFilePath = filePath;
    for (let extension of extensions) {
      filePath = originalFilePath + extension, stats = void 0;
      try {
        stats = yield stat(filePath);
      } catch (err) {
        err.code !== "ENOENT" && console.log(`Unexpected error attempting to determine if executable file exists '${filePath}': ${err}`);
      }
      if (stats && stats.isFile()) {
        if (IS_WINDOWS) {
          try {
            let directory = path.dirname(filePath), upperName = path.basename(filePath).toUpperCase();
            for (let actualName of yield readdir(directory))
              if (upperName === actualName.toUpperCase()) {
                filePath = path.join(directory, actualName);
                break;
              }
          } catch (err) {
            console.log(`Unexpected error attempting to determine the actual case of the file '${filePath}': ${err}`);
          }
          return filePath;
        } else if (isUnixExecutable(stats))
          return filePath;
      }
    }
    return "";
  });
}
function normalizeSeparators(p) {
  return p = p || "", IS_WINDOWS ? (p = p.replace(/\//g, "\\"), p.replace(/\\\\+/g, "\\")) : p.replace(/\/\/+/g, "/");
}
function isUnixExecutable(stats) {
  return (stats.mode & 1) > 0 || (stats.mode & 8) > 0 && process.getgid !== void 0 && stats.gid === process.getgid() || (stats.mode & 64) > 0 && process.getuid !== void 0 && stats.uid === process.getuid();
}

// node_modules/@actions/io/lib/io.js
var __awaiter3 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
function which(tool, check) {
  return __awaiter3(this, void 0, void 0, function* () {
    if (!tool)
      throw new Error("parameter 'tool' is required");
    if (check) {
      let result = yield which(tool, !1);
      if (!result)
        throw IS_WINDOWS ? new Error(`Unable to locate executable file: ${tool}. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable. Also verify the file has a valid extension for an executable file.`) : new Error(`Unable to locate executable file: ${tool}. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable. Also check the file mode to verify the file is executable.`);
      return result;
    }
    let matches = yield findInPath(tool);
    return matches && matches.length > 0 ? matches[0] : "";
  });
}
function findInPath(tool) {
  return __awaiter3(this, void 0, void 0, function* () {
    if (!tool)
      throw new Error("parameter 'tool' is required");
    let extensions = [];
    if (IS_WINDOWS && process.env.PATHEXT)
      for (let extension of process.env.PATHEXT.split(path2.delimiter))
        extension && extensions.push(extension);
    if (isRooted(tool)) {
      let filePath = yield tryGetExecutablePath(tool, extensions);
      return filePath ? [filePath] : [];
    }
    if (tool.includes(path2.sep))
      return [];
    let directories = [];
    if (process.env.PATH)
      for (let p of process.env.PATH.split(path2.delimiter))
        p && directories.push(p);
    let matches = [];
    for (let directory of directories) {
      let filePath = yield tryGetExecutablePath(path2.join(directory, tool), extensions);
      filePath && matches.push(filePath);
    }
    return matches;
  });
}

// node_modules/@actions/exec/lib/toolrunner.js
import { setTimeout as setTimeout2 } from "timers";
var __awaiter4 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}, IS_WINDOWS2 = process.platform === "win32", ToolRunner = class extends events.EventEmitter {
  constructor(toolPath, args, options) {
    if (super(), !toolPath)
      throw new Error("Parameter 'toolPath' cannot be null or empty.");
    this.toolPath = toolPath, this.args = args || [], this.options = options || {};
  }
  _debug(message) {
    this.options.listeners && this.options.listeners.debug && this.options.listeners.debug(message);
  }
  _getCommandString(options, noPrefix) {
    let toolPath = this._getSpawnFileName(), args = this._getSpawnArgs(options), cmd = noPrefix ? "" : "[command]";
    if (IS_WINDOWS2)
      if (this._isCmdFile()) {
        cmd += toolPath;
        for (let a of args)
          cmd += ` ${a}`;
      } else if (options.windowsVerbatimArguments) {
        cmd += `"${toolPath}"`;
        for (let a of args)
          cmd += ` ${a}`;
      } else {
        cmd += this._windowsQuoteCmdArg(toolPath);
        for (let a of args)
          cmd += ` ${this._windowsQuoteCmdArg(a)}`;
      }
    else {
      cmd += toolPath;
      for (let a of args)
        cmd += ` ${a}`;
    }
    return cmd;
  }
  _processLineBuffer(data, strBuffer, onLine) {
    try {
      let s = strBuffer + data.toString(), n = s.indexOf(os3.EOL);
      for (; n > -1; ) {
        let line = s.substring(0, n);
        onLine(line), s = s.substring(n + os3.EOL.length), n = s.indexOf(os3.EOL);
      }
      return s;
    } catch (err) {
      return this._debug(`error processing line. Failed with error ${err}`), "";
    }
  }
  _getSpawnFileName() {
    return IS_WINDOWS2 && this._isCmdFile() ? process.env.COMSPEC || "cmd.exe" : this.toolPath;
  }
  _getSpawnArgs(options) {
    if (IS_WINDOWS2 && this._isCmdFile()) {
      let argline = `/D /S /C "${this._windowsQuoteCmdArg(this.toolPath)}`;
      for (let a of this.args)
        argline += " ", argline += options.windowsVerbatimArguments ? a : this._windowsQuoteCmdArg(a);
      return argline += '"', [argline];
    }
    return this.args;
  }
  _endsWith(str, end) {
    return str.endsWith(end);
  }
  _isCmdFile() {
    let upperToolPath = this.toolPath.toUpperCase();
    return this._endsWith(upperToolPath, ".CMD") || this._endsWith(upperToolPath, ".BAT");
  }
  _windowsQuoteCmdArg(arg) {
    if (!this._isCmdFile())
      return this._uvQuoteCmdArg(arg);
    if (!arg)
      return '""';
    let cmdSpecialChars = [
      " ",
      "	",
      "&",
      "(",
      ")",
      "[",
      "]",
      "{",
      "}",
      "^",
      "=",
      ";",
      "!",
      "'",
      "+",
      ",",
      "`",
      "~",
      "|",
      "<",
      ">",
      '"'
    ], needsQuotes = !1;
    for (let char of arg)
      if (cmdSpecialChars.some((x) => x === char)) {
        needsQuotes = !0;
        break;
      }
    if (!needsQuotes)
      return arg;
    let reverse = '"', quoteHit = !0;
    for (let i = arg.length; i > 0; i--)
      reverse += arg[i - 1], quoteHit && arg[i - 1] === "\\" ? reverse += "\\" : arg[i - 1] === '"' ? (quoteHit = !0, reverse += '"') : quoteHit = !1;
    return reverse += '"', reverse.split("").reverse().join("");
  }
  _uvQuoteCmdArg(arg) {
    if (!arg)
      return '""';
    if (!arg.includes(" ") && !arg.includes("	") && !arg.includes('"'))
      return arg;
    if (!arg.includes('"') && !arg.includes("\\"))
      return `"${arg}"`;
    let reverse = '"', quoteHit = !0;
    for (let i = arg.length; i > 0; i--)
      reverse += arg[i - 1], quoteHit && arg[i - 1] === "\\" ? reverse += "\\" : arg[i - 1] === '"' ? (quoteHit = !0, reverse += "\\") : quoteHit = !1;
    return reverse += '"', reverse.split("").reverse().join("");
  }
  _cloneExecOptions(options) {
    options = options || {};
    let result = {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      silent: options.silent || !1,
      windowsVerbatimArguments: options.windowsVerbatimArguments || !1,
      failOnStdErr: options.failOnStdErr || !1,
      ignoreReturnCode: options.ignoreReturnCode || !1,
      delay: options.delay || 1e4
    };
    return result.outStream = options.outStream || process.stdout, result.errStream = options.errStream || process.stderr, result;
  }
  _getSpawnOptions(options, toolPath) {
    options = options || {};
    let result = {};
    return result.cwd = options.cwd, result.env = options.env, result.windowsVerbatimArguments = options.windowsVerbatimArguments || this._isCmdFile(), options.windowsVerbatimArguments && (result.argv0 = `"${toolPath}"`), result;
  }
  /**
   * Exec a tool.
   * Output will be streamed to the live console.
   * Returns promise with return code
   *
   * @param     tool     path to tool to exec
   * @param     options  optional exec options.  See ExecOptions
   * @returns   number
   */
  exec() {
    return __awaiter4(this, void 0, void 0, function* () {
      return !isRooted(this.toolPath) && (this.toolPath.includes("/") || IS_WINDOWS2 && this.toolPath.includes("\\")) && (this.toolPath = path3.resolve(process.cwd(), this.options.cwd || process.cwd(), this.toolPath)), this.toolPath = yield which(this.toolPath, !0), new Promise((resolve2, reject) => __awaiter4(this, void 0, void 0, function* () {
        this._debug(`exec tool: ${this.toolPath}`), this._debug("arguments:");
        for (let arg of this.args)
          this._debug(`   ${arg}`);
        let optionsNonNull = this._cloneExecOptions(this.options);
        !optionsNonNull.silent && optionsNonNull.outStream && optionsNonNull.outStream.write(this._getCommandString(optionsNonNull) + os3.EOL);
        let state = new ExecState(optionsNonNull, this.toolPath);
        if (state.on("debug", (message) => {
          this._debug(message);
        }), this.options.cwd && !(yield exists(this.options.cwd)))
          return reject(new Error(`The cwd: ${this.options.cwd} does not exist!`));
        let fileName = this._getSpawnFileName(), cp = child.spawn(fileName, this._getSpawnArgs(optionsNonNull), this._getSpawnOptions(this.options, fileName)), stdbuffer = "";
        cp.stdout && cp.stdout.on("data", (data) => {
          this.options.listeners && this.options.listeners.stdout && this.options.listeners.stdout(data), !optionsNonNull.silent && optionsNonNull.outStream && optionsNonNull.outStream.write(data), stdbuffer = this._processLineBuffer(data, stdbuffer, (line) => {
            this.options.listeners && this.options.listeners.stdline && this.options.listeners.stdline(line);
          });
        });
        let errbuffer = "";
        if (cp.stderr && cp.stderr.on("data", (data) => {
          state.processStderr = !0, this.options.listeners && this.options.listeners.stderr && this.options.listeners.stderr(data), !optionsNonNull.silent && optionsNonNull.errStream && optionsNonNull.outStream && (optionsNonNull.failOnStdErr ? optionsNonNull.errStream : optionsNonNull.outStream).write(data), errbuffer = this._processLineBuffer(data, errbuffer, (line) => {
            this.options.listeners && this.options.listeners.errline && this.options.listeners.errline(line);
          });
        }), cp.on("error", (err) => {
          state.processError = err.message, state.processExited = !0, state.processClosed = !0, state.CheckComplete();
        }), cp.on("exit", (code) => {
          state.processExitCode = code, state.processExited = !0, this._debug(`Exit code ${code} received from tool '${this.toolPath}'`), state.CheckComplete();
        }), cp.on("close", (code) => {
          state.processExitCode = code, state.processExited = !0, state.processClosed = !0, this._debug(`STDIO streams have closed for tool '${this.toolPath}'`), state.CheckComplete();
        }), state.on("done", (error2, exitCode) => {
          stdbuffer.length > 0 && this.emit("stdline", stdbuffer), errbuffer.length > 0 && this.emit("errline", errbuffer), cp.removeAllListeners(), error2 ? reject(error2) : resolve2(exitCode);
        }), this.options.input) {
          if (!cp.stdin)
            throw new Error("child process missing stdin");
          cp.stdin.end(this.options.input);
        }
      }));
    });
  }
};
function argStringToArray(argString) {
  let args = [], inQuotes = !1, escaped = !1, arg = "";
  function append(c) {
    escaped && c !== '"' && (arg += "\\"), arg += c, escaped = !1;
  }
  for (let i = 0; i < argString.length; i++) {
    let c = argString.charAt(i);
    if (c === '"') {
      escaped ? append(c) : inQuotes = !inQuotes;
      continue;
    }
    if (c === "\\" && escaped) {
      append(c);
      continue;
    }
    if (c === "\\" && inQuotes) {
      escaped = !0;
      continue;
    }
    if (c === " " && !inQuotes) {
      arg.length > 0 && (args.push(arg), arg = "");
      continue;
    }
    append(c);
  }
  return arg.length > 0 && args.push(arg.trim()), args;
}
var ExecState = class _ExecState extends events.EventEmitter {
  constructor(options, toolPath) {
    if (super(), this.processClosed = !1, this.processError = "", this.processExitCode = 0, this.processExited = !1, this.processStderr = !1, this.delay = 1e4, this.done = !1, this.timeout = null, !toolPath)
      throw new Error("toolPath must not be empty");
    this.options = options, this.toolPath = toolPath, options.delay && (this.delay = options.delay);
  }
  CheckComplete() {
    this.done || (this.processClosed ? this._setResult() : this.processExited && (this.timeout = setTimeout2(_ExecState.HandleTimeout, this.delay, this)));
  }
  _debug(message) {
    this.emit("debug", message);
  }
  _setResult() {
    let error2;
    this.processExited && (this.processError ? error2 = new Error(`There was an error when attempting to execute the process '${this.toolPath}'. This may indicate the process failed to start. Error: ${this.processError}`) : this.processExitCode !== 0 && !this.options.ignoreReturnCode ? error2 = new Error(`The process '${this.toolPath}' failed with exit code ${this.processExitCode}`) : this.processStderr && this.options.failOnStdErr && (error2 = new Error(`The process '${this.toolPath}' failed because one or more lines were written to the STDERR stream`))), this.timeout && (clearTimeout(this.timeout), this.timeout = null), this.done = !0, this.emit("done", error2, this.processExitCode);
  }
  static HandleTimeout(state) {
    if (!state.done) {
      if (!state.processClosed && state.processExited) {
        let message = `The STDIO streams did not close within ${state.delay / 1e3} seconds of the exit event from process '${state.toolPath}'. This may indicate a child process inherited the STDIO streams and has not yet exited.`;
        state._debug(message);
      }
      state._setResult();
    }
  }
};

// node_modules/@actions/exec/lib/exec.js
var __awaiter5 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
function exec(commandLine, args, options) {
  return __awaiter5(this, void 0, void 0, function* () {
    let commandArgs = argStringToArray(commandLine);
    if (commandArgs.length === 0)
      throw new Error("Parameter 'commandLine' cannot be null or empty.");
    let toolPath = commandArgs[0];
    return args = commandArgs.slice(1).concat(args || []), new ToolRunner(toolPath, args, options).exec();
  });
}
function getExecOutput(commandLine, args, options) {
  return __awaiter5(this, void 0, void 0, function* () {
    var _a, _b;
    let stdout = "", stderr = "", stdoutDecoder = new StringDecoder("utf8"), stderrDecoder = new StringDecoder("utf8"), originalStdoutListener = (_a = options?.listeners) === null || _a === void 0 ? void 0 : _a.stdout, originalStdErrListener = (_b = options?.listeners) === null || _b === void 0 ? void 0 : _b.stderr, stdErrListener = (data) => {
      stderr += stderrDecoder.write(data), originalStdErrListener && originalStdErrListener(data);
    }, stdOutListener = (data) => {
      stdout += stdoutDecoder.write(data), originalStdoutListener && originalStdoutListener(data);
    }, listeners = Object.assign(Object.assign({}, options?.listeners), { stdout: stdOutListener, stderr: stdErrListener }), exitCode = yield exec(commandLine, args, Object.assign(Object.assign({}, options), { listeners }));
    return stdout += stdoutDecoder.end(), stderr += stderrDecoder.end(), {
      exitCode,
      stdout,
      stderr
    };
  });
}

// node_modules/@actions/core/lib/platform.js
var platform = os4.platform(), arch = os4.arch();

// node_modules/@actions/core/lib/core.js
var ExitCode;
(function(ExitCode2) {
  ExitCode2[ExitCode2.Success = 0] = "Success", ExitCode2[ExitCode2.Failure = 1] = "Failure";
})(ExitCode || (ExitCode = {}));
function setSecret(secret) {
  issueCommand("add-mask", {}, secret);
}
function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT || "")
    return issueFileCommand("OUTPUT", prepareKeyValueMessage(name, value));
  process.stdout.write(os5.EOL), issueCommand("set-output", { name }, toCommandValue(value));
}
function setFailed(message) {
  process.exitCode = ExitCode.Failure, error(message);
}
function isDebug() {
  return process.env.RUNNER_DEBUG === "1";
}
function debug(message) {
  issueCommand("debug", {}, message);
}
function error(message, properties = {}) {
  issueCommand("error", toCommandProperties(properties), message instanceof Error ? message.toString() : message);
}
function warning(message, properties = {}) {
  issueCommand("warning", toCommandProperties(properties), message instanceof Error ? message.toString() : message);
}
function notice(message, properties = {}) {
  issueCommand("notice", toCommandProperties(properties), message instanceof Error ? message.toString() : message);
}
function info(message) {
  process.stdout.write(message + os5.EOL);
}
function startGroup(name) {
  issue("group", name);
}
function endGroup() {
  issue("endgroup");
}
function saveState(name, value) {
  if (process.env.GITHUB_STATE || "")
    return issueFileCommand("STATE", prepareKeyValueMessage(name, value));
  issueCommand("save-state", { name }, toCommandValue(value));
}
function getState(name) {
  return process.env[`STATE_${name}`] || "";
}

// packages/build/src/main.ts
import { mkdir as mkdir3, rename as rename3, stat as stat4 } from "node:fs/promises";
import { tmpdir as tmpdir2 } from "node:os";
import { basename as pathBasename, dirname as dirname5, join as join7, resolve as pathResolve } from "node:path";

// packages/core/src/errors.ts
var PkgActionError = class extends Error {
  file;
  line;
  col;
  constructor(message, opts = {}) {
    super(message, opts.cause !== void 0 ? { cause: opts.cause } : void 0), this.name = new.target.name, opts.file !== void 0 && (this.file = opts.file), opts.line !== void 0 && (this.line = opts.line), opts.col !== void 0 && (this.col = opts.col);
  }
}, ValidationError = class extends PkgActionError {
}, PkgRunError = class extends PkgActionError {
};
var ArchiveError = class extends PkgActionError {
}, ChecksumError = class extends PkgActionError {
}, ResEditError = class extends PkgActionError {
}, SignError = class extends PkgActionError {
};
function formatErrorChain(err, maxDepth = 5) {
  let parts = [], current = err, depth = 0;
  for (; current != null && depth < maxDepth; ) {
    if (current instanceof Error)
      parts.push(`${current.name}: ${current.message}`), current = current.cause;
    else {
      parts.push(String(current));
      break;
    }
    depth += 1;
  }
  return parts.join(" \u2192 caused by \u2192 ");
}

// packages/core/src/logger.ts
var actionsLogger = {
  debug: (m) => debug(m),
  info: (m) => info(m),
  warning: (m, p) => warning(m, p),
  error: (m, p) => error(m, p),
  notice: (m, p) => notice(m, p),
  startGroup: (n) => startGroup(n),
  endGroup: () => endGroup(),
  setSecret: (v) => setSecret(v),
  isDebug: () => isDebug()
};

// packages/core/src/fs-utils.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { chmod as chmod2, mkdir as mkdir2, open as open2, rename as rename2, rm as rm2, stat as stat2, writeFile as writeFile2 } from "node:fs/promises";
import { dirname as dirname3, join as join3 } from "node:path";
async function createInvocationTemp(parent) {
  let id = randomUUID2(), dir = join3(parent, `pkg-action-${id}`);
  return await mkdir2(dir, { recursive: !0, mode: 448 }), await chmod2(dir, 448), dir;
}
async function atomicWriteFile(path4, data) {
  await mkdir2(dirname3(path4), { recursive: !0 });
  let tmp = `${path4}.tmp-${randomUUID2()}`;
  await writeFile2(tmp, data), await rename2(tmp, path4);
}

// packages/core/src/targets.ts
var VALID_OS = ["linux", "macos", "win", "alpine", "linuxstatic"], VALID_ARCH = ["x64", "arm64", "armv7", "armv6", "ppc64", "s390x"], TRIPLE_RE = /^(?:node(\d+)|(latest))-([a-z]+)-([a-z0-9]+)$/;
function parseTarget(triple) {
  let trimmed = triple.trim(), m = TRIPLE_RE.exec(trimmed);
  if (!m)
    throw new ValidationError(
      `Invalid target triple "${triple}". Expected node<N>-<os>-<arch> or latest-<os>-<arch>.`
    );
  let [, majorStr, latestLit, osRaw, archRaw] = m, node = latestLit !== void 0 ? "latest" : Number(majorStr);
  if (typeof node == "number" && (Number.isNaN(node) || node < 18))
    throw new ValidationError(
      `Target "${triple}" specifies Node ${String(node)} \u2014 only Node 18 and newer are supported by pkg.`
    );
  if (!osRaw || !archRaw)
    throw new ValidationError(`Invalid target triple "${triple}".`);
  if (!VALID_OS.includes(osRaw))
    throw new ValidationError(
      `Invalid target OS "${osRaw}" in "${triple}". Expected one of: ${VALID_OS.join(", ")}.`
    );
  if (!VALID_ARCH.includes(archRaw))
    throw new ValidationError(
      `Invalid target arch "${archRaw}" in "${triple}". Expected one of: ${VALID_ARCH.join(", ")}.`
    );
  return {
    node,
    os: osRaw,
    arch: archRaw
  };
}
function formatTarget(t) {
  return `${t.node === "latest" ? "latest" : `node${t.node}`}-${t.os}-${t.arch}`;
}
function parseTargetList(raw) {
  let pieces = raw.split(/[\n,]/).map((s) => s.trim()).filter((s) => s.length > 0), seen = /* @__PURE__ */ new Set(), result = [];
  for (let p of pieces) {
    let t = parseTarget(p), key = formatTarget(t);
    seen.has(key) || (seen.add(key), result.push(t));
  }
  return result;
}
var DEFAULT_RUNNER_LABELS = Object.freeze({
  "linux-x64": "ubuntu-latest",
  "linux-arm64": "ubuntu-24.04-arm",
  "linuxstatic-x64": "ubuntu-latest",
  "linuxstatic-arm64": "ubuntu-24.04-arm",
  "alpine-x64": "ubuntu-latest",
  "alpine-arm64": "ubuntu-24.04-arm",
  "macos-x64": "macos-13",
  "macos-arm64": "macos-latest",
  "win-x64": "windows-latest",
  "win-arm64": "windows-11-arm"
});
function hostTarget(platform2 = process.platform, arch2 = process.arch, nodeVersion = process.versions.node) {
  let os6;
  switch (platform2) {
    case "linux":
      os6 = "linux";
      break;
    case "darwin":
      os6 = "macos";
      break;
    case "win32":
      os6 = "win";
      break;
    default:
      throw new ValidationError(
        `Cannot auto-detect host target \u2014 unsupported platform "${platform2}".`
      );
  }
  let mappedArch;
  switch (arch2) {
    case "x64":
      mappedArch = "x64";
      break;
    case "arm64":
      mappedArch = "arm64";
      break;
    case "arm":
      mappedArch = "armv7";
      break;
    case "ppc64":
      mappedArch = "ppc64";
      break;
    case "s390x":
      mappedArch = "s390x";
      break;
    default:
      throw new ValidationError(`Cannot auto-detect host target \u2014 unsupported arch "${arch2}".`);
  }
  let nodeMajor = Number(nodeVersion.split(".")[0]);
  if (!Number.isFinite(nodeMajor))
    throw new ValidationError(`Cannot parse Node version "${nodeVersion}".`);
  return { node: nodeMajor, os: os6, arch: mappedArch };
}

// packages/core/src/templates.ts
var TEMPLATE_TOKEN_NAMES = [
  "name",
  "version",
  "target",
  "node",
  "os",
  "arch",
  "sha",
  "ref",
  "date",
  "tag"
], TOKEN_RE = /\{([a-zA-Z]+)\}/g;
function render(template, tokens) {
  return template.replace(TOKEN_RE, (full, name) => {
    if (!TEMPLATE_TOKEN_NAMES.includes(name)) {
      let suggestion = closestToken(name), hint = suggestion !== null ? ` Did you mean "{${suggestion}}"?` : "";
      throw new ValidationError(`Unknown template token "${full}".${hint}`);
    }
    let value = tokens[name];
    if (value === void 0)
      throw new ValidationError(`Template token "${full}" is undefined.`);
    return value;
  });
}
function closestToken(input) {
  let best = null, bestDist = 1 / 0;
  for (let candidate of TEMPLATE_TOKEN_NAMES) {
    let d = levenshtein(input.toLowerCase(), candidate);
    d < bestDist && (bestDist = d, best = candidate);
  }
  return bestDist <= 3 ? best : null;
}
function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array(b.length + 1), curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      let cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? 0;
}
function buildTokens(args) {
  let d = args.date ?? /* @__PURE__ */ new Date(), yyyymmdd = [
    d.getUTCFullYear().toString().padStart(4, "0"),
    (d.getUTCMonth() + 1).toString().padStart(2, "0"),
    d.getUTCDate().toString().padStart(2, "0")
  ].join("");
  return {
    name: args.name,
    version: args.version,
    target: args.target,
    node: args.node,
    os: args.os,
    arch: args.arch,
    sha: args.sha ?? "",
    ref: args.ref ?? "",
    date: yyyymmdd,
    tag: args.tag ?? ""
  };
}

// packages/core/src/checksum.ts
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { basename as basename3 } from "node:path";
import { pipeline } from "node:stream/promises";
var CHECKSUM_ALGORITHMS = ["sha256", "sha512", "md5"];
async function computeChecksum(filePath, algo) {
  let hash = createHash(algo);
  try {
    await pipeline(createReadStream(filePath, { highWaterMark: 64 * 1024 }), hash);
  } catch (err) {
    throw new ChecksumError(`Failed to hash ${filePath} with ${algo}`, { cause: err });
  }
  return hash.digest("hex");
}
async function writeShasumsFile(outPath, entries) {
  if (entries.length === 0)
    throw new ChecksumError(`Cannot write empty SHASUMS file to ${outPath}`);
  let body = [...entries].sort((a, b) => a.path.localeCompare(b.path)).map((e) => `${e.digest}  ${basename3(e.path)}`).join(`
`) + `
`;
  await atomicWriteFile(outPath, body);
}
async function writeSidecar(binaryPath, digest, algo) {
  let sidecar = `${binaryPath}.${algo}`, body = `${digest}  ${basename3(binaryPath)}
`;
  return await atomicWriteFile(sidecar, body), sidecar;
}
async function computeAllChecksums(filePath, algos) {
  let entries = await Promise.all(
    algos.map(async (a) => [a, await computeChecksum(filePath, a)])
  ), result = {};
  for (let [a, d] of entries) result[a] = d;
  return result;
}

// packages/core/src/inputs.ts
var INPUT_SPECS = [
  // Build configuration (§5.1)
  {
    name: "config",
    category: "build",
    description: "Path to a pkg config (.pkgrc, pkg.config.{js,ts,json}, or package.json). Auto-detected when omitted."
  },
  {
    name: "entry",
    category: "build",
    description: "Entry script when not specified in the config."
  },
  {
    name: "targets",
    category: "build",
    description: "Comma- or newline-separated pkg target triples, e.g. node22-linux-x64,node22-macos-arm64. Defaults to the host target."
  },
  {
    name: "mode",
    category: "build",
    description: "standard | sea \u2014 selects pkg Standard or SEA mode.",
    default: "standard"
  },
  {
    name: "node-version",
    category: "build",
    description: "pkg's bundled Node.js major (e.g. 22, 24). Does not affect the action's own Node runtime.",
    default: "22"
  },
  {
    name: "compress-node",
    category: "build",
    description: "pkg's bundled-binary compression: Brotli | GZip | Zstd | None. Zstd requires Node.js >= 22.15 on the build host.",
    default: "None"
  },
  {
    name: "fallback-to-source",
    category: "build",
    description: "Pass pkg --fallback-to-source for bytecode-fabricator failures.",
    default: "false"
  },
  {
    name: "public",
    category: "build",
    description: "Pass pkg --public (ships sources as plaintext).",
    default: "false"
  },
  {
    name: "public-packages",
    category: "build",
    description: "Comma-separated package names to mark public (pkg --public-packages)."
  },
  {
    name: "options",
    category: "build",
    description: "Comma-separated V8 options baked into the binary (pkg --options)."
  },
  {
    name: "no-bytecode",
    category: "build",
    description: "Pass pkg --no-bytecode.",
    default: "false"
  },
  {
    name: "no-dict",
    category: "build",
    description: "Comma-separated list of packages for pkg --no-dict (or * for all)."
  },
  { name: "debug", category: "build", description: "Pass pkg --debug.", default: "false" },
  {
    name: "extra-args",
    category: "build",
    description: "Raw extra flags appended to the pkg CLI invocation."
  },
  {
    name: "pkg-version",
    category: "build",
    description: "npm version specifier for @yao-pkg/pkg (e.g. ~6.16.0). Bypassed when pkg-path is set.",
    default: "~6.16.0"
  },
  {
    name: "pkg-path",
    category: "build",
    description: "Absolute path to a pre-installed pkg binary. Skips the implicit npm i -g."
  },
  // Post-build (§5.2)
  {
    name: "strip",
    category: "post-build",
    description: "Strip debug symbols on Linux/macOS outputs.",
    default: "false"
  },
  {
    name: "compress",
    category: "post-build",
    description: "Archive format: tar.gz | tar.xz | zip | 7z | none.",
    default: "none"
  },
  {
    name: "filename",
    category: "post-build",
    description: "Output filename template. Tokens: {name} {version} {target} {node} {os} {arch} {sha} {ref} {date} {tag}.",
    default: "{name}-{version}-{os}-{arch}"
  },
  {
    name: "checksum",
    category: "post-build",
    description: "Checksum algorithms: comma list of none | sha256 | sha512 | md5.",
    default: "sha256"
  },
  // Windows metadata (§5.3) — M3
  {
    name: "windows-metadata-file",
    category: "windows-metadata",
    description: "Path to a JSON file with any subset of the Windows metadata fields."
  },
  {
    name: "windows-icon",
    category: "windows-metadata",
    description: "Newline- or comma-separated list of <id>=<path> icon entries, or just <path> for id 1."
  },
  {
    name: "windows-product-name",
    category: "windows-metadata",
    description: "ProductName string."
  },
  {
    name: "windows-product-version",
    category: "windows-metadata",
    description: "ProductVersion (auto-padded to four parts)."
  },
  {
    name: "windows-file-version",
    category: "windows-metadata",
    description: "FileVersion (auto-padded to four parts)."
  },
  {
    name: "windows-file-description",
    category: "windows-metadata",
    description: "FileDescription string."
  },
  {
    name: "windows-company-name",
    category: "windows-metadata",
    description: "CompanyName string."
  },
  {
    name: "windows-legal-copyright",
    category: "windows-metadata",
    description: "LegalCopyright string (\xA9 auto-inserted if omitted)."
  },
  {
    name: "windows-original-filename",
    category: "windows-metadata",
    description: "OriginalFilename string. Defaults to the output basename."
  },
  {
    name: "windows-internal-name",
    category: "windows-metadata",
    description: "InternalName string."
  },
  { name: "windows-comments", category: "windows-metadata", description: "Comments string." },
  {
    name: "windows-manifest",
    category: "windows-metadata",
    description: "Path to a raw app.manifest file to embed as RT_MANIFEST."
  },
  {
    name: "windows-lang",
    category: "windows-metadata",
    description: "Language identifier for VersionInfo.",
    default: "1033"
  },
  {
    name: "windows-codepage",
    category: "windows-metadata",
    description: "Codepage for VersionInfo strings.",
    default: "1200"
  },
  // Signing & notarization (§5.4) — M4
  {
    name: "macos-sign-identity",
    category: "signing",
    description: "codesign identity (Common Name or SHA-1)."
  },
  {
    name: "macos-sign-certificate",
    category: "signing",
    description: "Base64-encoded .p12 certificate.",
    secret: !0
  },
  {
    name: "macos-keychain-password",
    category: "signing",
    description: "Password for the ephemeral keychain holding the signing identity.",
    secret: !0
  },
  {
    name: "macos-entitlements",
    category: "signing",
    description: "Path to an entitlements plist."
  },
  {
    name: "macos-notarize",
    category: "signing",
    description: "Run xcrun notarytool + staple after signing.",
    default: "false"
  },
  {
    name: "macos-apple-id",
    category: "signing",
    description: "Apple ID for notarytool.",
    secret: !0
  },
  {
    name: "macos-team-id",
    category: "signing",
    description: "Apple Team ID for notarytool.",
    secret: !0
  },
  {
    name: "macos-app-password",
    category: "signing",
    description: "App-specific password for notarytool.",
    secret: !0
  },
  {
    name: "windows-sign-mode",
    category: "signing",
    description: "none | signtool | trusted-signing.",
    default: "none"
  },
  {
    name: "windows-sign-cert",
    category: "signing",
    description: "Base64-encoded .pfx for signtool mode.",
    secret: !0
  },
  {
    name: "windows-sign-password",
    category: "signing",
    description: "Password for the .pfx.",
    secret: !0
  },
  {
    name: "windows-sign-rfc3161-url",
    category: "signing",
    description: "RFC3161 timestamp URL for signtool.",
    default: "http://timestamp.digicert.com"
  },
  {
    name: "windows-sign-description",
    category: "signing",
    description: "Description passed to signtool /d."
  },
  {
    name: "azure-tenant-id",
    category: "signing",
    description: "Azure Trusted Signing: tenant ID.",
    secret: !0
  },
  {
    name: "azure-client-id",
    category: "signing",
    description: "Azure Trusted Signing: client ID.",
    secret: !0
  },
  {
    name: "azure-client-secret",
    category: "signing",
    description: "Azure Trusted Signing: client secret.",
    secret: !0
  },
  {
    name: "azure-endpoint",
    category: "signing",
    description: "Azure Trusted Signing: endpoint URL."
  },
  {
    name: "azure-cert-profile",
    category: "signing",
    description: "Azure Trusted Signing: certificate profile name."
  },
  // Performance / observability (§5.6)
  {
    name: "cache",
    category: "performance",
    description: "Cache the pkg-fetch Node downloads between runs.",
    default: "true"
  },
  {
    name: "cache-key",
    category: "performance",
    description: "Override the auto-derived cache key."
  },
  {
    name: "step-summary",
    category: "performance",
    description: "Write a markdown summary of build time / size / checksum to the job summary.",
    default: "true"
  }
], SPEC_BY_NAME = new Map(
  INPUT_SPECS.map((s) => [s.name, s])
);
function specFor(name) {
  return SPEC_BY_NAME.get(name);
}
function readInputRaw(env, name) {
  let key = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`, raw = env[key];
  if (raw === void 0) return;
  let trimmed = raw.trim();
  return trimmed === "" ? void 0 : trimmed;
}
function readInput(env, name) {
  let raw = readInputRaw(env, name);
  return raw !== void 0 ? raw : specFor(name)?.default;
}
function parseBoolean(value, name) {
  if (value === void 0) return !1;
  let normalized = value.toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return !0;
  if (normalized === "false" || normalized === "0" || normalized === "no") return !1;
  throw new ValidationError(`Input "${name}" expected a boolean (true/false) but got "${value}".`);
}
function parseEnum(value, name, allowed) {
  if (value === void 0)
    throw new ValidationError(`Input "${name}" is required but not set.`);
  if (!allowed.includes(value))
    throw new ValidationError(
      `Input "${name}" must be one of ${allowed.join(" | ")}, got "${value}".`
    );
  return value;
}
function parseList(value) {
  return value === void 0 ? [] : value.split(/[\n,]/).map((s) => s.trim()).filter((s) => s.length > 0);
}
function parseChecksumList(value, name) {
  let items = parseList(value);
  if (items.length === 0 || items.length === 1 && items[0] === "none") return [];
  let result = [], seen = /* @__PURE__ */ new Set();
  for (let item of items) {
    if (item === "none")
      throw new ValidationError(`Input "${name}" cannot mix "none" with other algorithms.`);
    if (!CHECKSUM_ALGORITHMS.includes(item))
      throw new ValidationError(
        `Input "${name}" contains unknown algorithm "${item}". Expected: ${CHECKSUM_ALGORITHMS.join(", ")}.`
      );
    seen.has(item) || (seen.add(item), result.push(item));
  }
  return result;
}
function parseInputs(opts = {}) {
  let env = opts.env ?? process.env;
  for (let spec of INPUT_SPECS)
    if (spec.secret === !0) {
      let raw = readInputRaw(env, spec.name);
      raw !== void 0 && opts.registerSecret?.(raw);
    }
  let targetsRaw = readInput(env, "targets"), targets = targetsRaw === void 0 ? "host" : parseTargetList(targetsRaw);
  if (Array.isArray(targets) && targets.length === 0)
    throw new ValidationError('Input "targets" was set but resolved to an empty list.');
  let build = {
    config: readInput(env, "config"),
    entry: readInput(env, "entry"),
    targets,
    mode: parseEnum(readInput(env, "mode"), "mode", ["standard", "sea"]),
    nodeVersion: readInput(env, "node-version") ?? "22",
    compressNode: parseEnum(readInput(env, "compress-node"), "compress-node", [
      "Brotli",
      "GZip",
      "Zstd",
      "None"
    ]),
    fallbackToSource: parseBoolean(readInput(env, "fallback-to-source"), "fallback-to-source"),
    public: parseBoolean(readInput(env, "public"), "public"),
    publicPackages: parseList(readInput(env, "public-packages")),
    options: parseList(readInput(env, "options")),
    noBytecode: parseBoolean(readInput(env, "no-bytecode"), "no-bytecode"),
    noDict: parseList(readInput(env, "no-dict")),
    debug: parseBoolean(readInput(env, "debug"), "debug"),
    extraArgs: readInput(env, "extra-args"),
    pkgVersion: readInput(env, "pkg-version") ?? "~6.16.0",
    pkgPath: readInput(env, "pkg-path")
  }, postBuild = {
    strip: parseBoolean(readInput(env, "strip"), "strip"),
    compress: parseEnum(readInput(env, "compress"), "compress", [
      "tar.gz",
      "tar.xz",
      "zip",
      "7z",
      "none"
    ]),
    filename: readInput(env, "filename") ?? "{name}-{version}-{os}-{arch}",
    checksum: parseChecksumList(readInput(env, "checksum"), "checksum")
  }, performance2 = {
    cache: parseBoolean(readInput(env, "cache"), "cache"),
    cacheKey: readInput(env, "cache-key"),
    stepSummary: parseBoolean(readInput(env, "step-summary"), "step-summary")
  };
  if (opts.onUnknownInput !== void 0)
    for (let key of Object.keys(env)) {
      if (!key.startsWith("INPUT_")) continue;
      let kebab = key.slice(6).toLowerCase();
      SPEC_BY_NAME.has(kebab) || opts.onUnknownInput(kebab);
    }
  return { build, postBuild, performance: performance2 };
}
function closestInputName(input) {
  let best = null, bestDist = 1 / 0;
  for (let spec of INPUT_SPECS) {
    let d = levenshtein2(input.toLowerCase(), spec.name);
    d < bestDist && (bestDist = d, best = spec.name);
  }
  return bestDist <= 3 ? best : null;
}
function levenshtein2(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array(b.length + 1), curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      let cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? 0;
}

// packages/core/src/pkg-runner.ts
function buildPkgArgs(inv) {
  let args = [];
  if (inv.targets.length > 0 && args.push("--targets", inv.targets.map(formatTarget).join(",")), inv.build.config !== void 0 && args.push("--config", inv.build.config), inv.build.mode === "sea" && args.push("--sea"), inv.build.compressNode !== "None" && args.push("--compress", inv.build.compressNode), inv.build.fallbackToSource && args.push("--fallback-to-source"), inv.build.public && args.push("--public"), inv.build.publicPackages.length > 0 && args.push("--public-packages", inv.build.publicPackages.join(",")), inv.build.options.length > 0 && args.push("--options", inv.build.options.join(",")), inv.build.noBytecode && args.push("--no-bytecode"), inv.build.noDict.length > 0 && args.push("--no-dict", inv.build.noDict.join(",")), inv.build.debug && args.push("--debug"), args.push("--out-path", inv.outputDir), inv.build.extraArgs !== void 0 && inv.build.extraArgs.trim() !== "")
    for (let tok of inv.build.extraArgs.split(/\s+/).filter((s) => s.length > 0))
      args.push(tok);
  let entry = inv.build.entry ?? ".";
  return args.push(entry), args;
}
async function runPkg(inv, deps) {
  let args = buildPkgArgs(inv);
  deps.logger.info(`[pkg-action] Invoking: ${deps.pkgCommand} ${args.join(" ")}`);
  let result;
  try {
    result = await deps.exec(deps.pkgCommand, args, {
      ignoreReturnCode: !0,
      ...inv.cwd !== void 0 ? { cwd: inv.cwd } : {},
      ...inv.env !== void 0 ? { env: inv.env } : {}
    });
  } catch (err) {
    throw new PkgRunError(`Failed to spawn pkg: ${String(err)}`, { cause: err });
  }
  if (result.exitCode !== 0)
    throw new PkgRunError(`pkg exited with code ${String(result.exitCode)}. See stderr above.`);
  return result;
}

// packages/core/src/pkg-output-map.ts
import { access as access2, readdir as readdir2 } from "node:fs/promises";
import { join as join4 } from "node:path";
function predictOutputNames(targets, baseName) {
  if (targets.length === 0) return [];
  if (targets.length === 1) {
    let only = targets[0];
    return only ? [withWindowsSuffix(baseName, only)] : [];
  }
  let nodes = new Set(targets.map((t) => String(t.node))), oses = new Set(targets.map((t) => t.os)), archs = new Set(targets.map((t) => t.arch)), diverges = {
    node: nodes.size > 1,
    os: oses.size > 1,
    arch: archs.size > 1
  };
  return targets.map((t) => {
    let parts = [baseName];
    return diverges.node && parts.push(String(t.node)), diverges.os && parts.push(t.os), diverges.arch && parts.push(t.arch), withWindowsSuffix(parts.join("-"), t);
  });
}
function withWindowsSuffix(name, target) {
  return target.os === "win" && !name.toLowerCase().endsWith(".exe") ? `${name}.exe` : name;
}
async function mapPkgOutputs(targets, baseName, outputDir) {
  let predicted = predictOutputNames(targets, baseName), entries = [], unresolved = [];
  for (let i = 0; i < targets.length; i += 1) {
    let target = targets[i], name = predicted[i];
    if (target === void 0 || name === void 0) continue;
    let candidate = join4(outputDir, name);
    await exists2(candidate) ? entries.push({ target, path: candidate }) : unresolved.push({ target, predicted: name });
  }
  if (unresolved.length > 0) {
    let listing = await readdir2(outputDir);
    for (let { target, predicted: predictedName } of unresolved) {
      let match = findFallbackMatch(listing, target, predictedName);
      if (match === void 0)
        throw new PkgRunError(
          `pkg did not produce an output for ${formatTarget(target)}. Expected "${predictedName}" in ${outputDir}; directory contains: ${listing.join(", ") || "(empty)"}.`
        );
      entries.push({ target, path: join4(outputDir, match) });
    }
  }
  return entries;
}
function findFallbackMatch(listing, target, predicted) {
  if (listing.includes(predicted)) return predicted;
  let lower = predicted.toLowerCase(), ci = listing.find((f) => f.toLowerCase() === lower);
  if (ci !== void 0) return ci;
  let needle = `${target.os}-${target.arch}`;
  return listing.find((f) => f.toLowerCase().includes(needle.toLowerCase()));
}
async function exists2(path4) {
  try {
    return await access2(path4), !0;
  } catch {
    return !1;
  }
}

// packages/core/src/archive.ts
var import_yazl = __toESM(require_yazl(), 1);
import { createWriteStream } from "node:fs";
import { mkdtemp, rm as rm3, stat as stat3, symlink as symlink2, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename as basename4, dirname as dirname4 } from "node:path";
import { pipeline as pipeline2 } from "node:stream/promises";
async function archive(req, deps) {
  let entry = req.entryName ?? basename4(req.inputPath), mode = req.mode ?? 493;
  try {
    await stat3(req.inputPath);
  } catch (err) {
    throw new ArchiveError(`Archive input does not exist: ${req.inputPath}`, { cause: err });
  }
  switch (req.format) {
    case "tar.gz":
      return await shellTar(req.inputPath, req.outputPath, "gz", entry, deps), req.outputPath;
    case "tar.xz":
      return await shellTar(req.inputPath, req.outputPath, "xz", entry, deps), req.outputPath;
    case "zip":
      return await writeZip(req.inputPath, req.outputPath, entry, mode), req.outputPath;
    case "7z":
      return await shell7z(req.inputPath, req.outputPath, entry, deps), req.outputPath;
  }
}
var REPRO_MTIME = new Date(Date.UTC(2020, 0, 1, 0, 0, 0)), REPRO_MTIME_TAR = "2020-01-01 00:00:00 UTC";
async function shellTar(inputPath, outputPath, compression, entry, deps) {
  let compressFlag = compression === "gz" ? "-z" : "-J", stageDir, workDir = dirname4(inputPath), fileName = basename4(inputPath);
  if (entry !== basename4(inputPath)) {
    stageDir = await mkdtemp(`${tmpdir()}/pkgaction-tar-`);
    let linkPath = `${stageDir}/${entry}`;
    await symlink2(inputPath, linkPath), workDir = stageDir, fileName = entry;
  }
  await utimes(inputPath, REPRO_MTIME, REPRO_MTIME);
  let isLinux = process.platform === "linux", ownerFlags = isLinux ? ["--owner=0", "--group=0"] : ["--uid=0", "--gid=0"], mtimeFlags = isLinux ? ["--mtime", REPRO_MTIME_TAR] : [];
  try {
    let result = await deps.exec(
      "tar",
      [
        "-c",
        compressFlag,
        "-f",
        outputPath,
        ...mtimeFlags,
        ...ownerFlags,
        "--numeric-owner",
        "-C",
        workDir,
        fileName
      ],
      { ignoreReturnCode: !0 }
    );
    if (result.exitCode !== 0)
      throw new ArchiveError(
        `tar exited ${String(result.exitCode)} writing ${outputPath}. stderr: ${result.stderr.trim()}`
      );
  } finally {
    stageDir !== void 0 && await rm3(stageDir, { recursive: !0, force: !0 });
  }
}
async function writeZip(inputPath, outputPath, entry, mode) {
  let zipfile = new import_yazl.default.ZipFile();
  zipfile.addFile(inputPath, entry, { mode, mtime: REPRO_MTIME, compress: !0 }), zipfile.end();
  try {
    await pipeline2(zipfile.outputStream, createWriteStream(outputPath));
  } catch (err) {
    throw new ArchiveError(`Failed to write zip ${outputPath}`, { cause: err });
  }
}
async function shell7z(inputPath, outputPath, entry, deps) {
  let stageDir, workDir = dirname4(inputPath), fileName = basename4(inputPath);
  if (entry !== basename4(inputPath)) {
    stageDir = await mkdtemp(`${tmpdir()}/pkgaction-7z-`);
    let linkPath = `${stageDir}/${entry}`;
    await symlink2(inputPath, linkPath), workDir = stageDir, fileName = entry;
  }
  try {
    let result = await deps.exec("7z", ["a", "-bb0", outputPath, fileName], {
      cwd: workDir,
      ignoreReturnCode: !0
    });
    if (result.exitCode !== 0)
      throw new ArchiveError(
        `7z exited ${String(result.exitCode)} writing ${outputPath}. stderr: ${result.stderr.trim()}`
      );
  } finally {
    stageDir !== void 0 && await rm3(stageDir, { recursive: !0, force: !0 });
  }
}

// packages/core/src/summary.ts
import { appendFile as appendFile2 } from "node:fs/promises";
import { basename as basename5 } from "node:path";
function renderSummary(rows, opts = {}) {
  let parts = [];
  parts.push(`## ${opts.title ?? "pkg-action build summary"}`), parts.push("");
  let meta = [];
  if (opts.actionVersion !== void 0 && meta.push(`**action:** \`${opts.actionVersion}\``), opts.pkgVersion !== void 0 && meta.push(`**pkg:** \`${opts.pkgVersion}\``), meta.length > 0 && (parts.push(meta.join(" \xB7 ")), parts.push("")), rows.length === 0)
    return parts.push("_No binaries produced._"), parts.push(""), parts.join(`
`);
  let hasDuration = rows.some((r) => r.durationMs !== void 0), hasDigest = rows.some((r) => r.primaryDigest !== void 0), hasSigned = rows.some((r) => r.signed === !0), header = ["Target", "Filename", "Size"];
  hasDigest && header.push("SHA"), hasSigned && header.push("Signed"), hasDuration && header.push("Time");
  let sep2 = header.map(() => "---");
  parts.push(`| ${header.join(" | ")} |`), parts.push(`| ${sep2.join(" | ")} |`);
  for (let row of rows) {
    let cells = [
      `\`${row.target}\``,
      `\`${basename5(row.filename)}\``,
      formatBytes(row.sizeBytes)
    ];
    hasDigest && (row.primaryDigest !== void 0 ? cells.push(`\`${row.primaryDigest.algo}:${row.primaryDigest.value.slice(0, 12)}\u2026\``) : cells.push("\u2014")), hasSigned && cells.push(row.signed === !0 ? "\u2713" : "\u2014"), hasDuration && cells.push(row.durationMs !== void 0 ? formatDuration(row.durationMs) : "\u2014"), parts.push(`| ${cells.join(" | ")} |`);
  }
  return parts.push(""), parts.join(`
`);
}
async function writeSummary(rows, opts = {}, env = process.env) {
  let path4 = env.GITHUB_STEP_SUMMARY;
  if (path4 === void 0 || path4 === "") return !1;
  let markdown = renderSummary(rows, opts);
  return await appendFile2(path4, markdown), !0;
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  let units = ["KiB", "MiB", "GiB", "TiB"], v = bytes, i = -1;
  for (; v >= 1024 && i < units.length - 1; )
    v /= 1024, i += 1;
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}
function formatDuration(ms) {
  if (ms < 1e3) return `${ms} ms`;
  let s = ms / 1e3;
  if (s < 60) return `${s.toFixed(1)} s`;
  let m = Math.floor(s / 60), rem = s - m * 60;
  return `${m}m ${rem.toFixed(0)}s`;
}

// packages/core/src/project-info.ts
import { readFile } from "node:fs/promises";
import { join as join5 } from "node:path";
async function readProjectInfo(projectDir) {
  let path4 = join5(projectDir, "package.json"), raw;
  try {
    raw = await readFile(path4, "utf8");
  } catch (err) {
    throw new ValidationError(`Cannot read package.json at ${path4}`, { cause: err });
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ValidationError(`Invalid JSON in ${path4}`, { cause: err });
  }
  if (typeof parsed != "object" || parsed === null)
    throw new ValidationError(`package.json at ${path4} is not an object.`);
  let obj = parsed, name = obj.name, version = obj.version;
  if (typeof name != "string" || name === "")
    throw new ValidationError(`package.json at ${path4} is missing "name".`);
  if (typeof version != "string" || version === "")
    throw new ValidationError(`package.json at ${path4} is missing "version".`);
  return { name, version };
}
function tokensForTarget(target, project, env, nowDate = /* @__PURE__ */ new Date()) {
  let sha = (env.GITHUB_SHA ?? "").slice(0, 7), ref = env.GITHUB_REF_NAME ?? env.GITHUB_REF ?? "", tag = extractTag(env.GITHUB_REF), nodePart = target.node === "latest" ? "latest" : `node${String(target.node)}`;
  return buildTokens({
    name: project.name,
    version: project.version,
    target: formatTarget(target),
    node: nodePart,
    os: target.os,
    arch: target.arch,
    sha,
    ref,
    date: nowDate,
    tag: tag ?? ""
  });
}
function extractTag(githubRef) {
  if (githubRef === void 0) return;
  let prefix = "refs/tags/";
  if (!githubRef.startsWith(prefix)) return;
  let tag = githubRef.slice(prefix.length);
  return tag === "" ? void 0 : tag;
}

// packages/core/src/windows-metadata.ts
function parseIconSpec(raw) {
  let pieces = raw.split(/[\n,]/).map((s) => s.trim()).filter((s) => s.length > 0), byId = /* @__PURE__ */ new Map();
  for (let piece of pieces) {
    let eq = piece.indexOf("="), id, path4;
    if (eq === -1)
      id = 1, path4 = piece;
    else {
      let idRaw = piece.slice(0, eq);
      if (path4 = piece.slice(eq + 1).trim(), !/^\d+$/.test(idRaw))
        throw new ValidationError(
          `windows-icon entry "${piece}" has invalid id "${idRaw}" \u2014 expected a positive integer before "=".`
        );
      id = Number(idRaw);
    }
    if (!Number.isInteger(id) || id < 1 || id > 65535)
      throw new ValidationError(
        `windows-icon entry "${piece}" id ${String(id)} is out of range (1..65535).`
      );
    if (path4 === "")
      throw new ValidationError(`windows-icon entry "${piece}" is missing a path.`);
    byId.set(id, { id, path: path4 });
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
function padVersionQuad(raw) {
  let trimmed = raw.trim();
  if (!/^\d+(?:\.\d+){0,3}$/.test(trimmed))
    throw new ValidationError(
      `Version "${raw}" must match x[.y[.z[.w]]] with each part being a non-negative integer.`
    );
  let parts = trimmed.split(".").map((p) => Number(p));
  for (let n of parts)
    if (!Number.isInteger(n) || n < 0 || n > 65535)
      throw new ValidationError(
        `Version "${raw}" has component ${String(n)} out of uint16 range (0..65535).`
      );
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 0];
}
function mergeMetadataFile(env, file) {
  let fileIcons = normalizeFileIcons(file), icons = env.icons.length > 0 ? env.icons : fileIcons, pick = (envValue, fileValue) => envValue ?? fileValue, lang = env.lang ?? file?.lang ?? 1033, codepage = env.codepage ?? file?.codepage ?? 1200;
  if (!Number.isInteger(lang) || lang < 0 || lang > 65535)
    throw new ValidationError(`windows-lang must be a uint16, got ${String(lang)}.`);
  if (!Number.isInteger(codepage) || codepage < 0 || codepage > 65535)
    throw new ValidationError(`windows-codepage must be a uint16, got ${String(codepage)}.`);
  return {
    icons,
    productName: pick(env.productName, file?.productName),
    productVersion: pick(env.productVersion, file?.productVersion),
    fileVersion: pick(env.fileVersion, file?.fileVersion),
    fileDescription: pick(env.fileDescription, file?.fileDescription),
    companyName: pick(env.companyName, file?.companyName),
    legalCopyright: pick(env.legalCopyright, file?.legalCopyright),
    originalFilename: pick(env.originalFilename, file?.originalFilename),
    internalName: pick(env.internalName, file?.internalName),
    comments: pick(env.comments, file?.comments),
    manifestPath: pick(env.manifestPath, file?.manifest),
    lang,
    codepage
  };
}
function normalizeFileIcons(file) {
  if (file === void 0) return [];
  let out = /* @__PURE__ */ new Map();
  if (typeof file.icon == "string" && file.icon.trim() !== "" && out.set(1, { id: 1, path: file.icon.trim() }), Array.isArray(file.icons))
    for (let entry of file.icons) {
      if (typeof entry == "string") {
        let trimmed = entry.trim();
        if (trimmed === "") continue;
        out.set(1, { id: 1, path: trimmed });
        continue;
      }
      if (typeof entry == "object" && entry !== null && typeof entry.id == "number" && typeof entry.path == "string") {
        if (!Number.isInteger(entry.id) || entry.id < 1 || entry.id > 65535)
          throw new ValidationError(
            `windows-metadata-file: icon id ${String(entry.id)} is out of range (1..65535).`
          );
        let path4 = entry.path.trim();
        if (path4 === "")
          throw new ValidationError("windows-metadata-file: icon entry missing path.");
        out.set(entry.id, { id: entry.id, path: path4 });
        continue;
      }
      throw new ValidationError(
        `windows-metadata-file: icons[] entry is neither a string nor {id, path}: ${JSON.stringify(entry)}.`
      );
    }
  return [...out.values()].sort((a, b) => a.id - b.id);
}
async function parseWindowsMetadataInputs(opts = {}) {
  let env = opts.env ?? process.env, readFile3 = opts.readFile ?? ((path4) => import("node:fs/promises").then((m) => m.readFile(path4, "utf8"))), prefix = opts.prefix ?? "windows-", read = (name) => readInputRaw(env, `${prefix}${name}`), fileRaw = read("metadata-file"), iconRaw = read("icon"), productName = read("product-name"), productVersion = read("product-version"), fileVersion = read("file-version"), fileDescription = read("file-description"), companyName = read("company-name"), legalCopyright = read("legal-copyright"), originalFilename = read("original-filename"), internalName = read("internal-name"), comments = read("comments"), manifestPath = read("manifest"), langRaw = read("lang"), codepageRaw = read("codepage");
  if (!(fileRaw !== void 0 || iconRaw !== void 0 || productName !== void 0 || productVersion !== void 0 || fileVersion !== void 0 || fileDescription !== void 0 || companyName !== void 0 || legalCopyright !== void 0 || originalFilename !== void 0 || internalName !== void 0 || comments !== void 0 || manifestPath !== void 0)) return null;
  let fileData;
  if (fileRaw !== void 0) {
    let contents;
    try {
      contents = await readFile3(fileRaw);
    } catch (err) {
      throw new ValidationError(`Failed to read windows-metadata-file "${fileRaw}".`, {
        cause: err
      });
    }
    try {
      let parsed = JSON.parse(contents);
      if (parsed === null || typeof parsed != "object" || Array.isArray(parsed))
        throw new ValidationError(
          `windows-metadata-file "${fileRaw}" must contain a JSON object at the top level.`
        );
      fileData = parsed;
    } catch (err) {
      throw err instanceof ValidationError ? err : new ValidationError(
        `windows-metadata-file "${fileRaw}" is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  let envBag = {
    icons: iconRaw === void 0 ? [] : parseIconSpec(iconRaw),
    productName,
    productVersion,
    fileVersion,
    fileDescription,
    companyName,
    legalCopyright,
    originalFilename,
    internalName,
    comments,
    manifestPath,
    lang: langRaw === void 0 ? void 0 : parseUint16(langRaw, `${prefix}lang`),
    codepage: codepageRaw === void 0 ? void 0 : parseUint16(codepageRaw, `${prefix}codepage`)
  };
  return mergeMetadataFile(envBag, fileData);
}
function parseUint16(raw, inputName) {
  let n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 65535)
    throw new ValidationError(`${inputName} must be a uint16 integer, got "${raw}".`);
  return n;
}

// packages/core/src/windows-metadata-apply.ts
import { readFile as readFile2, writeFile as writeFile3 } from "node:fs/promises";

// node_modules/pe-library/dist/format/FormatBase.js
var FormatBase = (
  /** @class */
  (function() {
    function FormatBase2(view) {
      this.view = view;
    }
    return FormatBase2.prototype.copyTo = function(bin, offset) {
      new Uint8Array(bin, offset, this.view.byteLength).set(new Uint8Array(this.view.buffer, this.view.byteOffset, this.view.byteLength));
    }, Object.defineProperty(FormatBase2.prototype, "byteLength", {
      get: function() {
        return this.view.byteLength;
      },
      enumerable: !1,
      configurable: !0
    }), FormatBase2;
  })()
), FormatBase_default = FormatBase;

// node_modules/pe-library/dist/format/ArrayFormatBase.js
var __extends = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    return extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) Object.prototype.hasOwnProperty.call(b2, p) && (d2[p] = b2[p]);
    }, extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b != "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})(), ArrayFormatBase = (
  /** @class */
  (function(_super) {
    __extends(ArrayFormatBase2, _super);
    function ArrayFormatBase2(view) {
      return _super.call(this, view) || this;
    }
    return ArrayFormatBase2.prototype.forEach = function(callback) {
      var len = this.length, a = [];
      a.length = len;
      for (var i = 0; i < len; ++i)
        a[i] = this.get(i);
      for (var i = 0; i < len; ++i)
        callback(a[i], i, this);
    }, ArrayFormatBase2.prototype._iterator = function() {
      return new /** @class */
      ((function() {
        function class_1(base) {
          this.base = base, this.i = 0;
        }
        return class_1.prototype.next = function() {
          return this.i === this.base.length ? {
            value: void 0,
            done: !0
          } : {
            value: this.base.get(this.i++),
            done: !1
          };
        }, class_1;
      })())(this);
    }, ArrayFormatBase2;
  })(FormatBase_default)
);
typeof Symbol < "u" && (ArrayFormatBase.prototype[Symbol.iterator] = // eslint-disable-next-line @typescript-eslint/unbound-method
ArrayFormatBase.prototype._iterator);
var ArrayFormatBase_default = ArrayFormatBase;

// node_modules/pe-library/dist/format/ImageDataDirectoryArray.js
var __extends2 = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    return extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) Object.prototype.hasOwnProperty.call(b2, p) && (d2[p] = b2[p]);
    }, extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b != "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})(), ImageDataDirectoryArray = (
  /** @class */
  (function(_super) {
    __extends2(ImageDataDirectoryArray2, _super);
    function ImageDataDirectoryArray2(view) {
      var _this = _super.call(this, view) || this;
      return _this.length = 16, _this;
    }
    return ImageDataDirectoryArray2.from = function(bin, offset) {
      return offset === void 0 && (offset = 0), new ImageDataDirectoryArray2(new DataView(bin, offset, 128));
    }, ImageDataDirectoryArray2.prototype.get = function(index) {
      return {
        virtualAddress: this.view.getUint32(index * 8, !0),
        size: this.view.getUint32(4 + index * 8, !0)
      };
    }, ImageDataDirectoryArray2.prototype.set = function(index, data) {
      this.view.setUint32(index * 8, data.virtualAddress, !0), this.view.setUint32(4 + index * 8, data.size, !0);
    }, ImageDataDirectoryArray2.prototype.findIndexByVirtualAddress = function(virtualAddress) {
      for (var i = 0; i < 16; ++i) {
        var va = this.view.getUint32(i * 8, !0), vs = this.view.getUint32(4 + i * 8, !0);
        if (virtualAddress >= va && virtualAddress < va + vs)
          return i;
      }
      return null;
    }, ImageDataDirectoryArray2.size = 128, ImageDataDirectoryArray2.itemSize = 8, ImageDataDirectoryArray2;
  })(ArrayFormatBase_default)
), ImageDataDirectoryArray_default = ImageDataDirectoryArray;

// node_modules/pe-library/dist/format/ImageDirectoryEntry.js
var ImageDirectoryEntry = {
  Export: 0,
  Import: 1,
  Resource: 2,
  Exception: 3,
  Certificate: 4,
  Security: 4,
  BaseRelocation: 5,
  Debug: 6,
  Architecture: 7,
  GlobalPointer: 8,
  Tls: 9,
  TLS: 9,
  LoadConfig: 10,
  BoundImport: 11,
  Iat: 12,
  IAT: 12,
  DelayImport: 13,
  ComDescriptor: 14,
  COMDescriptor: 14
  // alias
}, ImageDirectoryEntry_default = ImageDirectoryEntry;

// node_modules/pe-library/dist/util/functions.js
function cloneObject(object) {
  var r = {};
  return Object.keys(object).forEach(function(key) {
    r[key] = object[key];
  }), r;
}
function createDataView(bin, byteOffset, byteLength) {
  if ("buffer" in bin) {
    var newOffset = bin.byteOffset, newLength = bin.byteLength;
    return typeof byteOffset < "u" && (newOffset += byteOffset, newLength -= byteOffset), typeof byteLength < "u" && (newLength = byteLength), new DataView(bin.buffer, newOffset, newLength);
  } else
    return new DataView(bin, byteOffset, byteLength);
}
function calculateCheckSumForPE(bin, storeToBinary) {
  for (var dosHeader = ImageDosHeader_default.from(bin), view = new DataView(bin), checkSumOffset = dosHeader.newHeaderAddress + 88, result = 0, limit = 4294967296, update = function(dword) {
    result += dword, result >= limit && (result = result % limit + (result / limit | 0));
  }, len = view.byteLength, lenExtra = len % 4, lenAlign = len - lenExtra, i = 0; i < lenAlign; i += 4)
    i !== checkSumOffset && update(view.getUint32(i, !0));
  if (lenExtra !== 0) {
    for (var extra = 0, i = 0; i < lenExtra; i++)
      extra |= view.getUint8(lenAlign + i) << (3 - i) * 8;
    update(extra);
  }
  return result = (result & 65535) + (result >>> 16), result += result >>> 16, result = (result & 65535) + len, storeToBinary && view.setUint32(checkSumOffset, result, !0), result;
}
function roundUp(val, align) {
  return Math.floor((val + align - 1) / align) * align;
}
function copyBuffer(dest, destOffset, src, srcOffset, length) {
  var ua8Dest = "buffer" in dest ? new Uint8Array(dest.buffer, dest.byteOffset + (destOffset || 0), length) : new Uint8Array(dest, destOffset, length), ua8Src = "buffer" in src ? new Uint8Array(src.buffer, src.byteOffset + (srcOffset || 0), length) : new Uint8Array(src, srcOffset, length);
  ua8Dest.set(ua8Src);
}
function allocatePartialBinary(binBase, offset, length) {
  var b = new ArrayBuffer(length);
  return copyBuffer(b, 0, binBase, offset, length), b;
}
function cloneToArrayBuffer(binBase) {
  if ("buffer" in binBase) {
    var b = new ArrayBuffer(binBase.byteLength);
    return new Uint8Array(b).set(new Uint8Array(binBase.buffer, binBase.byteOffset, binBase.byteLength)), b;
  } else {
    var b = new ArrayBuffer(binBase.byteLength);
    return new Uint8Array(b).set(new Uint8Array(binBase)), b;
  }
}
function getFixedString(view, offset, length) {
  for (var actualLen = 0, i = 0; i < length && view.getUint8(offset + i) !== 0; ++i)
    ++actualLen;
  if (typeof Buffer < "u")
    return Buffer.from(view.buffer, view.byteOffset + offset, actualLen).toString("utf8");
  if (typeof decodeURIComponent < "u") {
    for (var s = "", i = 0; i < actualLen; ++i) {
      var c = view.getUint8(offset + i);
      c < 16 ? s += "%0" + c.toString(16) : s += "%" + c.toString(16);
    }
    return decodeURIComponent(s);
  } else {
    for (var s = "", i = 0; i < actualLen; ++i) {
      var c = view.getUint8(offset + i);
      s += String.fromCharCode(c);
    }
    return s;
  }
}
function setFixedString(view, offset, length, text) {
  if (typeof Buffer < "u") {
    var u = new Uint8Array(view.buffer, view.byteOffset + offset, length);
    u.set(new Uint8Array(length)), u.set(Buffer.from(text, "utf8").subarray(0, length));
  } else if (typeof encodeURIComponent < "u")
    for (var s = encodeURIComponent(text), i = 0, j = 0; i < length; ++i)
      if (j >= s.length)
        view.setUint8(i + offset, 0);
      else {
        var c = s.charCodeAt(j);
        if (c === 37) {
          var n = parseInt(s.substr(j + 1, 2), 16);
          typeof n == "number" && !isNaN(n) ? view.setUint8(i + offset, n) : view.setUint8(i + offset, 0), j += 3;
        } else
          view.setUint8(i + offset, c);
      }
  else
    for (var i = 0, j = 0; i < length; ++i)
      if (j >= text.length)
        view.setUint8(i + offset, 0);
      else {
        var c = text.charCodeAt(j);
        view.setUint8(i + offset, c & 255);
      }
}
function binaryToString(bin) {
  if (typeof TextDecoder < "u") {
    var dec = new TextDecoder();
    return dec.decode(bin);
  } else if (typeof Buffer < "u") {
    var b = void 0;
    return "buffer" in bin ? b = Buffer.from(bin.buffer, bin.byteOffset, bin.byteLength) : b = Buffer.from(bin), b.toString("utf8");
  } else {
    var view = void 0;
    if ("buffer" in bin ? view = new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength) : view = new Uint8Array(bin), typeof decodeURIComponent < "u") {
      for (var s = "", i = 0; i < view.length; ++i) {
        var c = view[i];
        c < 16 ? s += "%0" + c.toString(16) : s += "%" + c.toString(16);
      }
      return decodeURIComponent(s);
    } else {
      for (var s = "", i = 0; i < view.length; ++i) {
        var c = view[i];
        s += String.fromCharCode(c);
      }
      return s;
    }
  }
}
function stringToBinary(string) {
  if (typeof TextEncoder < "u") {
    var enc = new TextEncoder();
    return cloneToArrayBuffer(enc.encode(string));
  } else {
    if (typeof Buffer < "u")
      return cloneToArrayBuffer(Buffer.from(string, "utf8"));
    if (typeof encodeURIComponent < "u") {
      for (var data = encodeURIComponent(string), len = 0, i = 0; i < data.length; ++len) {
        var c = data.charCodeAt(i);
        c === 37 ? i += 3 : ++i;
      }
      for (var bin = new ArrayBuffer(len), view = new Uint8Array(bin), i = 0, j = 0; i < data.length; ++j) {
        var c = data.charCodeAt(i);
        if (c === 37) {
          var n = parseInt(data.substring(i + 1, i + 3), 16);
          view[j] = n, i += 3;
        } else
          view[j] = c, ++i;
      }
      return bin;
    } else {
      var bin = new ArrayBuffer(string.length);
      return new Uint8Array(bin).set([].map.call(string, function(c2) {
        return c2.charCodeAt(0);
      })), bin;
    }
  }
}

// node_modules/pe-library/dist/format/ImageDosHeader.js
var __extends3 = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    return extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) Object.prototype.hasOwnProperty.call(b2, p) && (d2[p] = b2[p]);
    }, extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b != "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})(), ImageDosHeader = (
  /** @class */
  (function(_super) {
    __extends3(ImageDosHeader2, _super);
    function ImageDosHeader2(view) {
      return _super.call(this, view) || this;
    }
    return ImageDosHeader2.from = function(bin, offset) {
      return offset === void 0 && (offset = 0), new ImageDosHeader2(createDataView(bin, offset, 64));
    }, ImageDosHeader2.prototype.isValid = function() {
      return this.magic === ImageDosHeader2.DEFAULT_MAGIC;
    }, Object.defineProperty(ImageDosHeader2.prototype, "magic", {
      get: function() {
        return this.view.getUint16(0, !0);
      },
      set: function(val) {
        this.view.setUint16(0, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "lastPageSize", {
      get: function() {
        return this.view.getUint16(2, !0);
      },
      set: function(val) {
        this.view.setUint16(2, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "pages", {
      get: function() {
        return this.view.getUint16(4, !0);
      },
      set: function(val) {
        this.view.setUint16(4, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "relocations", {
      get: function() {
        return this.view.getUint16(6, !0);
      },
      set: function(val) {
        this.view.setUint16(6, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "headerSizeInParagraph", {
      get: function() {
        return this.view.getUint16(8, !0);
      },
      set: function(val) {
        this.view.setUint16(8, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "minAllocParagraphs", {
      get: function() {
        return this.view.getUint16(10, !0);
      },
      set: function(val) {
        this.view.setUint16(10, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "maxAllocParagraphs", {
      get: function() {
        return this.view.getUint16(12, !0);
      },
      set: function(val) {
        this.view.setUint16(12, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "initialSS", {
      get: function() {
        return this.view.getUint16(14, !0);
      },
      set: function(val) {
        this.view.setUint16(14, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "initialSP", {
      get: function() {
        return this.view.getUint16(16, !0);
      },
      set: function(val) {
        this.view.setUint16(16, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "checkSum", {
      get: function() {
        return this.view.getUint16(18, !0);
      },
      set: function(val) {
        this.view.setUint16(18, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "initialIP", {
      get: function() {
        return this.view.getUint16(20, !0);
      },
      set: function(val) {
        this.view.setUint16(20, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "initialCS", {
      get: function() {
        return this.view.getUint16(22, !0);
      },
      set: function(val) {
        this.view.setUint16(22, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "relocationTableAddress", {
      get: function() {
        return this.view.getUint16(24, !0);
      },
      set: function(val) {
        this.view.setUint16(24, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "overlayNum", {
      get: function() {
        return this.view.getUint16(26, !0);
      },
      set: function(val) {
        this.view.setUint16(26, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "oemId", {
      // WORD e_res[4] (28,30,32,34)
      get: function() {
        return this.view.getUint16(36, !0);
      },
      set: function(val) {
        this.view.setUint16(36, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "oemInfo", {
      get: function() {
        return this.view.getUint16(38, !0);
      },
      set: function(val) {
        this.view.setUint16(38, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageDosHeader2.prototype, "newHeaderAddress", {
      // WORD e_res2[10] (40,42,44,46,48,50,52,54,56,58)
      get: function() {
        return this.view.getUint32(60, !0);
      },
      set: function(val) {
        this.view.setUint32(60, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), ImageDosHeader2.size = 64, ImageDosHeader2.DEFAULT_MAGIC = 23117, ImageDosHeader2;
  })(FormatBase_default)
), ImageDosHeader_default = ImageDosHeader;

// node_modules/pe-library/dist/format/ImageFileHeader.js
var __extends4 = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    return extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) Object.prototype.hasOwnProperty.call(b2, p) && (d2[p] = b2[p]);
    }, extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b != "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})(), ImageFileHeader = (
  /** @class */
  (function(_super) {
    __extends4(ImageFileHeader2, _super);
    function ImageFileHeader2(view) {
      return _super.call(this, view) || this;
    }
    return ImageFileHeader2.from = function(bin, offset) {
      return offset === void 0 && (offset = 0), new ImageFileHeader2(new DataView(bin, offset, 20));
    }, Object.defineProperty(ImageFileHeader2.prototype, "machine", {
      get: function() {
        return this.view.getUint16(0, !0);
      },
      set: function(val) {
        this.view.setUint16(0, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageFileHeader2.prototype, "numberOfSections", {
      get: function() {
        return this.view.getUint16(2, !0);
      },
      set: function(val) {
        this.view.setUint16(2, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageFileHeader2.prototype, "timeDateStamp", {
      get: function() {
        return this.view.getUint32(4, !0);
      },
      set: function(val) {
        this.view.setUint32(4, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageFileHeader2.prototype, "pointerToSymbolTable", {
      get: function() {
        return this.view.getUint32(8, !0);
      },
      set: function(val) {
        this.view.setUint32(8, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageFileHeader2.prototype, "numberOfSymbols", {
      get: function() {
        return this.view.getUint32(12, !0);
      },
      set: function(val) {
        this.view.setUint32(12, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageFileHeader2.prototype, "sizeOfOptionalHeader", {
      get: function() {
        return this.view.getUint16(16, !0);
      },
      set: function(val) {
        this.view.setUint16(16, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageFileHeader2.prototype, "characteristics", {
      get: function() {
        return this.view.getUint16(18, !0);
      },
      set: function(val) {
        this.view.setUint16(18, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), ImageFileHeader2.size = 20, ImageFileHeader2;
  })(FormatBase_default)
), ImageFileHeader_default = ImageFileHeader;

// node_modules/pe-library/dist/format/ImageOptionalHeader.js
var __extends5 = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    return extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) Object.prototype.hasOwnProperty.call(b2, p) && (d2[p] = b2[p]);
    }, extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b != "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})(), ImageOptionalHeader = (
  /** @class */
  (function(_super) {
    __extends5(ImageOptionalHeader2, _super);
    function ImageOptionalHeader2(view) {
      return _super.call(this, view) || this;
    }
    return ImageOptionalHeader2.from = function(bin, offset) {
      return offset === void 0 && (offset = 0), new ImageOptionalHeader2(new DataView(bin, offset, 96));
    }, Object.defineProperty(ImageOptionalHeader2.prototype, "magic", {
      get: function() {
        return this.view.getUint16(0, !0);
      },
      set: function(val) {
        this.view.setUint16(0, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "majorLinkerVersion", {
      get: function() {
        return this.view.getUint8(2);
      },
      set: function(val) {
        this.view.setUint8(2, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "minorLinkerVersion", {
      get: function() {
        return this.view.getUint8(3);
      },
      set: function(val) {
        this.view.setUint8(3, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfCode", {
      get: function() {
        return this.view.getUint32(4, !0);
      },
      set: function(val) {
        this.view.setUint32(4, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfInitializedData", {
      get: function() {
        return this.view.getUint32(8, !0);
      },
      set: function(val) {
        this.view.setUint32(8, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfUninitializedData", {
      get: function() {
        return this.view.getUint32(12, !0);
      },
      set: function(val) {
        this.view.setUint32(12, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "addressOfEntryPoint", {
      get: function() {
        return this.view.getUint32(16, !0);
      },
      set: function(val) {
        this.view.setUint32(16, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "baseOfCode", {
      get: function() {
        return this.view.getUint32(20, !0);
      },
      set: function(val) {
        this.view.setUint32(20, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "baseOfData", {
      get: function() {
        return this.view.getUint32(24, !0);
      },
      set: function(val) {
        this.view.setUint32(24, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "imageBase", {
      get: function() {
        return this.view.getUint32(28, !0);
      },
      set: function(val) {
        this.view.setUint32(28, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "sectionAlignment", {
      get: function() {
        return this.view.getUint32(32, !0);
      },
      set: function(val) {
        this.view.setUint32(32, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "fileAlignment", {
      get: function() {
        return this.view.getUint32(36, !0);
      },
      set: function(val) {
        this.view.setUint32(36, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "majorOperatingSystemVersion", {
      get: function() {
        return this.view.getUint16(40, !0);
      },
      set: function(val) {
        this.view.setUint16(40, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "minorOperatingSystemVersion", {
      get: function() {
        return this.view.getUint16(42, !0);
      },
      set: function(val) {
        this.view.setUint16(42, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "majorImageVersion", {
      get: function() {
        return this.view.getUint16(44, !0);
      },
      set: function(val) {
        this.view.setUint16(44, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "minorImageVersion", {
      get: function() {
        return this.view.getUint16(46, !0);
      },
      set: function(val) {
        this.view.setUint16(46, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "majorSubsystemVersion", {
      get: function() {
        return this.view.getUint16(48, !0);
      },
      set: function(val) {
        this.view.setUint16(48, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "minorSubsystemVersion", {
      get: function() {
        return this.view.getUint16(50, !0);
      },
      set: function(val) {
        this.view.setUint16(50, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "win32VersionValue", {
      get: function() {
        return this.view.getUint32(52, !0);
      },
      set: function(val) {
        this.view.setUint32(52, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfImage", {
      get: function() {
        return this.view.getUint32(56, !0);
      },
      set: function(val) {
        this.view.setUint32(56, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfHeaders", {
      get: function() {
        return this.view.getUint32(60, !0);
      },
      set: function(val) {
        this.view.setUint32(60, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "checkSum", {
      get: function() {
        return this.view.getUint32(64, !0);
      },
      set: function(val) {
        this.view.setUint32(64, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "subsystem", {
      get: function() {
        return this.view.getUint16(68, !0);
      },
      set: function(val) {
        this.view.setUint16(68, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "dllCharacteristics", {
      get: function() {
        return this.view.getUint16(70, !0);
      },
      set: function(val) {
        this.view.setUint16(70, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfStackReserve", {
      get: function() {
        return this.view.getUint32(72, !0);
      },
      set: function(val) {
        this.view.setUint32(72, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfStackCommit", {
      get: function() {
        return this.view.getUint32(76, !0);
      },
      set: function(val) {
        this.view.setUint32(76, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfHeapReserve", {
      get: function() {
        return this.view.getUint32(80, !0);
      },
      set: function(val) {
        this.view.setUint32(80, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "sizeOfHeapCommit", {
      get: function() {
        return this.view.getUint32(84, !0);
      },
      set: function(val) {
        this.view.setUint32(84, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "loaderFlags", {
      get: function() {
        return this.view.getUint32(88, !0);
      },
      set: function(val) {
        this.view.setUint32(88, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader2.prototype, "numberOfRvaAndSizes", {
      get: function() {
        return this.view.getUint32(92, !0);
      },
      set: function(val) {
        this.view.setUint32(92, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), ImageOptionalHeader2.size = 96, ImageOptionalHeader2.DEFAULT_MAGIC = 267, ImageOptionalHeader2;
  })(FormatBase_default)
), ImageOptionalHeader_default = ImageOptionalHeader;

// node_modules/pe-library/dist/format/ImageOptionalHeader64.js
var __extends6 = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    return extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) Object.prototype.hasOwnProperty.call(b2, p) && (d2[p] = b2[p]);
    }, extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b != "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})();
function getUint64LE(view, offset) {
  return view.getUint32(offset + 4, !0) * 4294967296 + view.getUint32(offset, !0);
}
function setUint64LE(view, offset, val) {
  view.setUint32(offset, val & 4294967295, !0), view.setUint32(offset + 4, Math.floor(val / 4294967296), !0);
}
function getUint64LEBigInt(view, offset) {
  if (typeof BigInt > "u")
    throw new Error("BigInt not supported");
  return BigInt(4294967296) * BigInt(view.getUint32(offset + 4, !0)) + BigInt(view.getUint32(offset, !0));
}
function setUint64LEBigInt(view, offset, val) {
  if (typeof BigInt > "u")
    throw new Error("BigInt not supported");
  view.setUint32(offset, Number(val & BigInt(4294967295)), !0), view.setUint32(offset + 4, Math.floor(Number(val / BigInt(4294967296) & BigInt(4294967295))), !0);
}
var ImageOptionalHeader64 = (
  /** @class */
  (function(_super) {
    __extends6(ImageOptionalHeader642, _super);
    function ImageOptionalHeader642(view) {
      return _super.call(this, view) || this;
    }
    return ImageOptionalHeader642.from = function(bin, offset) {
      return offset === void 0 && (offset = 0), new ImageOptionalHeader642(new DataView(bin, offset, 112));
    }, Object.defineProperty(ImageOptionalHeader642.prototype, "magic", {
      get: function() {
        return this.view.getUint16(0, !0);
      },
      set: function(val) {
        this.view.setUint16(0, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "majorLinkerVersion", {
      get: function() {
        return this.view.getUint8(2);
      },
      set: function(val) {
        this.view.setUint8(2, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "minorLinkerVersion", {
      get: function() {
        return this.view.getUint8(3);
      },
      set: function(val) {
        this.view.setUint8(3, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfCode", {
      get: function() {
        return this.view.getUint32(4, !0);
      },
      set: function(val) {
        this.view.setUint32(4, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfInitializedData", {
      get: function() {
        return this.view.getUint32(8, !0);
      },
      set: function(val) {
        this.view.setUint32(8, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfUninitializedData", {
      get: function() {
        return this.view.getUint32(12, !0);
      },
      set: function(val) {
        this.view.setUint32(12, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "addressOfEntryPoint", {
      get: function() {
        return this.view.getUint32(16, !0);
      },
      set: function(val) {
        this.view.setUint32(16, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "baseOfCode", {
      get: function() {
        return this.view.getUint32(20, !0);
      },
      set: function(val) {
        this.view.setUint32(20, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "imageBase", {
      get: function() {
        return getUint64LE(this.view, 24);
      },
      set: function(val) {
        setUint64LE(this.view, 24, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "imageBaseBigInt", {
      get: function() {
        return getUint64LEBigInt(this.view, 24);
      },
      set: function(val) {
        setUint64LEBigInt(this.view, 24, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sectionAlignment", {
      get: function() {
        return this.view.getUint32(32, !0);
      },
      set: function(val) {
        this.view.setUint32(32, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "fileAlignment", {
      get: function() {
        return this.view.getUint32(36, !0);
      },
      set: function(val) {
        this.view.setUint32(36, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "majorOperatingSystemVersion", {
      get: function() {
        return this.view.getUint16(40, !0);
      },
      set: function(val) {
        this.view.setUint16(40, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "minorOperatingSystemVersion", {
      get: function() {
        return this.view.getUint16(42, !0);
      },
      set: function(val) {
        this.view.setUint16(42, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "majorImageVersion", {
      get: function() {
        return this.view.getUint16(44, !0);
      },
      set: function(val) {
        this.view.setUint16(44, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "minorImageVersion", {
      get: function() {
        return this.view.getUint16(46, !0);
      },
      set: function(val) {
        this.view.setUint16(46, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "majorSubsystemVersion", {
      get: function() {
        return this.view.getUint16(48, !0);
      },
      set: function(val) {
        this.view.setUint16(48, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "minorSubsystemVersion", {
      get: function() {
        return this.view.getUint16(50, !0);
      },
      set: function(val) {
        this.view.setUint16(50, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "win32VersionValue", {
      get: function() {
        return this.view.getUint32(52, !0);
      },
      set: function(val) {
        this.view.setUint32(52, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfImage", {
      get: function() {
        return this.view.getUint32(56, !0);
      },
      set: function(val) {
        this.view.setUint32(56, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfHeaders", {
      get: function() {
        return this.view.getUint32(60, !0);
      },
      set: function(val) {
        this.view.setUint32(60, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "checkSum", {
      get: function() {
        return this.view.getUint32(64, !0);
      },
      set: function(val) {
        this.view.setUint32(64, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "subsystem", {
      get: function() {
        return this.view.getUint16(68, !0);
      },
      set: function(val) {
        this.view.setUint16(68, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "dllCharacteristics", {
      get: function() {
        return this.view.getUint16(70, !0);
      },
      set: function(val) {
        this.view.setUint16(70, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfStackReserve", {
      get: function() {
        return getUint64LE(this.view, 72);
      },
      set: function(val) {
        setUint64LE(this.view, 72, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfStackReserveBigInt", {
      get: function() {
        return getUint64LEBigInt(this.view, 72);
      },
      set: function(val) {
        setUint64LEBigInt(this.view, 72, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfStackCommit", {
      get: function() {
        return getUint64LE(this.view, 80);
      },
      set: function(val) {
        setUint64LE(this.view, 80, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfStackCommitBigInt", {
      get: function() {
        return getUint64LEBigInt(this.view, 80);
      },
      set: function(val) {
        setUint64LEBigInt(this.view, 80, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfHeapReserve", {
      get: function() {
        return getUint64LE(this.view, 88);
      },
      set: function(val) {
        setUint64LE(this.view, 88, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfHeapReserveBigInt", {
      get: function() {
        return getUint64LEBigInt(this.view, 88);
      },
      set: function(val) {
        setUint64LEBigInt(this.view, 88, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfHeapCommit", {
      get: function() {
        return getUint64LE(this.view, 96);
      },
      set: function(val) {
        setUint64LE(this.view, 96, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "sizeOfHeapCommitBigInt", {
      get: function() {
        return getUint64LEBigInt(this.view, 96);
      },
      set: function(val) {
        setUint64LEBigInt(this.view, 96, val);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "loaderFlags", {
      get: function() {
        return this.view.getUint32(104, !0);
      },
      set: function(val) {
        this.view.setUint32(104, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageOptionalHeader642.prototype, "numberOfRvaAndSizes", {
      get: function() {
        return this.view.getUint32(108, !0);
      },
      set: function(val) {
        this.view.setUint32(108, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), ImageOptionalHeader642.size = 112, ImageOptionalHeader642.DEFAULT_MAGIC = 523, ImageOptionalHeader642;
  })(FormatBase_default)
), ImageOptionalHeader64_default = ImageOptionalHeader64;

// node_modules/pe-library/dist/format/ImageNtHeaders.js
var __extends7 = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    return extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) Object.prototype.hasOwnProperty.call(b2, p) && (d2[p] = b2[p]);
    }, extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b != "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})(), ImageNtHeaders = (
  /** @class */
  (function(_super) {
    __extends7(ImageNtHeaders2, _super);
    function ImageNtHeaders2(view) {
      return _super.call(this, view) || this;
    }
    return ImageNtHeaders2.from = function(bin, offset) {
      offset === void 0 && (offset = 0);
      var magic = createDataView(bin, offset + ImageFileHeader_default.size, 6).getUint16(4, !0), len = 4 + ImageFileHeader_default.size + ImageDataDirectoryArray_default.size;
      return magic === ImageOptionalHeader64_default.DEFAULT_MAGIC ? len += ImageOptionalHeader64_default.size : len += ImageOptionalHeader_default.size, new ImageNtHeaders2(createDataView(bin, offset, len));
    }, ImageNtHeaders2.prototype.isValid = function() {
      return this.signature === ImageNtHeaders2.DEFAULT_SIGNATURE;
    }, ImageNtHeaders2.prototype.is32bit = function() {
      return this.view.getUint16(ImageFileHeader_default.size + 4, !0) === ImageOptionalHeader_default.DEFAULT_MAGIC;
    }, Object.defineProperty(ImageNtHeaders2.prototype, "signature", {
      get: function() {
        return this.view.getUint32(0, !0);
      },
      set: function(val) {
        this.view.setUint32(0, val, !0);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageNtHeaders2.prototype, "fileHeader", {
      get: function() {
        return ImageFileHeader_default.from(this.view.buffer, this.view.byteOffset + 4);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageNtHeaders2.prototype, "optionalHeader", {
      get: function() {
        var off = ImageFileHeader_default.size + 4, magic = this.view.getUint16(off, !0);
        return magic === ImageOptionalHeader64_default.DEFAULT_MAGIC ? ImageOptionalHeader64_default.from(this.view.buffer, this.view.byteOffset + off) : ImageOptionalHeader_default.from(this.view.buffer, this.view.byteOffset + off);
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(ImageNtHeaders2.prototype, "optionalHeaderDataDirectory", {
      get: function() {
        return ImageDataDirectoryArray_default.from(this.view.buffer, this.view.byteOffset + this.getDataDirectoryOffset());
      },
      enumerable: !1,
      configurable: !0
    }), ImageNtHeaders2.prototype.getDataDirectoryOffset = function() {
      var off = ImageFileHeader_default.size + 4, magic = this.view.getUint16(off, !0);
      return magic === ImageOptionalHeader64_default.DEFAULT_MAGIC ? off += ImageOptionalHeader64_default.size : off += ImageOptionalHeader_default.size, off;
    }, ImageNtHeaders2.prototype.getSectionHeaderOffset = function() {
      return this.getDataDirectoryOffset() + ImageDataDirectoryArray_default.size;
    }, ImageNtHeaders2.DEFAULT_SIGNATURE = 17744, ImageNtHeaders2;
  })(FormatBase_default)
), ImageNtHeaders_default = ImageNtHeaders;

// node_modules/pe-library/dist/format/ImageSectionHeaderArray.js
var __extends8 = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    return extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) Object.prototype.hasOwnProperty.call(b2, p) && (d2[p] = b2[p]);
    }, extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b != "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})(), ImageSectionHeaderArray = (
  /** @class */
  (function(_super) {
    __extends8(ImageSectionHeaderArray2, _super);
    function ImageSectionHeaderArray2(view, length) {
      var _this = _super.call(this, view) || this;
      return _this.length = length, _this;
    }
    return ImageSectionHeaderArray2.from = function(bin, length, offset) {
      offset === void 0 && (offset = 0);
      var size = length * 40;
      return new ImageSectionHeaderArray2(new DataView(bin, offset, size), length);
    }, ImageSectionHeaderArray2.prototype.get = function(index) {
      return {
        name: getFixedString(this.view, index * 40, 8),
        virtualSize: this.view.getUint32(8 + index * 40, !0),
        virtualAddress: this.view.getUint32(12 + index * 40, !0),
        sizeOfRawData: this.view.getUint32(16 + index * 40, !0),
        pointerToRawData: this.view.getUint32(20 + index * 40, !0),
        pointerToRelocations: this.view.getUint32(24 + index * 40, !0),
        pointerToLineNumbers: this.view.getUint32(28 + index * 40, !0),
        numberOfRelocations: this.view.getUint16(32 + index * 40, !0),
        numberOfLineNumbers: this.view.getUint16(34 + index * 40, !0),
        characteristics: this.view.getUint32(36 + index * 40, !0)
      };
    }, ImageSectionHeaderArray2.prototype.set = function(index, data) {
      setFixedString(this.view, index * 40, 8, data.name), this.view.setUint32(8 + index * 40, data.virtualSize, !0), this.view.setUint32(12 + index * 40, data.virtualAddress, !0), this.view.setUint32(16 + index * 40, data.sizeOfRawData, !0), this.view.setUint32(20 + index * 40, data.pointerToRawData, !0), this.view.setUint32(24 + index * 40, data.pointerToRelocations, !0), this.view.setUint32(28 + index * 40, data.pointerToLineNumbers, !0), this.view.setUint16(32 + index * 40, data.numberOfRelocations, !0), this.view.setUint16(34 + index * 40, data.numberOfLineNumbers, !0), this.view.setUint32(36 + index * 40, data.characteristics, !0);
    }, ImageSectionHeaderArray2.itemSize = 40, ImageSectionHeaderArray2;
  })(ArrayFormatBase_default)
), ImageSectionHeaderArray_default = ImageSectionHeaderArray;

// node_modules/pe-library/dist/util/generate.js
var DOS_STUB_PROGRAM = new Uint8Array([
  14,
  31,
  186,
  14,
  0,
  180,
  9,
  205,
  33,
  184,
  1,
  76,
  205,
  33,
  68,
  79,
  83,
  32,
  109,
  111,
  100,
  101,
  32,
  110,
  111,
  116,
  32,
  115,
  117,
  112,
  112,
  111,
  114,
  116,
  101,
  100,
  46,
  13,
  13,
  10,
  36,
  0,
  0,
  0,
  0,
  0,
  0,
  0
]), DOS_STUB_SIZE = roundUp(ImageDosHeader_default.size + DOS_STUB_PROGRAM.length, 128), DEFAULT_FILE_ALIGNMENT = 512;
function fillDosStubData(bin) {
  var dos = ImageDosHeader_default.from(bin);
  dos.magic = ImageDosHeader_default.DEFAULT_MAGIC, dos.lastPageSize = DOS_STUB_SIZE % 512, dos.pages = Math.ceil(DOS_STUB_SIZE / 512), dos.relocations = 0, dos.headerSizeInParagraph = Math.ceil(ImageDosHeader_default.size / 16), dos.minAllocParagraphs = 0, dos.maxAllocParagraphs = 65535, dos.initialSS = 0, dos.initialSP = 128, dos.relocationTableAddress = ImageDosHeader_default.size, dos.newHeaderAddress = DOS_STUB_SIZE, copyBuffer(bin, ImageDosHeader_default.size, DOS_STUB_PROGRAM, 0, DOS_STUB_PROGRAM.length);
}
function estimateNewHeaderSize(is32Bit) {
  return (
    // magic
    4 + ImageFileHeader_default.size + (is32Bit ? ImageOptionalHeader_default.size : ImageOptionalHeader64_default.size) + ImageDataDirectoryArray_default.size
  );
}
function fillPeHeaderEmptyData(bin, offset, totalBinSize, is32Bit, isDLL) {
  var _bin, _offset;
  "buffer" in bin ? (_bin = bin.buffer, _offset = bin.byteOffset + offset) : (_bin = bin, _offset = offset), new DataView(_bin, _offset).setUint32(0, ImageNtHeaders_default.DEFAULT_SIGNATURE, !0);
  var fh = ImageFileHeader_default.from(_bin, _offset + 4);
  fh.machine = is32Bit ? 332 : 34404, fh.numberOfSections = 0, fh.timeDateStamp = 0, fh.pointerToSymbolTable = 0, fh.numberOfSymbols = 0, fh.sizeOfOptionalHeader = (is32Bit ? ImageOptionalHeader_default.size : ImageOptionalHeader64_default.size) + ImageDataDirectoryArray_default.size, fh.characteristics = isDLL ? 8450 : 258;
  var oh = (is32Bit ? ImageOptionalHeader_default : ImageOptionalHeader64_default).from(_bin, _offset + 4 + ImageFileHeader_default.size);
  oh.magic = is32Bit ? ImageOptionalHeader_default.DEFAULT_MAGIC : ImageOptionalHeader64_default.DEFAULT_MAGIC, oh.sizeOfCode = 0, oh.sizeOfInitializedData = 0, oh.sizeOfUninitializedData = 0, oh.addressOfEntryPoint = 0, oh.baseOfCode = 4096, oh.imageBase = is32Bit ? 16777216 : 6442450944, oh.sectionAlignment = 4096, oh.fileAlignment = DEFAULT_FILE_ALIGNMENT, oh.majorOperatingSystemVersion = 6, oh.minorOperatingSystemVersion = 0, oh.majorSubsystemVersion = 6, oh.minorSubsystemVersion = 0, oh.sizeOfHeaders = roundUp(totalBinSize, oh.fileAlignment), oh.subsystem = 2, oh.dllCharacteristics = (is32Bit ? 0 : 32) + // IMAGE_DLL_CHARACTERISTICS_HIGH_ENTROPY_VA
  64 + // IMAGE_DLLCHARACTERISTICS_DYNAMIC_BASE
  256, oh.sizeOfStackReserve = 1048576, oh.sizeOfStackCommit = 4096, oh.sizeOfHeapReserve = 1048576, oh.sizeOfHeapCommit = 4096, oh.numberOfRvaAndSizes = ImageDataDirectoryArray_default.size / ImageDataDirectoryArray_default.itemSize;
}
function makeEmptyNtExecutableBinary(is32Bit, isDLL) {
  var bufferSize = roundUp(DOS_STUB_SIZE + estimateNewHeaderSize(is32Bit), DEFAULT_FILE_ALIGNMENT), bin = new ArrayBuffer(bufferSize);
  return fillDosStubData(bin), fillPeHeaderEmptyData(bin, DOS_STUB_SIZE, bufferSize, is32Bit, isDLL), bin;
}

// node_modules/pe-library/dist/NtExecutable.js
var NtExecutable = (
  /** @class */
  (function() {
    function NtExecutable2(_headers, _sections, _ex) {
      this._headers = _headers, this._sections = _sections, this._ex = _ex;
      var dh = ImageDosHeader_default.from(_headers), nh = ImageNtHeaders_default.from(_headers, dh.newHeaderAddress);
      this._dh = dh, this._nh = nh, this._dda = nh.optionalHeaderDataDirectory, _sections.sort(function(a, b) {
        var ra = a.info.pointerToRawData, rb = a.info.pointerToRawData;
        if (ra !== rb)
          return ra - rb;
        var va = a.info.virtualAddress, vb = b.info.virtualAddress;
        return va === vb ? a.info.virtualSize - b.info.virtualSize : va - vb;
      });
    }
    return NtExecutable2.createEmpty = function(is32Bit, isDLL) {
      return is32Bit === void 0 && (is32Bit = !1), isDLL === void 0 && (isDLL = !0), this.from(makeEmptyNtExecutableBinary(is32Bit, isDLL));
    }, NtExecutable2.from = function(bin, options) {
      var dh = ImageDosHeader_default.from(bin), nh = ImageNtHeaders_default.from(bin, dh.newHeaderAddress);
      if (!dh.isValid() || !nh.isValid())
        throw new TypeError("Invalid binary format");
      if (nh.fileHeader.numberOfSymbols > 0)
        throw new Error("Binary with symbols is not supported now");
      var fileAlignment = nh.optionalHeader.fileAlignment, securityEntry = nh.optionalHeaderDataDirectory.get(ImageDirectoryEntry_default.Certificate);
      if (securityEntry.size > 0 && !options?.ignoreCert)
        throw new Error("Parsing signed executable binary is not allowed by default.");
      var secOff = dh.newHeaderAddress + nh.getSectionHeaderOffset(), secCount = nh.fileHeader.numberOfSections, sections = [], tempSectionHeaderBinary = allocatePartialBinary(bin, secOff, secCount * ImageSectionHeaderArray_default.itemSize), secArray = ImageSectionHeaderArray_default.from(tempSectionHeaderBinary, secCount, 0), lastOffset = roundUp(secOff + secCount * ImageSectionHeaderArray_default.itemSize, fileAlignment);
      secArray.forEach(function(info2) {
        if (!info2.pointerToRawData || !info2.sizeOfRawData)
          info2.pointerToRawData = 0, info2.sizeOfRawData = 0, sections.push({
            info: info2,
            data: null
          });
        else {
          var secBin = allocatePartialBinary(bin, info2.pointerToRawData, info2.sizeOfRawData);
          sections.push({
            info: info2,
            data: secBin
          });
          var secEndOffset = roundUp(info2.pointerToRawData + info2.sizeOfRawData, fileAlignment);
          secEndOffset > lastOffset && (lastOffset = secEndOffset);
        }
      });
      var headers = allocatePartialBinary(bin, 0, secOff), exData = null, lastExDataOffset = bin.byteLength;
      return securityEntry.size > 0 && (lastExDataOffset = securityEntry.virtualAddress), lastOffset < lastExDataOffset && (exData = allocatePartialBinary(bin, lastOffset, lastExDataOffset - lastOffset)), new NtExecutable2(headers, sections, exData);
    }, NtExecutable2.prototype.is32bit = function() {
      return this._nh.is32bit();
    }, NtExecutable2.prototype.getTotalHeaderSize = function() {
      return this._headers.byteLength;
    }, Object.defineProperty(NtExecutable2.prototype, "dosHeader", {
      get: function() {
        return this._dh;
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(NtExecutable2.prototype, "newHeader", {
      get: function() {
        return this._nh;
      },
      enumerable: !1,
      configurable: !0
    }), NtExecutable2.prototype.getRawHeader = function() {
      return this._headers;
    }, NtExecutable2.prototype.getImageBase = function() {
      return this._nh.optionalHeader.imageBase;
    }, NtExecutable2.prototype.getFileAlignment = function() {
      return this._nh.optionalHeader.fileAlignment;
    }, NtExecutable2.prototype.getSectionAlignment = function() {
      return this._nh.optionalHeader.sectionAlignment;
    }, NtExecutable2.prototype.getAllSections = function() {
      return this._sections;
    }, NtExecutable2.prototype.getSectionByEntry = function(entry) {
      var dd = this._dda.get(entry), r = this._sections.filter(function(sec) {
        var vaEnd = sec.info.virtualAddress + sec.info.virtualSize;
        return dd.virtualAddress >= sec.info.virtualAddress && dd.virtualAddress < vaEnd;
      }).shift();
      return r !== void 0 ? r : null;
    }, NtExecutable2.prototype.setSectionByEntry = function(entry, section) {
      var sec = section ? { data: section.data, info: section.info } : null, dd = this._dda.get(entry), hasEntry = dd.size > 0;
      if (sec) {
        var rawSize = sec.data ? sec.data.byteLength : 0, fileAlign = this._nh.optionalHeader.fileAlignment, secAlign = this._nh.optionalHeader.sectionAlignment, alignedFileSize = sec.data ? roundUp(rawSize, fileAlign) : 0, alignedSecSize = sec.data ? roundUp(sec.info.virtualSize, secAlign) : 0;
        if (sec.info.sizeOfRawData < alignedFileSize ? sec.info.sizeOfRawData = alignedFileSize : alignedFileSize = sec.info.sizeOfRawData, hasEntry)
          this.replaceSectionImpl(dd.virtualAddress, sec.info, sec.data);
        else {
          var virtAddr_1 = 0, rawAddr_1 = roundUp(this._headers.byteLength, fileAlign);
          this._sections.forEach(function(secExist) {
            secExist.info.pointerToRawData && rawAddr_1 <= secExist.info.pointerToRawData && (rawAddr_1 = secExist.info.pointerToRawData + secExist.info.sizeOfRawData), virtAddr_1 <= secExist.info.virtualAddress && (virtAddr_1 = secExist.info.virtualAddress + secExist.info.virtualSize);
          }), alignedFileSize || (rawAddr_1 = 0), virtAddr_1 || (virtAddr_1 = this.newHeader.optionalHeader.baseOfCode), virtAddr_1 = roundUp(virtAddr_1, secAlign), sec.info.pointerToRawData = rawAddr_1, sec.info.virtualAddress = virtAddr_1, this._dda.set(entry, {
            size: rawSize,
            virtualAddress: virtAddr_1
          }), this._sections.push(sec), this._nh.fileHeader.numberOfSections = this._sections.length, this._nh.optionalHeader.sizeOfImage = roundUp(virtAddr_1 + alignedSecSize, this._nh.optionalHeader.sectionAlignment);
        }
      } else if (hasEntry) {
        this._dda.set(entry, { size: 0, virtualAddress: 0 });
        for (var len = this._sections.length, i = 0; i < len; ++i) {
          var sec_1 = this._sections[i], vaStart = sec_1.info.virtualAddress, vaLast = vaStart + sec_1.info.virtualSize;
          if (dd.virtualAddress >= vaStart && dd.virtualAddress < vaLast) {
            this._sections.splice(i, 1), this._nh.fileHeader.numberOfSections = this._sections.length;
            break;
          }
        }
      }
    }, NtExecutable2.prototype.getExtraData = function() {
      return this._ex;
    }, NtExecutable2.prototype.setExtraData = function(bin) {
      bin === null ? this._ex = null : this._ex = cloneToArrayBuffer(bin);
    }, NtExecutable2.prototype.generate = function(paddingSize) {
      var dh = this._dh, nh = this._nh, secOff = dh.newHeaderAddress + nh.getSectionHeaderOffset(), size = secOff;
      size += this._sections.length * ImageSectionHeaderArray_default.itemSize;
      var align = nh.optionalHeader.fileAlignment;
      size = roundUp(size, align), this._sections.forEach(function(sec) {
        if (sec.info.pointerToRawData) {
          var lastOff = sec.info.pointerToRawData + sec.info.sizeOfRawData;
          size < lastOff && (size = lastOff, size = roundUp(size, align));
        }
      });
      var lastPosition = size;
      this._ex !== null && (size += this._ex.byteLength), typeof paddingSize == "number" && (size += paddingSize);
      var bin = new ArrayBuffer(size), u8bin = new Uint8Array(bin);
      u8bin.set(new Uint8Array(this._headers, 0, secOff)), ImageDataDirectoryArray_default.from(bin, dh.newHeaderAddress + nh.getDataDirectoryOffset()).set(ImageDirectoryEntry_default.Certificate, {
        size: 0,
        virtualAddress: 0
      });
      var secArray = ImageSectionHeaderArray_default.from(bin, this._sections.length, secOff);
      return this._sections.forEach(function(sec, i) {
        sec.data || (sec.info.pointerToRawData = 0, sec.info.sizeOfRawData = 0), secArray.set(i, sec.info), !(!sec.data || !sec.info.pointerToRawData) && u8bin.set(new Uint8Array(sec.data), sec.info.pointerToRawData);
      }), this._ex !== null && u8bin.set(new Uint8Array(this._ex), lastPosition), nh.optionalHeader.checkSum !== 0 && calculateCheckSumForPE(bin, !0), bin;
    }, NtExecutable2.prototype.rearrangeSections = function(rawAddressStart, rawDiff, virtualAddressStart, virtualDiff) {
      if (!(!rawDiff && !virtualDiff)) {
        for (var nh = this._nh, secAlign = nh.optionalHeader.sectionAlignment, dirs = this._dda, len = this._sections.length, lastVirtAddress = 0, i = 0; i < len; ++i) {
          var sec = this._sections[i], virtAddr = sec.info.virtualAddress;
          if (virtualDiff && virtAddr >= virtualAddressStart) {
            var iDir = dirs.findIndexByVirtualAddress(virtAddr);
            virtAddr += virtualDiff, iDir !== null && dirs.set(iDir, {
              virtualAddress: virtAddr,
              size: sec.info.virtualSize
            }), sec.info.virtualAddress = virtAddr;
          }
          var fileAddr = sec.info.pointerToRawData;
          rawDiff && fileAddr >= rawAddressStart && (sec.info.pointerToRawData = fileAddr + rawDiff), lastVirtAddress = roundUp(sec.info.virtualAddress + sec.info.virtualSize, secAlign);
        }
        nh.optionalHeader.sizeOfImage = lastVirtAddress;
      }
    }, NtExecutable2.prototype.replaceSectionImpl = function(virtualAddress, info2, data) {
      for (var len = this._sections.length, i = 0; i < len; ++i) {
        var s = this._sections[i];
        if (s.info.virtualAddress === virtualAddress) {
          var secAlign = this._nh.optionalHeader.sectionAlignment, fileAddr = s.info.pointerToRawData, oldFileAddr = fileAddr + s.info.sizeOfRawData, oldVirtAddr = virtualAddress + roundUp(s.info.virtualSize, secAlign);
          s.info = cloneObject(info2), s.info.virtualAddress = virtualAddress, s.info.pointerToRawData = fileAddr, s.data = data;
          var newFileAddr = fileAddr + info2.sizeOfRawData, newVirtAddr = virtualAddress + roundUp(info2.virtualSize, secAlign);
          this.rearrangeSections(oldFileAddr, newFileAddr - oldFileAddr, oldVirtAddr, newVirtAddr - oldVirtAddr);
          {
            var dirs = this._dda, iDir = dirs.findIndexByVirtualAddress(virtualAddress);
            iDir !== null && dirs.set(iDir, {
              virtualAddress,
              size: info2.virtualSize
            });
          }
          break;
        }
      }
    }, NtExecutable2;
  })()
), NtExecutable_default = NtExecutable;

// node_modules/pe-library/dist/NtExecutableResource.js
function removeDuplicates(a) {
  return a.reduce(function(p, c) {
    return p.indexOf(c) >= 0 ? p : p.concat(c);
  }, []);
}
function readString(view, offset) {
  var length = view.getUint16(offset, !0), r = "";
  offset += 2;
  for (var i = 0; i < length; ++i)
    r += String.fromCharCode(view.getUint16(offset, !0)), offset += 2;
  return r;
}
function readLanguageTable(view, typeEntry, name, languageTable, cb) {
  var off = languageTable, nameEntry = {
    name,
    languageTable,
    characteristics: view.getUint32(off, !0),
    dateTime: view.getUint32(off + 4, !0),
    majorVersion: view.getUint16(off + 8, !0),
    minorVersion: view.getUint16(off + 10, !0)
  }, nameCount = view.getUint16(off + 12, !0), idCount = view.getUint16(off + 14, !0);
  off += 16;
  for (var i = 0; i < nameCount; ++i) {
    var nameOffset = view.getUint32(off, !0) & 2147483647, dataOffset = view.getUint32(off + 4, !0);
    if ((dataOffset & 2147483648) !== 0) {
      off += 8;
      continue;
    }
    var name_1 = readString(view, nameOffset);
    cb(typeEntry, nameEntry, { lang: name_1, dataOffset }), off += 8;
  }
  for (var i = 0; i < idCount; ++i) {
    var id = view.getUint32(off, !0) & 2147483647, dataOffset = view.getUint32(off + 4, !0);
    if ((dataOffset & 2147483648) !== 0) {
      off += 8;
      continue;
    }
    cb(typeEntry, nameEntry, { lang: id, dataOffset }), off += 8;
  }
}
function readNameTable(view, type, nameTable, cb) {
  var off = nameTable, typeEntry = {
    type,
    nameTable,
    characteristics: view.getUint32(off, !0),
    dateTime: view.getUint32(off + 4, !0),
    majorVersion: view.getUint16(off + 8, !0),
    minorVersion: view.getUint16(off + 10, !0)
  }, nameCount = view.getUint16(off + 12, !0), idCount = view.getUint16(off + 14, !0);
  off += 16;
  for (var i = 0; i < nameCount; ++i) {
    var nameOffset = view.getUint32(off, !0) & 2147483647, nextTable = view.getUint32(off + 4, !0);
    if (!(nextTable & 2147483648)) {
      off += 8;
      continue;
    }
    nextTable &= 2147483647;
    var name_2 = readString(view, nameOffset);
    readLanguageTable(view, typeEntry, name_2, nextTable, cb), off += 8;
  }
  for (var i = 0; i < idCount; ++i) {
    var id = view.getUint32(off, !0) & 2147483647, nextTable = view.getUint32(off + 4, !0);
    if (!(nextTable & 2147483648)) {
      off += 8;
      continue;
    }
    nextTable &= 2147483647, readLanguageTable(view, typeEntry, id, nextTable, cb), off += 8;
  }
}
function divideEntriesImplByID(r, names, entries) {
  var entriesByString = {}, entriesByNumber = {};
  entries.forEach(function(e) {
    typeof e.lang == "string" ? (entriesByString[e.lang] = e, names.push(e.lang)) : entriesByNumber[e.lang] = e;
  });
  var strKeys = Object.keys(entriesByString);
  strKeys.sort().forEach(function(type) {
    r.s.push(entriesByString[type]);
  });
  var numKeys = Object.keys(entriesByNumber);
  return numKeys.map(function(k) {
    return Number(k);
  }).sort(function(a, b) {
    return a - b;
  }).forEach(function(type) {
    r.n.push(entriesByNumber[type]);
  }), 16 + 8 * (strKeys.length + numKeys.length);
}
function divideEntriesImplByName(r, names, entries) {
  var entriesByString = {}, entriesByNumber = {};
  entries.forEach(function(e) {
    var _a, _b;
    if (typeof e.id == "string") {
      var a = (_a = entriesByString[e.id]) !== null && _a !== void 0 ? _a : entriesByString[e.id] = [];
      names.push(e.id), a.push(e);
    } else {
      var a = (_b = entriesByNumber[e.id]) !== null && _b !== void 0 ? _b : entriesByNumber[e.id] = [];
      a.push(e);
    }
  });
  var sSum = Object.keys(entriesByString).sort().map(function(id) {
    var o = {
      id,
      s: [],
      n: []
    };
    return r.s.push(o), divideEntriesImplByID(o, names, entriesByString[id]);
  }).reduce(function(p, c) {
    return p + 8 + c;
  }, 0), nSum = Object.keys(entriesByNumber).map(function(k) {
    return Number(k);
  }).sort(function(a, b) {
    return a - b;
  }).map(function(id) {
    var o = {
      id,
      s: [],
      n: []
    };
    return r.n.push(o), divideEntriesImplByID(o, names, entriesByNumber[id]);
  }).reduce(function(p, c) {
    return p + 8 + c;
  }, 0);
  return 16 + sSum + nSum;
}
function divideEntriesImplByType(r, names, entries) {
  var entriesByString = {}, entriesByNumber = {};
  entries.forEach(function(e) {
    var _a, _b;
    if (typeof e.type == "string") {
      var a = (_a = entriesByString[e.type]) !== null && _a !== void 0 ? _a : entriesByString[e.type] = [];
      names.push(e.type), a.push(e);
    } else {
      var a = (_b = entriesByNumber[e.type]) !== null && _b !== void 0 ? _b : entriesByNumber[e.type] = [];
      a.push(e);
    }
  });
  var sSum = Object.keys(entriesByString).sort().map(function(type) {
    var o = { type, s: [], n: [] };
    return r.s.push(o), divideEntriesImplByName(o, names, entriesByString[type]);
  }).reduce(function(p, c) {
    return p + 8 + c;
  }, 0), nSum = Object.keys(entriesByNumber).map(function(k) {
    return Number(k);
  }).sort(function(a, b) {
    return a - b;
  }).map(function(type) {
    var o = { type, s: [], n: [] };
    return r.n.push(o), divideEntriesImplByName(o, names, entriesByNumber[type]);
  }).reduce(function(p, c) {
    return p + 8 + c;
  }, 0);
  return 16 + sSum + nSum;
}
function calculateStringLengthForWrite(text) {
  var length = text.length;
  return length > 65535 ? 65535 : length;
}
function getStringOffset(target, strings) {
  for (var l = strings.length, i = 0; i < l; ++i) {
    var s = strings[i];
    if (s.text === target)
      return s.offset;
  }
  throw new Error("Unexpected");
}
function writeString(view, offset, text) {
  var length = calculateStringLengthForWrite(text);
  view.setUint16(offset, length, !0), offset += 2;
  for (var i = 0; i < length; ++i)
    view.setUint16(offset, text.charCodeAt(i), !0), offset += 2;
  return offset;
}
function writeLanguageTable(view, offset, strings, data) {
  return view.setUint32(offset, 0, !0), view.setUint32(offset + 4, 0, !0), view.setUint32(offset + 8, 0, !0), view.setUint16(offset + 12, data.s.length, !0), view.setUint16(offset + 14, data.n.length, !0), offset += 16, data.s.forEach(function(e) {
    var strOff = getStringOffset(e.lang, strings);
    view.setUint32(offset, strOff, !0), view.setUint32(offset + 4, e.offset, !0), offset += 8;
  }), data.n.forEach(function(e) {
    view.setUint32(offset, e.lang, !0), view.setUint32(offset + 4, e.offset, !0), offset += 8;
  }), offset;
}
function writeNameTable(view, offset, leafOffset, strings, data) {
  return view.setUint32(offset, 0, !0), view.setUint32(offset + 4, 0, !0), view.setUint32(offset + 8, 0, !0), view.setUint16(offset + 12, data.s.length, !0), view.setUint16(offset + 14, data.n.length, !0), offset += 16, data.s.forEach(function(e) {
    e.offset = leafOffset, leafOffset = writeLanguageTable(view, leafOffset, strings, e);
  }), data.n.forEach(function(e) {
    e.offset = leafOffset, leafOffset = writeLanguageTable(view, leafOffset, strings, e);
  }), data.s.forEach(function(e) {
    var strOff = getStringOffset(e.id, strings);
    view.setUint32(offset, strOff + 2147483648, !0), view.setUint32(offset + 4, e.offset + 2147483648, !0), offset += 8;
  }), data.n.forEach(function(e) {
    view.setUint32(offset, e.id, !0), view.setUint32(offset + 4, e.offset + 2147483648, !0), offset += 8;
  }), leafOffset;
}
function writeTypeTable(view, offset, strings, data) {
  view.setUint32(offset, 0, !0), view.setUint32(offset + 4, 0, !0), view.setUint32(offset + 8, 0, !0), view.setUint16(offset + 12, data.s.length, !0), view.setUint16(offset + 14, data.n.length, !0), offset += 16;
  var nextTableOffset = offset + 8 * (data.s.length + data.n.length);
  return data.s.forEach(function(e) {
    e.offset = nextTableOffset, nextTableOffset += 16 + 8 * (e.s.length + e.n.length);
  }), data.n.forEach(function(e) {
    e.offset = nextTableOffset, nextTableOffset += 16 + 8 * (e.s.length + e.n.length);
  }), data.s.forEach(function(e) {
    var strOff = getStringOffset(e.type, strings);
    view.setUint32(offset, strOff + 2147483648, !0), view.setUint32(offset + 4, e.offset + 2147483648, !0), offset += 8, nextTableOffset = writeNameTable(view, e.offset, nextTableOffset, strings, e);
  }), data.n.forEach(function(e) {
    view.setUint32(offset, e.type, !0), view.setUint32(offset + 4, e.offset + 2147483648, !0), offset += 8, nextTableOffset = writeNameTable(view, e.offset, nextTableOffset, strings, e);
  }), nextTableOffset;
}
var NtExecutableResource = (
  /** @class */
  (function() {
    function NtExecutableResource2() {
      this.dateTime = 0, this.majorVersion = 0, this.minorVersion = 0, this.entries = [], this.sectionDataHeader = null, this.originalSize = 0;
    }
    return NtExecutableResource2.prototype.parse = function(section, ignoreUnparsableData) {
      if (section.data) {
        var view = new DataView(section.data);
        this.dateTime = view.getUint32(4, !0), this.majorVersion = view.getUint16(8, !0), this.minorVersion = view.getUint16(10, !0);
        for (var nameCount = view.getUint16(12, !0), idCount = view.getUint16(14, !0), off = 16, res = [], cb = function(t, n, l) {
          var off2 = view.getUint32(l.dataOffset, !0) - section.info.virtualAddress, size = view.getUint32(l.dataOffset + 4, !0), cp = view.getUint32(l.dataOffset + 8, !0);
          if (off2 >= 0) {
            var bin = new Uint8Array(size);
            bin.set(new Uint8Array(section.data, off2, size)), res.push({
              type: t.type,
              id: n.name,
              lang: l.lang,
              codepage: cp,
              bin: bin.buffer
            });
          } else {
            if (!ignoreUnparsableData)
              throw new Error("Cannot parse resource directory entry; RVA seems to be invalid.");
            res.push({
              type: t.type,
              id: n.name,
              lang: l.lang,
              codepage: cp,
              bin: new ArrayBuffer(0),
              rva: l.dataOffset
            });
          }
        }, i = 0; i < nameCount; ++i) {
          var nameOffset = view.getUint32(off, !0) & 2147483647, nextTable = view.getUint32(off + 4, !0);
          if (!(nextTable & 2147483648)) {
            off += 8;
            continue;
          }
          nextTable &= 2147483647;
          var name_3 = readString(view, nameOffset);
          readNameTable(view, name_3, nextTable, cb), off += 8;
        }
        for (var i = 0; i < idCount; ++i) {
          var typeId = view.getUint32(off, !0) & 2147483647, nextTable = view.getUint32(off + 4, !0);
          if (!(nextTable & 2147483648)) {
            off += 8;
            continue;
          }
          nextTable &= 2147483647, readNameTable(view, typeId, nextTable, cb), off += 8;
        }
        this.entries = res, this.originalSize = section.data.byteLength;
      }
    }, NtExecutableResource2.from = function(exe, ignoreUnparsableData) {
      ignoreUnparsableData === void 0 && (ignoreUnparsableData = !1);
      var secs = [].concat(exe.getAllSections()).sort(function(a, b) {
        return a.info.virtualAddress - b.info.virtualAddress;
      }), entry = exe.getSectionByEntry(ImageDirectoryEntry_default.Resource);
      if (entry)
        for (var reloc = exe.getSectionByEntry(ImageDirectoryEntry_default.BaseRelocation), i = 0; i < secs.length; ++i) {
          var s = secs[i];
          if (s === entry) {
            for (var j = i + 1; j < secs.length; ++j)
              if (!reloc || secs[j] !== reloc)
                throw new Error("After Resource section, sections except for relocation are not supported");
            break;
          }
        }
      var r = new NtExecutableResource2();
      return r.sectionDataHeader = entry ? cloneObject(entry.info) : null, entry && r.parse(entry, ignoreUnparsableData), r;
    }, NtExecutableResource2.prototype.replaceResourceEntry = function(entry) {
      for (var len = this.entries.length, i = 0; i < len; ++i) {
        var e = this.entries[i];
        if (e.type === entry.type && e.id === entry.id && e.lang === entry.lang) {
          this.entries[i] = entry;
          return;
        }
      }
      this.entries.push(entry);
    }, NtExecutableResource2.prototype.getResourceEntriesAsString = function(type, id) {
      return this.entries.filter(function(entry) {
        return entry.type === type && entry.id === id;
      }).map(function(entry) {
        return [entry.lang, binaryToString(entry.bin)];
      });
    }, NtExecutableResource2.prototype.replaceResourceEntryFromString = function(type, id, lang, value) {
      var entry = {
        type,
        id,
        lang,
        codepage: 1200,
        bin: stringToBinary(value)
      };
      this.replaceResourceEntry(entry);
    }, NtExecutableResource2.prototype.removeResourceEntry = function(type, id, lang) {
      this.entries = this.entries.filter(function(entry) {
        return !(entry.type === type && entry.id === id && (typeof lang > "u" || entry.lang === lang));
      });
    }, NtExecutableResource2.prototype.generateResourceData = function(virtualAddress, alignment, noGrow, allowShrink) {
      noGrow === void 0 && (noGrow = !1), allowShrink === void 0 && (allowShrink = !1);
      var r = {
        s: [],
        n: []
      }, strings = [], size = divideEntriesImplByType(r, strings, this.entries);
      strings = removeDuplicates(strings);
      var stringsOffset = size;
      size += strings.reduce(function(prev, cur) {
        return prev + 2 + calculateStringLengthForWrite(cur) * 2;
      }, 0), size = roundUp(size, 8);
      var descOffset = size;
      size = this.entries.reduce(function(p, e) {
        return e.offset = p, p + 16;
      }, descOffset);
      var dataOffset = size;
      size = this.entries.reduce(function(p, e) {
        return roundUp(p, 8) + e.bin.byteLength;
      }, dataOffset);
      var alignedSize = roundUp(size, alignment), originalAlignedSize = roundUp(this.originalSize, alignment);
      if (noGrow && alignedSize > originalAlignedSize)
        throw new Error("New resource data is larger than original");
      allowShrink || alignedSize < originalAlignedSize && (alignedSize = originalAlignedSize);
      var bin = new ArrayBuffer(alignedSize), view = new DataView(bin), o = descOffset, va = virtualAddress + dataOffset;
      this.entries.forEach(function(e) {
        var len = e.bin.byteLength;
        typeof e.rva < "u" ? view.setUint32(o, e.rva, !0) : (va = roundUp(va, 8), view.setUint32(o, va, !0), va += len), view.setUint32(o + 4, len, !0), view.setUint32(o + 8, e.codepage, !0), view.setUint32(o + 12, 0, !0), o += 16;
      }), o = dataOffset, this.entries.forEach(function(e) {
        var len = e.bin.byteLength;
        copyBuffer(bin, o, e.bin, 0, len), o += roundUp(len, 8);
      });
      var stringsData = [];
      if (o = stringsOffset, strings.forEach(function(s) {
        stringsData.push({
          offset: o,
          text: s
        }), o = writeString(view, o, s);
      }), writeTypeTable(view, 0, stringsData, r), alignedSize > size)
        for (var pad = "PADDINGX", i = size, j = 0; i < alignedSize; ++i, ++j)
          j === 8 && (j = 0), view.setUint8(i, pad.charCodeAt(j));
      return {
        bin,
        rawSize: size,
        dataOffset,
        descEntryOffset: descOffset,
        descEntryCount: this.entries.length
      };
    }, NtExecutableResource2.prototype.outputResource = function(exeDest, noGrow, allowShrink) {
      noGrow === void 0 && (noGrow = !1), allowShrink === void 0 && (allowShrink = !1);
      var fileAlign = exeDest.getFileAlignment(), sectionData;
      this.sectionDataHeader ? sectionData = {
        data: null,
        info: cloneObject(this.sectionDataHeader)
      } : sectionData = {
        data: null,
        info: {
          name: ".rsrc",
          virtualSize: 0,
          virtualAddress: 0,
          sizeOfRawData: 0,
          pointerToRawData: 0,
          pointerToRelocations: 0,
          pointerToLineNumbers: 0,
          numberOfRelocations: 0,
          numberOfLineNumbers: 0,
          characteristics: 1073741888
          // read access and initialized data
        }
      };
      var data = this.generateResourceData(0, fileAlign, noGrow, allowShrink);
      sectionData.data = data.bin, sectionData.info.sizeOfRawData = data.bin.byteLength, sectionData.info.virtualSize = data.rawSize, exeDest.setSectionByEntry(ImageDirectoryEntry_default.Resource, sectionData);
      for (var generatedSection = exeDest.getSectionByEntry(ImageDirectoryEntry_default.Resource), view = new DataView(generatedSection.data), o = data.descEntryOffset, va = generatedSection.info.virtualAddress + data.dataOffset, i = 0; i < data.descEntryCount; ++i) {
        var len = view.getUint32(o + 4, !0);
        va = roundUp(va, 8), view.setUint32(o, va, !0), va += len, o += 16;
      }
    }, NtExecutableResource2;
  })()
), NtExecutableResource_default = NtExecutableResource;

// node_modules/resedit/dist/data/index.js
var data_exports = {};
__export(data_exports, {
  IconFile: () => IconFile_default,
  IconItem: () => IconItem_default,
  RawIconItem: () => RawIconItem_default
});

// node_modules/resedit/dist/util/functions.js
function cloneObject2(object) {
  var r = {};
  return Object.keys(object).forEach(function(key) {
    r[key] = object[key];
  }), r;
}
function createDataView2(bin, byteOffset, byteLength) {
  if ("buffer" in bin) {
    var newOffset = bin.byteOffset, newLength = bin.byteLength;
    return typeof byteOffset < "u" && (newOffset += byteOffset, newLength -= byteOffset), typeof byteLength < "u" && (newLength = byteLength), new DataView(bin.buffer, newOffset, newLength);
  } else
    return new DataView(bin, byteOffset, byteLength);
}
function roundUp2(val, align) {
  return Math.floor((val + align - 1) / align) * align;
}
function copyBuffer2(dest, destOffset, src, srcOffset, length) {
  var ua8Dest = "buffer" in dest ? new Uint8Array(dest.buffer, dest.byteOffset + (destOffset || 0), length) : new Uint8Array(dest, destOffset, length), ua8Src = "buffer" in src ? new Uint8Array(src.buffer, src.byteOffset + (srcOffset || 0), length) : new Uint8Array(src, srcOffset, length);
  ua8Dest.set(ua8Src);
}
function allocatePartialBinary2(binBase, offset, length) {
  var b = new ArrayBuffer(length);
  return copyBuffer2(b, 0, binBase, offset, length), b;
}
function readInt32WithLastOffset(view, offset, last) {
  return offset + 4 <= last ? view.getInt32(offset, !0) : 0;
}
function readUint8WithLastOffset(view, offset, last) {
  return offset < last ? view.getUint8(offset) : 0;
}
function readUint16WithLastOffset(view, offset, last) {
  return offset + 2 <= last ? view.getUint16(offset, !0) : 0;
}
function readUint32WithLastOffset(view, offset, last) {
  return offset + 4 <= last ? view.getUint32(offset, !0) : 0;
}

// node_modules/resedit/dist/data/IconItem.js
function calcMaskSize(width, height) {
  var actualWidthBytes = roundUp2(Math.abs(width), 32) / 8;
  return actualWidthBytes * Math.abs(height);
}
var IconItem = (
  /** @class */
  (function() {
    function IconItem2(width, height, bin, byteOffset, byteLength) {
      var view = createDataView2(bin, byteOffset, byteLength), totalSize = view.byteLength, headerSize = view.getUint32(0, !0);
      headerSize > totalSize && (headerSize = totalSize);
      var sizeImage = readUint32WithLastOffset(view, 20, headerSize), bi = {
        width: readInt32WithLastOffset(view, 4, headerSize),
        height: readInt32WithLastOffset(view, 8, headerSize),
        planes: readUint16WithLastOffset(view, 12, headerSize),
        bitCount: readUint16WithLastOffset(view, 14, headerSize),
        compression: readUint32WithLastOffset(view, 16, headerSize),
        sizeImage,
        xPelsPerMeter: readInt32WithLastOffset(view, 24, headerSize),
        yPelsPerMeter: readInt32WithLastOffset(view, 28, headerSize),
        colorUsed: readUint32WithLastOffset(view, 32, headerSize),
        colorImportant: readUint32WithLastOffset(view, 36, headerSize),
        colors: []
      }, offset = 40, colors = bi.colorUsed;
      if (!colors)
        switch (bi.bitCount) {
          case 1:
            colors = 2;
            break;
          case 4:
            colors = 16;
            break;
          case 8:
            colors = 256;
            break;
        }
      for (var i = 0; i < colors; ++i)
        bi.colors.push({
          b: readUint8WithLastOffset(view, offset, totalSize),
          g: readUint8WithLastOffset(view, offset + 1, totalSize),
          r: readUint8WithLastOffset(view, offset + 2, totalSize)
        }), offset += 4;
      this.width = width, this.height = height, this.bitmapInfo = bi;
      var widthBytes = roundUp2(bi.bitCount * Math.abs(bi.width), 32) / 8, absActualHeight = Math.abs(bi.height) / 2, size = bi.compression !== 0 && sizeImage !== 0 ? sizeImage : widthBytes * absActualHeight;
      if (size + offset > totalSize)
        throw new Error("Unexpected bitmap data in icon: bitmap size ".concat(size, " is larger than ").concat(totalSize, " - ").concat(offset));
      this._pixels = allocatePartialBinary2(view, offset, size), offset += size;
      var maskSize = calcMaskSize(bi.width, absActualHeight);
      maskSize + offset <= totalSize ? this.masks = allocatePartialBinary2(view, offset, maskSize) : this.masks = new ArrayBuffer(maskSize);
    }
    return Object.defineProperty(IconItem2.prototype, "pixels", {
      /**
       * Bitmap pixel data.
       * @note
       * On set, if `bitmapInfo.sizeImage` is non-zero, `bitmapInfo.sizeImage` will be updated.
       */
      get: function() {
        return this._pixels;
      },
      /**
       * Bitmap pixel data.
       * @note
       * On set, if `bitmapInfo.sizeImage` is non-zero, `bitmapInfo.sizeImage` will be updated.
       */
      set: function(newValue) {
        this._pixels = newValue, this.bitmapInfo.sizeImage !== 0 && (this.bitmapInfo.sizeImage = newValue.byteLength);
      },
      enumerable: !1,
      configurable: !0
    }), IconItem2.from = function(arg1, arg2, arg3, byteOffset, byteLength) {
      var width, height, bin;
      return typeof arg3 == "object" ? (width = arg1, height = arg2, bin = arg3) : (width = null, height = null, bin = arg1, byteOffset = arg2, byteLength = arg3), new IconItem2(width, height, bin, byteOffset, byteLength);
    }, IconItem2.prototype.isIcon = function() {
      return !0;
    }, IconItem2.prototype.isRaw = function() {
      return !1;
    }, IconItem2.prototype.generate = function() {
      var bi = this.bitmapInfo, absWidth = Math.abs(bi.width), absWidthBytes = roundUp2(bi.bitCount * absWidth, 32) / 8, absActualHeight = Math.abs(bi.height) / 2, actualSizeImage = absWidthBytes * absActualHeight, sizeMask = calcMaskSize(bi.width, absActualHeight), colorCount = bi.colors.length, totalSize = 40 + 4 * colorCount + actualSizeImage + sizeMask, bin = new ArrayBuffer(totalSize), view = new DataView(bin);
      view.setUint32(0, 40, !0), view.setInt32(4, bi.width, !0), view.setInt32(8, bi.height, !0), view.setUint16(12, bi.planes, !0), view.setUint16(14, bi.bitCount, !0), view.setUint32(16, bi.compression, !0), view.setUint32(20, bi.sizeImage, !0), view.setInt32(24, bi.xPelsPerMeter, !0), view.setInt32(28, bi.yPelsPerMeter, !0), view.setUint32(32, bi.colorUsed, !0), view.setUint32(36, bi.colorImportant > colorCount ? colorCount : bi.colorImportant, !0);
      var offset = 40;
      return bi.colors.forEach(function(c) {
        view.setUint8(offset, c.b), view.setUint8(offset + 1, c.g), view.setUint8(offset + 2, c.r), offset += 4;
      }), copyBuffer2(bin, offset, this.pixels, 0, actualSizeImage), copyBuffer2(bin, offset + actualSizeImage, this.masks, 0, sizeMask), bin;
    }, IconItem2;
  })()
), IconItem_default = IconItem;

// node_modules/resedit/dist/data/RawIconItem.js
var RawIconItem = (
  /** @class */
  (function() {
    function RawIconItem2(bin, width, height, bitCount, byteOffset, byteLength) {
      this.width = width, this.height = height, this.bitCount = bitCount, typeof byteOffset != "number" ? (byteOffset = 0, byteLength = bin.byteLength) : typeof byteLength != "number" && (byteLength = bin.byteLength - byteOffset), this.bin = allocatePartialBinary2(bin, byteOffset, byteLength);
    }
    return RawIconItem2.from = function(bin, width, height, bitCount, byteOffset, byteLength) {
      return new RawIconItem2(bin, width, height, bitCount, byteOffset, byteLength);
    }, RawIconItem2.prototype.isIcon = function() {
      return !1;
    }, RawIconItem2.prototype.isRaw = function() {
      return !0;
    }, RawIconItem2;
  })()
), RawIconItem_default = RawIconItem;

// node_modules/resedit/dist/data/IconFile.js
function generateEntryBinary(icons) {
  var count = icons.length;
  count > 65535 && (count = 65535);
  var tmpIcons = icons.map(function(item) {
    return item.data.isIcon() ? {
      item,
      bin: item.data.generate(),
      offset: 0
    } : {
      item,
      bin: item.data.bin,
      offset: 0
    };
  }), size = tmpIcons.reduce(function(p, icon) {
    return icon.offset = p, p + icon.bin.byteLength;
  }, 6 + 16 * count), bin = new ArrayBuffer(size), view = new DataView(bin);
  view.setUint16(0, 0, !0), view.setUint16(2, 1, !0), view.setUint16(4, count, !0);
  var offset = 6;
  return tmpIcons.forEach(function(icon) {
    var item = icon.item, width, height, colors, planes, bitCount;
    if (item.data.isIcon()) {
      var bi = item.data.bitmapInfo;
      width = typeof item.width < "u" ? item.width : Math.abs(bi.width), height = typeof item.height < "u" ? item.height : Math.abs(bi.height / 2), colors = typeof item.colors < "u" ? item.colors : bi.colorUsed || bi.colors.length, planes = typeof item.planes < "u" ? item.planes : bi.planes, bitCount = typeof item.bitCount < "u" ? item.bitCount : bi.bitCount;
    } else
      width = typeof item.width < "u" ? item.width : Math.abs(item.data.width), height = typeof item.height < "u" ? item.height : Math.abs(item.data.height), colors = typeof item.colors < "u" ? item.colors : 0, planes = typeof item.planes < "u" ? item.planes : 1, bitCount = typeof item.bitCount < "u" ? item.bitCount : item.data.bitCount;
    var dataSize = icon.bin.byteLength;
    view.setUint8(offset, width >= 256 ? 0 : width), view.setUint8(offset + 1, height >= 256 ? 0 : height), view.setUint8(offset + 2, colors >= 256 ? 0 : colors), view.setUint8(offset + 3, 0), view.setUint16(offset + 4, planes, !0), view.setUint16(offset + 6, bitCount, !0), view.setUint32(offset + 8, dataSize, !0), view.setUint32(offset + 12, icon.offset, !0), offset += 16, copyBuffer2(bin, icon.offset, icon.bin, 0, dataSize);
  }), bin;
}
var IconFile = (
  /** @class */
  (function() {
    function IconFile2(bin) {
      if (!bin) {
        this.icons = [];
        return;
      }
      var view = createDataView2(bin), totalSize = view.byteLength, icons = [];
      if (view.getUint16(2, !0) === 1)
        for (var count = view.getUint16(4, !0), offset = 6, i = 0; i < count; ++i) {
          var dataSize = readUint32WithLastOffset(view, offset + 8, totalSize), dataOffset = readUint32WithLastOffset(view, offset + 12, totalSize), width = readUint8WithLastOffset(view, offset, totalSize), height = readUint8WithLastOffset(view, offset + 1, totalSize), bitCount = readUint8WithLastOffset(view, offset + 6, totalSize), data = void 0;
          view.getUint32(dataOffset, !0) === 40 ? data = IconItem_default.from(width, height, bin, dataOffset, dataSize) : data = RawIconItem_default.from(bin, width || 256, height || 256, bitCount, dataOffset, dataSize), icons.push({
            width,
            height,
            colors: readUint8WithLastOffset(view, offset + 2, totalSize),
            planes: readUint16WithLastOffset(view, offset + 4, totalSize),
            bitCount,
            data
          }), offset += 16;
        }
      this.icons = icons;
    }
    return IconFile2.from = function(bin) {
      return new IconFile2(bin);
    }, IconFile2.prototype.generate = function() {
      return generateEntryBinary(this.icons);
    }, IconFile2;
  })()
), IconFile_default = IconFile;

// node_modules/resedit/dist/resource/index.js
var resource_exports = {};
__export(resource_exports, {
  IconGroupEntry: () => IconGroupEntry_default,
  StringTable: () => StringTable_default,
  VersionFileDriverSubtype: () => VersionFileDriverSubtype,
  VersionFileFlags: () => VersionFileFlags_default,
  VersionFileFontSubtype: () => VersionFileFontSubtype,
  VersionFileOS: () => VersionFileOS_default,
  VersionFileType: () => VersionFileType_default,
  VersionInfo: () => VersionInfo_default
});

// node_modules/resedit/dist/resource/IconGroupEntry.js
function generateEntryBinary2(icons) {
  var count = icons.length;
  count > 65535 && (count = 65535);
  var size = 6 + 14 * icons.length, bin = new ArrayBuffer(size), view = new DataView(bin);
  view.setUint16(0, 0, !0), view.setUint16(2, 1, !0), view.setUint16(4, count, !0);
  var offset = 6;
  return icons.forEach(function(icon) {
    view.setUint8(offset, icon.width >= 256 ? 0 : icon.width), view.setUint8(offset + 1, icon.height >= 256 ? 0 : icon.height), view.setUint8(offset + 2, icon.colors >= 256 ? 0 : icon.colors), view.setUint8(offset + 3, 0), view.setUint16(offset + 4, icon.planes, !0), view.setUint16(offset + 6, icon.bitCount, !0), view.setUint32(offset + 8, icon.dataSize, !0), view.setUint16(offset + 12, icon.iconID, !0), offset += 14;
  }), bin;
}
function findUnusedIconID(entries, lang, isCursor) {
  for (var type = isCursor ? 1 : 3, filteredIDs = entries.filter(function(e) {
    return e.type === type && e.lang === lang && typeof e.id == "number";
  }).map(function(e) {
    return e.id;
  }).sort(function(a, b) {
    return a - b;
  }), idCurrent = 1, _i = 0, filteredIDs_1 = filteredIDs; _i < filteredIDs_1.length; _i++) {
    var id = filteredIDs_1[_i];
    if (idCurrent < id)
      return {
        id: idCurrent,
        last: !1
      };
    idCurrent === id && ++idCurrent;
  }
  return {
    id: idCurrent,
    last: !0
  };
}
var IconGroupEntry = (
  /** @class */
  (function() {
    function IconGroupEntry2(groupEntry) {
      var view = new DataView(groupEntry.bin), totalSize = view.byteLength, icons = [];
      if (view.getUint16(2, !0) === 1)
        for (var count = view.getUint16(4, !0), offset = 6, i = 0; i < count; ++i)
          icons.push({
            width: readUint8WithLastOffset(view, offset, totalSize),
            height: readUint8WithLastOffset(view, offset + 1, totalSize),
            colors: readUint8WithLastOffset(view, offset + 2, totalSize),
            planes: readUint16WithLastOffset(view, offset + 4, totalSize),
            bitCount: readUint16WithLastOffset(view, offset + 6, totalSize),
            dataSize: readUint32WithLastOffset(view, offset + 8, totalSize),
            iconID: readUint16WithLastOffset(view, offset + 12, totalSize)
          }), offset += 14;
      this.id = groupEntry.id, this.lang = groupEntry.lang, this.icons = icons;
    }
    return IconGroupEntry2.fromEntries = function(entries) {
      return entries.filter(function(e) {
        return e.type === 14;
      }).map(function(e) {
        return new IconGroupEntry2(e);
      });
    }, IconGroupEntry2.prototype.generateEntry = function() {
      var bin = generateEntryBinary2(this.icons);
      return {
        type: 14,
        id: this.id,
        lang: this.lang,
        codepage: 0,
        bin
      };
    }, IconGroupEntry2.prototype.getIconItemsFromEntries = function(entries) {
      var _this = this;
      return entries.map(function(e) {
        if (e.type !== 3 || e.lang !== _this.lang)
          return null;
        var c = _this.icons.filter(function(icon) {
          return e.id === icon.iconID;
        }).shift();
        return c ? {
          entry: e,
          icon: c
        } : null;
      }).filter(function(item) {
        return !!item;
      }).map(function(item) {
        var bin = item.entry.bin, view = new DataView(bin);
        if (view.getUint32(0, !0) === 40)
          return IconItem_default.from(bin);
        var c = item.icon;
        return RawIconItem_default.from(bin, c.width, c.height, c.bitCount);
      });
    }, IconGroupEntry2.replaceIconsForResource = function(destEntries, iconGroupID, lang, icons) {
      var entry = destEntries.filter(function(e2) {
        return e2.type === 14 && e2.id === iconGroupID && e2.lang === lang;
      }).shift(), tmpIconArray = icons.map(function(icon) {
        if (icon.isIcon()) {
          var width = icon.width, height = icon.height;
          return width === null && (width = icon.bitmapInfo.width), height === null && (height = icon.bitmapInfo.height, icon.masks !== null && (height = Math.floor(height / 2))), {
            base: icon,
            bm: {
              width,
              height,
              planes: icon.bitmapInfo.planes,
              bitCount: icon.bitmapInfo.bitCount
            },
            bin: icon.generate(),
            id: 0
          };
        } else
          return {
            base: icon,
            bm: {
              width: icon.width,
              height: icon.height,
              planes: 1,
              bitCount: icon.bitCount
            },
            bin: icon.bin,
            id: 0
          };
      });
      if (entry)
        for (var i = destEntries.length - 1; i >= 0; --i) {
          var e = destEntries[i];
          e != null && e.type === 3 && (isIconUsed(e, destEntries, entry) || destEntries.splice(i, 1));
        }
      else
        entry = {
          type: 14,
          id: iconGroupID,
          lang,
          codepage: 0,
          // set later
          bin: null
        }, destEntries.push(entry);
      var idInfo;
      tmpIconArray.forEach(function(icon) {
        idInfo?.last ? ++idInfo.id : idInfo = findUnusedIconID(destEntries, lang, !1), destEntries.push({
          type: 3,
          id: idInfo.id,
          lang,
          codepage: 0,
          bin: icon.bin
        }), icon.id = idInfo.id;
      });
      var binEntry = generateEntryBinary2(tmpIconArray.map(function(icon) {
        var width = Math.abs(icon.bm.width);
        width >= 256 && (width = 0);
        var height = Math.abs(icon.bm.height);
        height >= 256 && (height = 0);
        var colors = 0;
        if (icon.base.isIcon()) {
          var bmBase = icon.base.bitmapInfo;
          if (colors = bmBase.colorUsed || bmBase.colors.length, !colors)
            switch (bmBase.bitCount) {
              case 1:
                colors = 2;
                break;
              case 4:
                colors = 16;
                break;
            }
          colors >= 256 && (colors = 0);
        }
        return {
          width,
          height,
          colors,
          planes: icon.bm.planes,
          bitCount: icon.bm.bitCount,
          dataSize: icon.bin.byteLength,
          iconID: icon.id
        };
      }));
      entry.bin = binEntry;
      function isIconUsed(icon, allEntries, excludeGroup) {
        return allEntries.some(function(e2) {
          if (e2.type !== 14 || e2.id === excludeGroup.id && e2.lang === excludeGroup.lang)
            return !1;
          var g = new IconGroupEntry2(e2);
          return g.icons.some(function(c) {
            return c.iconID === icon.id;
          });
        });
      }
    }, IconGroupEntry2;
  })()
), IconGroupEntry_default = IconGroupEntry;

// node_modules/resedit/dist/resource/StringTableItem.js
var StringTableItem = (
  /** @class */
  (function() {
    function StringTableItem2() {
      this.length = 16, this._a = [], this._a.length = 16;
      for (var i = 0; i < 16; ++i)
        this._a[i] = "";
    }
    return StringTableItem2.fromEntry = function(bin, offset, byteLength) {
      for (var view = new DataView(bin, offset, byteLength), ret = new StringTableItem2(), o = 0, i = 0; i < 16; ++i) {
        var len = view.getUint16(o, !0);
        o += 2;
        for (var s = "", j = 0; j < len; ++j)
          s += String.fromCharCode(view.getUint16(o, !0)), o += 2;
        ret._a[i] = s;
      }
      return ret;
    }, StringTableItem2.prototype.get = function(index) {
      var value = this._a[index];
      return value != null && value !== "" ? value : null;
    }, StringTableItem2.prototype.getAll = function() {
      return this._a.map(function(s) {
        return s || null;
      });
    }, StringTableItem2.prototype.set = function(index, val) {
      this._a[index] = "".concat(val ?? "").substr(0, 4097);
    }, StringTableItem2.prototype.calcByteLength = function() {
      for (var len = 0, i = 0; i < 16; ++i) {
        var item = this._a[i];
        len += 2, item != null && (len += 2 * item.length);
      }
      return Math.floor((len + 15) / 16) * 16;
    }, StringTableItem2.prototype.generate = function(bin, offset) {
      for (var out = new DataView(bin, offset), len = 0, i = 0; i < 16; ++i) {
        var s = this._a[i], l = s == null ? 0 : s.length > 4097 ? 4097 : s.length;
        if (out.setUint16(len, l, !0), len += 2, s != null)
          for (var j = 0; j < l; ++j)
            out.setUint16(len, s.charCodeAt(j), !0), len += 2;
      }
      return Math.floor((len + 15) / 16) * 16;
    }, StringTableItem2;
  })()
), StringTableItem_default = StringTableItem;

// node_modules/resedit/dist/resource/StringTable.js
var StringTable = (
  /** @class */
  (function() {
    function StringTable2() {
      this.lang = 0, this.items = [];
    }
    return StringTable2.fromEntries = function(lang, entries) {
      var r = new StringTable2();
      return entries.forEach(function(e) {
        e.type !== 6 || e.lang !== lang || typeof e.id != "number" || e.id <= 0 || (r.items[e.id - 1] = StringTableItem_default.fromEntry(e.bin, 0, e.bin.byteLength));
      }), r.lang = lang, r;
    }, StringTable2.prototype.getAllStrings = function() {
      return this.items.map(function(e, i) {
        return e.getAll().map(function(x, j) {
          return x !== null && x !== "" ? { id: (i << 4) + j, text: x } : null;
        }).filter(function(x) {
          return !!x;
        });
      }).reduce(function(p, c) {
        return p.concat(c);
      }, []);
    }, StringTable2.prototype.getById = function(id) {
      var _a;
      if (id < 0)
        return null;
      var entryIndex = id >> 4, entryPos = id & 15, e = this.items[entryIndex];
      return (_a = e?.get(entryPos)) !== null && _a !== void 0 ? _a : null;
    }, StringTable2.prototype.setById = function(id, text) {
      if (!(id < 0)) {
        var entryIndex = id >> 4, entryPos = id & 15, e = this.items[entryIndex];
        e || (this.items[entryIndex] = e = new StringTableItem_default()), e.set(entryPos, text);
      }
    }, StringTable2.prototype.generateEntries = function() {
      var _this = this;
      return this.items.map(function(e, i) {
        var len = e.calcByteLength(), bin = new ArrayBuffer(len);
        return e.generate(bin, 0), {
          type: 6,
          id: i + 1,
          lang: _this.lang,
          codepage: 1200,
          bin
        };
      }).filter(function(e) {
        return !!e;
      });
    }, StringTable2.prototype.replaceStringEntriesForExecutable = function(res) {
      for (var entries = this.generateEntries(), dest = res.entries, i = 0; i < dest.length; ++i) {
        var e = dest[i];
        if (e != null && e.type === 6 && e.lang === this.lang) {
          for (var j = dest.length - 1; j >= i; --j) {
            var e2 = dest[j];
            e2 != null && e2.type === 6 && e2.lang === this.lang && dest.splice(j, 1);
          }
          var f = dest.splice.bind(dest, i, 0);
          f.apply(void 0, entries);
          return;
        }
      }
      for (var i = 0; i < dest.length; ++i) {
        var e = dest[i];
        if (e != null && e.type === 6 && e.lang < this.lang) {
          var f = dest.splice.bind(dest, i + 1, 0);
          f.apply(void 0, entries);
          return;
        }
      }
      for (var i = dest.length - 1; i >= 0; --i) {
        var e = dest[i];
        if (e != null && e.type === 6) {
          var f = dest.splice.bind(dest, i + 1, 0);
          f.apply(void 0, entries);
          return;
        }
      }
      dest.push.apply(dest, entries);
    }, StringTable2;
  })()
), StringTable_default = StringTable;

// node_modules/resedit/dist/resource/VersionFileFlags.js
var VersionFileFlags = {
  Debug: 1,
  Prerelease: 2,
  Patched: 4,
  PrivateBuild: 8,
  InfoInferred: 16,
  SpecialBuild: 32
}, VersionFileFlags_default = VersionFileFlags;

// node_modules/resedit/dist/resource/VersionFileOS.js
var VersionFileOS = {
  Unknown: 0,
  _Windows16: 1,
  _PM16: 2,
  _PM32: 3,
  _Windows32: 4,
  DOS: 65536,
  OS2_16: 131072,
  OS2_32: 196608,
  NT: 262144,
  DOS_Windows16: 65537,
  DOS_Windows32: 65540,
  NT_Windows32: 262148,
  OS2_16_PM16: 131074,
  OS2_32_PM32: 196611
}, VersionFileOS_default = VersionFileOS;

// node_modules/resedit/dist/resource/VersionFileSubtypes.js
var VersionFileDriverSubtype = {
  Unknown: 0,
  Printer: 1,
  Keyboard: 2,
  Language: 3,
  Display: 4,
  Mouse: 5,
  Network: 6,
  System: 7,
  Installable: 8,
  Sound: 9,
  Comm: 10,
  VersionedPrinter: 12
};
var VersionFileFontSubtype = {
  Unknown: 0,
  Raster: 1,
  Vector: 2,
  TrueType: 3
};

// node_modules/resedit/dist/resource/VersionFileType.js
var VersionFileType = {
  Unknown: 0,
  App: 1,
  DLL: 2,
  Driver: 3,
  Font: 4,
  VxD: 5,
  StaticLibrary: 7
}, VersionFileType_default = VersionFileType;

// node_modules/resedit/dist/resource/VersionInfo.js
function readStringToNullChar(view, offset, last) {
  for (var r = ""; offset + 2 <= last; ) {
    var c = view.getUint16(offset, !0);
    if (!c)
      break;
    r += String.fromCharCode(c), offset += 2;
  }
  return r;
}
function writeStringWithNullChar(view, offset, value) {
  for (var i = 0; i < value.length; ++i)
    view.setUint16(offset, value.charCodeAt(i), !0), offset += 2;
  return view.setUint16(offset, 0, !0), offset + 2;
}
function createFixedInfo() {
  return {
    fileVersionMS: 0,
    fileVersionLS: 0,
    productVersionMS: 0,
    productVersionLS: 0,
    fileFlagsMask: 0,
    fileFlags: 0,
    fileOS: 0,
    fileType: 0,
    fileSubtype: 0,
    fileDateMS: 0,
    fileDateLS: 0
  };
}
function parseStringTable(view, offset, last) {
  var tableLen = view.getUint16(offset, !0), valueLen = view.getUint16(offset + 2, !0);
  offset + tableLen < last && (last = offset + tableLen);
  var tableName = readStringToNullChar(view, offset + 6, last);
  offset += roundUp2(6 + 2 * (tableName.length + 1), 4);
  var langAndCp = parseInt(tableName, 16);
  if (isNaN(langAndCp))
    throw new Error("Invalid StringTable data format");
  offset += roundUp2(valueLen, 4);
  for (var r = {
    lang: Math.floor(langAndCp / 65536),
    codepage: langAndCp & 65535,
    values: {}
  }; offset < last; ) {
    var childDataLen = view.getUint16(offset, !0), childValueLen = view.getUint16(offset + 2, !0);
    if (view.getUint16(offset + 4, !0) !== 1) {
      offset += childDataLen;
      continue;
    }
    var childDataLast = offset + childDataLen;
    childDataLast > last && (childDataLast = last);
    var name_1 = readStringToNullChar(view, offset + 6, childDataLast);
    offset = roundUp2(offset + 6 + 2 * (name_1.length + 1), 4);
    var childValueLast = offset + childValueLen * 2;
    childValueLast > childDataLast && (childValueLast = childDataLast);
    var value = readStringToNullChar(view, offset, childValueLast);
    offset = roundUp2(childValueLast, 4), r.values[name_1] = value;
  }
  return [last, r];
}
function parseStringFileInfo(view, offset, last) {
  var valueLen = view.getUint16(offset + 2, !0);
  offset += 36, offset += roundUp2(valueLen, 4);
  for (var r = [], _loop_1 = function() {
    var childData = parseStringTable(view, offset, last), table = childData[1], a = r.filter(function(e) {
      return e.lang === table.lang && e.codepage === table.codepage;
    });
    if (a.length === 0)
      r.push(table);
    else
      for (var key in table.values) {
        var value = table.values[key];
        value != null && (a[0].values[key] = value);
      }
    offset = roundUp2(childData[0], 4);
  }; offset < last; )
    _loop_1();
  return r;
}
function parseVarFileInfo(view, offset, last) {
  var valueLen = view.getUint16(offset + 2, !0);
  offset += 32, offset += roundUp2(valueLen, 4);
  for (var r = []; offset < last; ) {
    var childDataLen = view.getUint16(offset, !0), childValueLen = view.getUint16(offset + 2, !0);
    if (view.getUint16(offset + 4, !0) !== 0) {
      offset += roundUp2(childDataLen, 4);
      continue;
    }
    var childDataLast = offset + childDataLen;
    childDataLast > last && (childDataLast = last);
    var name_2 = readStringToNullChar(view, offset + 6, childDataLast);
    if (offset = roundUp2(offset + 6 + 2 * (name_2.length + 1), 4), name_2 !== "Translation" || childValueLen % 4 !== 0) {
      offset = roundUp2(childDataLast, 4);
      continue;
    }
    for (var _loop_2 = function(child3) {
      if (offset + 4 > childDataLast)
        return "break";
      var lang = view.getUint16(offset, !0), codepage = view.getUint16(offset + 2, !0);
      offset += 4, r.filter(function(e) {
        return e.lang === lang && e.codepage === codepage;
      }).length === 0 && r.push({ lang, codepage });
    }, child2 = 0; child2 < childValueLen; child2 += 4) {
      var state_1 = _loop_2(child2);
      if (state_1 === "break")
        break;
    }
    offset = roundUp2(childDataLast, 4);
  }
  return r;
}
function parseVersionEntry(view, entry) {
  var totalLen = view.getUint16(0, !0), dataLen = view.getUint16(2, !0);
  if (view.getUint16(4, !0) !== 0)
    throw new Error("Invalid version data format");
  if (totalLen < dataLen + 40)
    throw new Error("Invalid version data format");
  if (readStringToNullChar(view, 6, totalLen) !== "VS_VERSION_INFO")
    throw new Error("Invalid version data format");
  var d = {
    lang: entry.lang,
    fixedInfo: createFixedInfo(),
    strings: [],
    translations: [],
    unknowns: []
  }, offset = 38;
  if (dataLen) {
    dataLen += 40;
    var sig = readUint32WithLastOffset(view, 40, dataLen), sVer = readUint32WithLastOffset(view, 44, dataLen);
    sig === 4277077181 && sVer <= 65536 && (d.fixedInfo = {
      fileVersionMS: readUint32WithLastOffset(view, 48, dataLen),
      fileVersionLS: readUint32WithLastOffset(view, 52, dataLen),
      productVersionMS: readUint32WithLastOffset(view, 56, dataLen),
      productVersionLS: readUint32WithLastOffset(view, 60, dataLen),
      fileFlagsMask: readUint32WithLastOffset(view, 64, dataLen),
      fileFlags: readUint32WithLastOffset(view, 68, dataLen),
      fileOS: readUint32WithLastOffset(view, 72, dataLen),
      fileType: readUint32WithLastOffset(view, 76, dataLen),
      fileSubtype: readUint32WithLastOffset(view, 80, dataLen),
      fileDateMS: readUint32WithLastOffset(view, 84, dataLen),
      fileDateLS: readUint32WithLastOffset(view, 88, dataLen)
    }), offset = dataLen;
  }
  for (offset = roundUp2(offset, 4); offset < totalLen; ) {
    var childLen = view.getUint16(offset, !0), childLast = offset + childLen;
    childLast > totalLen && (childLast = totalLen);
    var name_3 = readStringToNullChar(view, offset + 6, childLast);
    switch (name_3) {
      case "StringFileInfo":
        d.strings = d.strings.concat(parseStringFileInfo(view, offset, childLast));
        break;
      case "VarFileInfo":
        d.translations = d.translations.concat(parseVarFileInfo(view, offset, childLast));
        break;
      default:
        d.unknowns.push({
          name: name_3,
          entireBin: allocatePartialBinary2(view, offset, childLen)
        });
        break;
    }
    offset += roundUp2(childLen, 4);
  }
  return d;
}
function generateStringTable(table) {
  var size = 24, keys = Object.keys(table.values);
  size = keys.reduce(function(prev, key) {
    var value = table.values[key];
    if (value == null)
      return prev;
    var childHeaderSize = roundUp2(6 + 2 * (key.length + 1), 4), newSize = roundUp2(prev + childHeaderSize + 2 * (value.length + 1), 4);
    return newSize > 65532 ? prev : newSize;
  }, size);
  var bin = new ArrayBuffer(size), view = new DataView(bin);
  view.setUint16(0, size, !0), view.setUint16(2, 0, !0), view.setUint16(4, 1, !0);
  var langAndCp = ((table.lang & 65535) * 65536 + (table.codepage & 65535)).toString(16).toLowerCase();
  if (langAndCp.length < 8) {
    var l = 8 - langAndCp.length;
    langAndCp = "00000000".substr(0, l) + langAndCp;
  }
  var offset = roundUp2(writeStringWithNullChar(view, 6, langAndCp), 4);
  return keys.forEach(function(key) {
    var value = table.values[key];
    if (value != null) {
      var childHeaderSize = roundUp2(6 + 2 * (key.length + 1), 4), newSize = roundUp2(childHeaderSize + 2 * (value.length + 1), 4);
      offset + newSize <= 65532 && (view.setUint16(offset, newSize, !0), view.setUint16(offset + 2, value.length + 1, !0), view.setUint16(offset + 4, 1, !0), offset = roundUp2(writeStringWithNullChar(view, offset + 6, key), 4), offset = roundUp2(writeStringWithNullChar(view, offset, value), 4));
    }
  }), bin;
}
function generateStringTableInfo(tables) {
  var size = 36, tableBins = tables.map(function(table) {
    return generateStringTable(table);
  });
  size += tableBins.reduce(function(p, c) {
    return p + c.byteLength;
  }, 0);
  var bin = new ArrayBuffer(size), view = new DataView(bin);
  view.setUint16(0, size, !0), view.setUint16(2, 0, !0), view.setUint16(4, 1, !0);
  var offset = roundUp2(writeStringWithNullChar(view, 6, "StringFileInfo"), 4);
  return tableBins.forEach(function(table) {
    var len = table.byteLength;
    copyBuffer2(bin, offset, table, 0, len), offset += len;
  }), bin;
}
function generateVarFileInfo(translations) {
  var size = 32, translationsValueSize = translations.length * 4;
  size += 32 + translationsValueSize;
  var bin = new ArrayBuffer(size), view = new DataView(bin);
  view.setUint16(0, size, !0), view.setUint16(2, 0, !0), view.setUint16(4, 1, !0);
  var offset = roundUp2(writeStringWithNullChar(view, 6, "VarFileInfo"), 4);
  return view.setUint16(offset, 32 + translationsValueSize, !0), view.setUint16(offset + 2, translationsValueSize, !0), view.setUint16(offset + 4, 0, !0), offset = roundUp2(writeStringWithNullChar(view, offset + 6, "Translation"), 4), translations.forEach(function(translation) {
    view.setUint16(offset, translation.lang, !0), view.setUint16(offset + 2, translation.codepage, !0), offset += 4;
  }), bin;
}
function generateVersionEntryBinary(entry) {
  var size = 92, stringTableInfoBin = generateStringTableInfo(entry.strings), stringTableInfoLen = stringTableInfoBin.byteLength;
  size += stringTableInfoLen;
  var varFileInfoBin = generateVarFileInfo(entry.translations), varFileInfoLen = varFileInfoBin.byteLength;
  size += varFileInfoLen, size = entry.unknowns.reduce(function(p, data) {
    return p + roundUp2(data.entireBin.byteLength, 4);
  }, size);
  var bin = new ArrayBuffer(size), view = new DataView(bin);
  view.setUint16(0, size, !0), view.setUint16(2, 52, !0), view.setUint16(4, 0, !0);
  var offset = roundUp2(writeStringWithNullChar(view, 6, "VS_VERSION_INFO"), 4);
  return view.setUint32(offset, 4277077181, !0), view.setUint32(offset + 4, 65536, !0), view.setUint32(offset + 8, entry.fixedInfo.fileVersionMS, !0), view.setUint32(offset + 12, entry.fixedInfo.fileVersionLS, !0), view.setUint32(offset + 16, entry.fixedInfo.productVersionMS, !0), view.setUint32(offset + 20, entry.fixedInfo.productVersionLS, !0), view.setUint32(offset + 24, entry.fixedInfo.fileFlagsMask, !0), view.setUint32(offset + 28, entry.fixedInfo.fileFlags, !0), view.setUint32(offset + 32, entry.fixedInfo.fileOS, !0), view.setUint32(offset + 36, entry.fixedInfo.fileType, !0), view.setUint32(offset + 40, entry.fixedInfo.fileSubtype, !0), view.setUint32(offset + 44, entry.fixedInfo.fileDateMS, !0), view.setUint32(offset + 48, entry.fixedInfo.fileDateLS, !0), offset += 52, copyBuffer2(bin, offset, stringTableInfoBin, 0, stringTableInfoLen), offset += stringTableInfoLen, copyBuffer2(bin, offset, varFileInfoBin, 0, varFileInfoLen), offset += varFileInfoLen, entry.unknowns.forEach(function(e) {
    var len = e.entireBin.byteLength;
    copyBuffer2(bin, offset, e.entireBin, 0, len), offset += roundUp2(len, 4);
  }), bin;
}
function clampInt(val, min, max) {
  return isNaN(val) || val < min ? min : val >= max ? max : Math.floor(val);
}
function parseVersionArguments(arg1, arg2, arg3, arg4, arg5) {
  var _a, major, minor, micro, revision, lang;
  return typeof arg1 == "string" && (typeof arg2 > "u" || typeof arg2 == "number") && typeof arg3 > "u" ? (_a = arg1.split(".").map(function(token) {
    return clampInt(Number(token), 0, 65535);
  }).concat(0, 0, 0), major = _a[0], minor = _a[1], micro = _a[2], revision = _a[3], lang = arg2) : (major = clampInt(Number(arg1), 0, 65535), minor = clampInt(Number(arg2), 0, 65535), micro = clampInt(typeof arg3 > "u" ? 0 : Number(arg3), 0, 65535), revision = clampInt(typeof arg4 > "u" ? 0 : Number(arg4), 0, 65535), lang = arg5), [major, minor, micro, revision, lang];
}
var VersionInfo = (
  /** @class */
  (function() {
    function VersionInfo2(entry) {
      if (!entry)
        this.data = {
          lang: 0,
          fixedInfo: createFixedInfo(),
          strings: [],
          translations: [],
          unknowns: []
        };
      else {
        var view = new DataView(entry.bin);
        this.data = parseVersionEntry(view, entry);
      }
    }
    return VersionInfo2.createEmpty = function() {
      return new VersionInfo2();
    }, VersionInfo2.create = function(arg1, fixedInfo, strings) {
      var lang;
      typeof arg1 == "object" ? (lang = arg1.lang, fixedInfo = arg1.fixedInfo, strings = arg1.strings) : lang = arg1;
      var vi = new VersionInfo2();
      vi.data.lang = lang;
      for (var _fixedInfoKey in fixedInfo) {
        var fixedInfoKey = _fixedInfoKey;
        if (fixedInfoKey in fixedInfo) {
          var value = fixedInfo[fixedInfoKey];
          value != null && (vi.data.fixedInfo[fixedInfoKey] = value);
        }
      }
      return vi.data.strings = strings.map(function(_a) {
        var lang2 = _a.lang, codepage = _a.codepage, values = _a.values;
        return {
          lang: lang2,
          codepage,
          values: cloneObject2(values)
        };
      }), vi.data.translations = strings.map(function(_a) {
        var lang2 = _a.lang, codepage = _a.codepage;
        return { lang: lang2, codepage };
      }), vi;
    }, VersionInfo2.fromEntries = function(entries) {
      return entries.filter(function(e) {
        return e.type === 16;
      }).map(function(e) {
        return new VersionInfo2(e);
      });
    }, Object.defineProperty(VersionInfo2.prototype, "lang", {
      /** A language value for this resource entry. */
      get: function() {
        return this.data.lang;
      },
      set: function(value) {
        this.data.lang = value;
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(VersionInfo2.prototype, "fixedInfo", {
      /**
       * The property of fixed version info, containing file version, product version, etc.
       * (data: `VS_FIXEDFILEINFO`)
       *
       * Although this property is read-only, you can rewrite
       * each child fields directly to apply data.
       */
      get: function() {
        return this.data.fixedInfo;
      },
      enumerable: !1,
      configurable: !0
    }), VersionInfo2.prototype.getAvailableLanguages = function() {
      return this.data.translations.slice(0);
    }, VersionInfo2.prototype.replaceAvailableLanguages = function(languages) {
      this.data.translations = languages.slice(0);
    }, VersionInfo2.prototype.getStringValues = function(language) {
      var a = this.data.strings.filter(function(e) {
        return e.lang === language.lang && e.codepage === language.codepage;
      }).map(function(e) {
        return e.values;
      });
      return a.length > 0 ? a[0] : {};
    }, VersionInfo2.prototype.getAllLanguagesForStringValues = function() {
      return this.data.strings.map(function(_a) {
        var codepage = _a.codepage, lang = _a.lang;
        return { codepage, lang };
      });
    }, VersionInfo2.prototype.setStringValues = function(language, values, addToAvailableLanguage) {
      addToAvailableLanguage === void 0 && (addToAvailableLanguage = !0);
      var a = this.data.strings.filter(function(e) {
        return e.lang === language.lang && e.codepage === language.codepage;
      }), table;
      a.length === 0 ? (table = {
        lang: language.lang,
        codepage: language.codepage,
        values: {}
      }, this.data.strings.push(table)) : table = a[0];
      for (var key in values) {
        var value = values[key];
        value != null && (table.values[key] = value);
      }
      if (addToAvailableLanguage) {
        var t = this.data.translations.filter(function(e) {
          return e.lang === language.lang && e.codepage === language.codepage;
        });
        t.length === 0 && this.data.translations.push({
          lang: language.lang,
          codepage: language.codepage
        });
      }
    }, VersionInfo2.prototype.setStringValue = function(language, key, value, addToAvailableLanguage) {
      var _a;
      addToAvailableLanguage === void 0 && (addToAvailableLanguage = !0), this.setStringValues(language, (_a = {}, _a[key] = value, _a), addToAvailableLanguage);
    }, VersionInfo2.prototype.removeAllStringValues = function(language, removeFromAvailableLanguage) {
      removeFromAvailableLanguage === void 0 && (removeFromAvailableLanguage = !0);
      for (var strings = this.data.strings, len = strings.length, i = 0; i < len; ++i) {
        var e = strings[i];
        if (e != null && e.lang === language.lang && e.codepage === language.codepage) {
          if (strings.splice(i, 1), removeFromAvailableLanguage)
            for (var translations = this.data.translations, j = 0; j < translations.length; j++) {
              var t = translations[j];
              if (t != null && t.lang === language.lang && t.codepage === language.codepage) {
                translations.splice(j, 1);
                break;
              }
            }
          break;
        }
      }
    }, VersionInfo2.prototype.removeStringValue = function(language, key, removeFromAvailableLanguage) {
      removeFromAvailableLanguage === void 0 && (removeFromAvailableLanguage = !0);
      for (var strings = this.data.strings, len = strings.length, i = 0; i < len; ++i) {
        var e = strings[i];
        if (e != null && e.lang === language.lang && e.codepage === language.codepage) {
          try {
            delete e.values[key];
          } catch {
          }
          if (removeFromAvailableLanguage && Object.keys(e.values).length === 0) {
            strings.splice(i, 1);
            for (var translations = this.data.translations, j = 0; j < translations.length; j++) {
              var t = translations[j];
              if (t != null && t.lang === language.lang && t.codepage === language.codepage) {
                translations.splice(j, 1);
                break;
              }
            }
          }
          break;
        }
      }
    }, VersionInfo2.prototype.generateResource = function() {
      var bin = generateVersionEntryBinary(this.data);
      return {
        type: 16,
        id: 1,
        lang: this.lang,
        codepage: 1200,
        bin
      };
    }, VersionInfo2.prototype.outputToResourceEntries = function(entries) {
      for (var res = this.generateResource(), len = entries.length, i = 0; i < len; ++i) {
        var e = entries[i];
        if (e != null && e.type === 16 && e.id === res.id && e.lang === res.lang) {
          entries[i] = res;
          return;
        }
      }
      entries.push(res);
    }, VersionInfo2.prototype.getDefaultVersionLang = function(propName) {
      var num = Number(this.lang);
      if (this.lang !== "" && !isNaN(num))
        return num;
      var a = this.data.strings.filter(function(e) {
        return propName in e.values && e.values[propName] != null;
      }).map(function(e) {
        return e.lang;
      });
      return a.length === 1 ? a[0] : 1033;
    }, VersionInfo2.prototype.setFileVersion = function(arg1, arg2, arg3, arg4, arg5) {
      this.setFileVersionImpl.apply(this, parseVersionArguments(arg1, arg2, arg3, arg4, arg5));
    }, VersionInfo2.prototype.setFileVersionImpl = function(major, minor, micro, revision, lang) {
      lang = typeof lang < "u" ? lang : this.getDefaultVersionLang("FileVersion"), this.fixedInfo.fileVersionMS = major << 16 | minor, this.fixedInfo.fileVersionLS = micro << 16 | revision, this.setStringValue({ lang, codepage: 1200 }, "FileVersion", "".concat(major, ".").concat(minor, ".").concat(micro, ".").concat(revision), !0);
    }, VersionInfo2.prototype.setProductVersion = function(arg1, arg2, arg3, arg4, arg5) {
      this.setProductVersionImpl.apply(this, parseVersionArguments(arg1, arg2, arg3, arg4, arg5));
    }, VersionInfo2.prototype.setProductVersionImpl = function(major, minor, micro, revision, lang) {
      lang = typeof lang < "u" ? lang : this.getDefaultVersionLang("ProductVersion"), this.fixedInfo.productVersionMS = major << 16 | minor, this.fixedInfo.productVersionLS = micro << 16 | revision, this.setStringValue({ lang, codepage: 1200 }, "ProductVersion", "".concat(major, ".").concat(minor, ".").concat(micro, ".").concat(revision), !0);
    }, VersionInfo2;
  })()
), VersionInfo_default = VersionInfo;

// node_modules/resedit/dist/sign/data/DERObject.js
var RawDERObject = (
  /** @class */
  (function() {
    function RawDERObject2(data) {
      this.data = data;
    }
    return RawDERObject2.prototype.toDER = function() {
      return [].slice.call(this.data);
    }, RawDERObject2;
  })()
);

// node_modules/resedit/dist/sign/data/derUtil.js
function makeDERLength(length) {
  if (length < 128)
    return [length];
  for (var r = []; r.push(length & 255), !(length < 256); )
    length >>= 8;
  return r.push(128 + r.length), r.reverse();
}
function makeDERIA5String(text) {
  var r = [].map.call(text, function(c) {
    return c.charCodeAt(0);
  }).filter(function(n) {
    return n < 128;
  });
  return [22].concat(makeDERLength(r.length)).concat(r);
}
function makeDERBMPString(text) {
  var r = [].map.call(text, function(c) {
    return c.charCodeAt(0);
  }), ua = new Uint8Array(r.length * 2), dv = new DataView(ua.buffer);
  return r.forEach(function(v, i) {
    dv.setUint16(i * 2, v, !1);
  }), [30].concat(makeDERLength(ua.length)).concat(
    // convert Uint8Array to number[] (not using spread operator)
    [].slice.call(ua)
  );
}
function makeDEROctetString(bin) {
  return bin instanceof Array || (bin = [].slice.call(bin)), [4].concat(makeDERLength(bin.length)).concat(bin);
}
function makeDERTaggedData(tag, body) {
  return [160 + tag].concat(makeDERLength(body.length)).concat(body);
}
function makeDERSequence(body) {
  return [48].concat(makeDERLength(body.length)).concat(body);
}
function arrayToDERSet(items) {
  var r = items.reduce(function(prev, item) {
    return prev.concat(item instanceof Array ? item : item.toDER());
  }, []);
  return [49].concat(makeDERLength(r.length)).concat(r);
}

// node_modules/resedit/dist/sign/data/ObjectIdentifier.js
var ObjectIdentifier = (
  /** @class */
  (function() {
    function ObjectIdentifier2(value) {
      typeof value == "string" ? this.value = value.split(/\./g).map(function(s) {
        return Number(s);
      }) : this.value = value;
    }
    return ObjectIdentifier2.prototype.toDER = function() {
      var id = this.value, r = [];
      if (id.length < 2)
        throw new Error("Unexpected 'value' field");
      r.push(id[0] * 40 + id[1]);
      for (var i = 2; i < id.length; ++i)
        for (var val = id[i], isFirst = !0, insertPos = r.length; ; ) {
          var v = val & 127;
          if (isFirst || (v += 128), r.splice(insertPos, 0, v), val < 128)
            break;
          isFirst = !1, val = Math.floor(val / 128);
        }
      return [6].concat(makeDERLength(r.length)).concat(r);
    }, ObjectIdentifier2;
  })()
), ObjectIdentifier_default = ObjectIdentifier;

// node_modules/resedit/dist/sign/data/KnownOids.js
var OID_SHA1_NO_SIGN = new ObjectIdentifier_default([1, 3, 14, 3, 2, 26]), OID_SHA256_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 1]), OID_SHA384_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 2]), OID_SHA512_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 3]), OID_SHA224_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 4]), OID_SHA512_224_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 5]), OID_SHA512_256_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 6]), OID_SHA3_224_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 7]), OID_SHA3_256_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 8]), OID_SHA3_384_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 9]), OID_SHA3_512_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 10]), OID_SHAKE128_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 11]), OID_SHAKE256_NO_SIGN = new ObjectIdentifier_default([2, 16, 840, 1, 101, 3, 4, 2, 12]), OID_RSA = new ObjectIdentifier_default([1, 2, 840, 113549, 1, 1, 1]), OID_DSA = new ObjectIdentifier_default([1, 2, 840, 10040, 4, 1]), OID_SIGNED_DATA = new ObjectIdentifier_default([1, 2, 840, 113549, 1, 7, 2]), OID_CONTENT_TYPE = new ObjectIdentifier_default([1, 2, 840, 113549, 1, 9, 3]), OID_MESSAGE_DIGEST = new ObjectIdentifier_default([1, 2, 840, 113549, 1, 9, 4]), OID_SPC_STATEMENT_TYPE_OBJID = new ObjectIdentifier_default([1, 3, 6, 1, 4, 1, 311, 2, 1, 11]), OID_SPC_SP_OPUS_INFO_OBJID = new ObjectIdentifier_default([1, 3, 6, 1, 4, 1, 311, 2, 1, 12]), OID_SPC_INDIVIDUAL_SP_KEY_PURPOSE_OBJID = new ObjectIdentifier_default([1, 3, 6, 1, 4, 1, 311, 2, 1, 21]), OID_RFC3161_COUNTER_SIGNATURE = new ObjectIdentifier_default([1, 3, 6, 1, 4, 1, 311, 3, 3, 1]);

// node_modules/resedit/dist/sign/data/AlgorithmIdentifier.js
var AlgorithmIdentifier = (
  /** @class */
  (function() {
    function AlgorithmIdentifier2(algorithm) {
      this.algorithm = algorithm;
    }
    return AlgorithmIdentifier2.prototype.toDER = function() {
      var r = this.algorithm.toDER();
      return makeDERSequence(r.concat(
        // parameters is not used now
        [5, 0]
      ));
    }, AlgorithmIdentifier2;
  })()
);

// node_modules/resedit/dist/sign/data/Attribute.js
var Attribute = (
  /** @class */
  (function() {
    function Attribute2(attrType, attrValues) {
      this.attrType = attrType, this.attrValues = attrValues;
    }
    return Attribute2.prototype.toDER = function() {
      return makeDERSequence(this.attrType.toDER().concat(arrayToDERSet(this.attrValues)));
    }, Attribute2;
  })()
);

// node_modules/resedit/dist/sign/data/ContentInfo.js
var ContentInfo = (
  /** @class */
  (function() {
    function ContentInfo2(contentType, content) {
      this.contentType = contentType, this.content = content;
    }
    return ContentInfo2.prototype.toDER = function() {
      return makeDERSequence(this.contentType.toDER().concat(makeDERTaggedData(0, this.content.toDER())));
    }, ContentInfo2;
  })()
), ContentInfo_default = ContentInfo;

// node_modules/resedit/dist/sign/data/CertificateDataRoot.js
var __extends9 = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    return extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) Object.prototype.hasOwnProperty.call(b2, p) && (d2[p] = b2[p]);
    }, extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b != "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})(), CertificateDataRoot = (
  /** @class */
  (function(_super) {
    __extends9(CertificateDataRoot2, _super);
    function CertificateDataRoot2() {
      return _super !== null && _super.apply(this, arguments) || this;
    }
    return CertificateDataRoot2;
  })(ContentInfo_default)
);

// node_modules/resedit/dist/sign/data/DigestInfo.js
var DigestInfo = (
  /** @class */
  (function() {
    function DigestInfo2(digestAlgorithm, digest) {
      this.digestAlgorithm = digestAlgorithm, this.digest = digest;
    }
    return DigestInfo2.prototype.toDER = function() {
      var digest = this.digest, digestArray;
      "buffer" in digest ? digestArray = new Uint8Array(digest.buffer, digest.byteOffset, digest.byteLength) : digestArray = new Uint8Array(digest);
      var derData = this.digestAlgorithm.toDER().concat(makeDEROctetString(digestArray));
      return makeDERSequence(derData);
    }, DigestInfo2;
  })()
);

// node_modules/resedit/dist/sign/data/IssuerAndSerialNumber.js
var IssuerAndSerialNumber = (
  /** @class */
  (function() {
    function IssuerAndSerialNumber2(issuer, serialNumber) {
      this.issuer = issuer, this.serialNumber = serialNumber;
    }
    return IssuerAndSerialNumber2.prototype.toDER = function() {
      return makeDERSequence(this.issuer.toDER().concat(this.serialNumber.toDER()));
    }, IssuerAndSerialNumber2;
  })()
);

// node_modules/resedit/dist/sign/data/SignedData.js
var SignedData = (
  /** @class */
  (function() {
    function SignedData2(version, digestAlgorithms, contentInfo, signerInfos, certificates, crls) {
      this.version = version, this.digestAlgorithms = digestAlgorithms, this.contentInfo = contentInfo, this.signerInfos = signerInfos, this.certificates = certificates, this.crls = crls;
    }
    return SignedData2.prototype.toDER = function() {
      var r = [2, 1, this.version & 255].concat(arrayToDERSet(this.digestAlgorithms)).concat(this.contentInfo.toDER());
      if (this.certificates && this.certificates.length > 0) {
        var allCertsDER = arrayToDERSet(this.certificates);
        allCertsDER[0] = 160, r = r.concat(allCertsDER);
      }
      return this.crls && (r = r.concat(makeDERTaggedData(1, arrayToDERSet(this.crls)))), r = r.concat(arrayToDERSet(this.signerInfos)), makeDERSequence(r);
    }, SignedData2;
  })()
);

// node_modules/resedit/dist/sign/data/SignerInfo.js
var SignerInfo = (
  /** @class */
  (function() {
    function SignerInfo2(version, issuerAndSerialNumber, digestAlgorithm, digestEncryptionAlgorithm, encryptedDigest, authenticatedAttributes, unauthenticatedAttributes) {
      this.version = version, this.issuerAndSerialNumber = issuerAndSerialNumber, this.digestAlgorithm = digestAlgorithm, this.digestEncryptionAlgorithm = digestEncryptionAlgorithm, this.encryptedDigest = encryptedDigest, this.authenticatedAttributes = authenticatedAttributes, this.unauthenticatedAttributes = unauthenticatedAttributes;
    }
    return SignerInfo2.prototype.toDER = function() {
      var r = [2, 1, this.version & 255].concat(this.issuerAndSerialNumber.toDER()).concat(this.digestAlgorithm.toDER());
      if (this.authenticatedAttributes && this.authenticatedAttributes.length > 0) {
        var a = arrayToDERSet(this.authenticatedAttributes);
        a[0] = 160, r = r.concat(a);
      }
      if (r = r.concat(this.digestEncryptionAlgorithm.toDER()).concat(makeDEROctetString(this.encryptedDigest)), this.unauthenticatedAttributes && this.unauthenticatedAttributes.length > 0) {
        var u = arrayToDERSet(this.unauthenticatedAttributes);
        u[0] = 161, r = r.concat(u);
      }
      return makeDERSequence(r);
    }, SignerInfo2;
  })()
);

// node_modules/resedit/dist/sign/data/SpcIndirectDataContent.js
var __extends10 = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    return extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) Object.prototype.hasOwnProperty.call(b2, p) && (d2[p] = b2[p]);
    }, extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b != "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})(), SPC_INDIRECT_DATA_OBJID = new ObjectIdentifier_default([1, 3, 6, 1, 4, 1, 311, 2, 1, 4]), SpcAttributeTypeAndOptionalValue = (
  /** @class */
  (function() {
    function SpcAttributeTypeAndOptionalValue2(type, value) {
      this.type = type, this.value = value;
    }
    return SpcAttributeTypeAndOptionalValue2.prototype.toDER = function() {
      return makeDERSequence(this.type.toDER().concat(this.value.toDER()));
    }, SpcAttributeTypeAndOptionalValue2;
  })()
);
var SpcIndirectDataContent = (
  /** @class */
  (function() {
    function SpcIndirectDataContent2(data, messageDigest) {
      this.data = data, this.messageDigest = messageDigest;
    }
    return SpcIndirectDataContent2.prototype.toDER = function() {
      return makeDERSequence(this.toDERWithoutHeader());
    }, SpcIndirectDataContent2.prototype.toDERWithoutHeader = function() {
      return this.data.toDER().concat(this.messageDigest.toDER());
    }, SpcIndirectDataContent2;
  })()
);
var SpcIndirectDataContentInfo = (
  /** @class */
  (function(_super) {
    __extends10(SpcIndirectDataContentInfo2, _super);
    function SpcIndirectDataContentInfo2(content) {
      return _super.call(this, SPC_INDIRECT_DATA_OBJID, content) || this;
    }
    return SpcIndirectDataContentInfo2;
  })(ContentInfo_default)
);

// node_modules/resedit/dist/sign/data/SpcLink.js
var __extends11 = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    return extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) Object.prototype.hasOwnProperty.call(b2, p) && (d2[p] = b2[p]);
    }, extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b != "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})(), SpcLink = (
  /** @class */
  (function() {
    function SpcLink2(tag, value) {
      this.tag = tag, this.value = value;
    }
    return SpcLink2.prototype.toDER = function() {
      var v = this.value.toDER();
      return this.tag === 2 ? makeDERTaggedData(this.tag, v) : (v[0] = 128 + this.tag, v);
    }, SpcLink2;
  })()
);
var SpcLinkUrl = (
  /** @class */
  (function(_super) {
    __extends11(SpcLinkUrl2, _super);
    function SpcLinkUrl2(url) {
      return _super.call(this, 0, new RawDERObject(makeDERIA5String(url))) || this;
    }
    return SpcLinkUrl2;
  })(SpcLink)
);
var SpcLinkFile = (
  /** @class */
  (function(_super) {
    __extends11(SpcLinkFile2, _super);
    function SpcLinkFile2(file) {
      var v = makeDERBMPString(file);
      return v[0] = 128, _super.call(this, 2, new RawDERObject(v)) || this;
    }
    return SpcLinkFile2;
  })(SpcLink)
);

// node_modules/resedit/dist/sign/data/SpcPeImageData.js
var __extends12 = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    return extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) Object.prototype.hasOwnProperty.call(b2, p) && (d2[p] = b2[p]);
    }, extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b != "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})(), SPC_PE_IMAGE_DATA_OBJID = new ObjectIdentifier_default([1, 3, 6, 1, 4, 1, 311, 2, 1, 15]);
var SpcPeImageData = (
  /** @class */
  (function() {
    function SpcPeImageData2(flags, file) {
      this.flags = flags, this.file = file;
    }
    return SpcPeImageData2.prototype.toDER = function() {
      return makeDERSequence([3, 1, this.flags & 255].concat(
        // undocumented -- SpcLink must be tagged
        makeDERTaggedData(0, this.file.toDER())
      ));
    }, SpcPeImageData2;
  })()
);
var SpcPeImageAttributeTypeAndOptionalValue = (
  /** @class */
  (function(_super) {
    __extends12(SpcPeImageAttributeTypeAndOptionalValue2, _super);
    function SpcPeImageAttributeTypeAndOptionalValue2(value) {
      return _super.call(this, SPC_PE_IMAGE_DATA_OBJID, value) || this;
    }
    return SpcPeImageAttributeTypeAndOptionalValue2;
  })(SpcAttributeTypeAndOptionalValue)
);

// packages/core/src/windows-metadata-apply.ts
var RT_MANIFEST = 24, defaultDeps = {
  readFile: (p) => readFile2(p),
  writeFile: async (p, d) => {
    await writeFile3(p, d);
  }
};
function toArrayBuffer(u) {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
}
async function applyWindowsMetadata(inputPath, outputPath, meta, deps = defaultDeps) {
  meta.fileVersion !== void 0 && padVersionQuad(meta.fileVersion), meta.productVersion !== void 0 && padVersionQuad(meta.productVersion);
  let exe;
  try {
    let raw = await deps.readFile(inputPath);
    exe = NtExecutable_default.from(toArrayBuffer(raw), { ignoreCert: !0 });
  } catch (err) {
    throw new ResEditError(`Failed to parse "${inputPath}" as a PE executable.`, { cause: err });
  }
  let res = NtExecutableResource_default.from(exe);
  writeVersionInfo(res, meta), await writeIcons(res, meta.icons, meta.lang, deps), await writeManifest(res, meta, deps), res.outputResource(exe);
  let out = exe.generate();
  try {
    await deps.writeFile(outputPath, new Uint8Array(out));
  } catch (err) {
    throw new ResEditError(`Failed to write patched binary "${outputPath}".`, { cause: err });
  }
}
function writeVersionInfo(res, meta) {
  let copyright = meta.legalCopyright ?? (meta.companyName !== void 0 ? `\xA9 ${String((/* @__PURE__ */ new Date()).getUTCFullYear())} ${meta.companyName}` : void 0), strings = {};
  if (meta.productName !== void 0 && (strings.ProductName = meta.productName), meta.fileDescription !== void 0 && (strings.FileDescription = meta.fileDescription), meta.companyName !== void 0 && (strings.CompanyName = meta.companyName), copyright !== void 0 && (strings.LegalCopyright = copyright), meta.originalFilename !== void 0 && (strings.OriginalFilename = meta.originalFilename), meta.internalName !== void 0 && (strings.InternalName = meta.internalName), meta.comments !== void 0 && (strings.Comments = meta.comments), !(Object.keys(strings).length > 0 || meta.productVersion !== void 0 || meta.fileVersion !== void 0)) return;
  let vi = resource_exports.VersionInfo.createEmpty();
  vi.lang = meta.lang, Object.keys(strings).length > 0 && vi.setStringValues({ lang: meta.lang, codepage: meta.codepage }, strings), meta.fileVersion !== void 0 && vi.setFileVersion(meta.fileVersion, meta.lang), meta.productVersion !== void 0 && vi.setProductVersion(meta.productVersion, meta.lang), vi.outputToResourceEntries(res.entries);
}
async function writeIcons(res, icons, lang, deps) {
  for (let spec of icons) {
    let raw;
    try {
      raw = await deps.readFile(spec.path);
    } catch (err) {
      throw new ResEditError(`Failed to read icon "${spec.path}".`, { cause: err });
    }
    let iconFile;
    try {
      iconFile = data_exports.IconFile.from(toArrayBuffer(raw));
    } catch (err) {
      throw new ResEditError(`Icon "${spec.path}" is not a valid .ico file.`, { cause: err });
    }
    resource_exports.IconGroupEntry.replaceIconsForResource(
      res.entries,
      spec.id,
      lang,
      iconFile.icons.map((item) => item.data)
    );
  }
}
async function writeManifest(res, meta, deps) {
  if (meta.manifestPath === void 0) return;
  let raw;
  try {
    raw = await deps.readFile(meta.manifestPath);
  } catch (err) {
    throw new ResEditError(`Failed to read manifest "${meta.manifestPath}".`, { cause: err });
  }
  res.replaceResourceEntry({
    type: RT_MANIFEST,
    id: 1,
    lang: meta.lang,
    codepage: meta.codepage,
    bin: toArrayBuffer(raw)
  });
}

// packages/core/src/signing.ts
import { writeFile as writeFile4 } from "node:fs/promises";
import { join as join6 } from "node:path";
import { randomBytes } from "node:crypto";
function parseSigningInputs(opts = {}) {
  let env = opts.env ?? process.env, registerSecret = opts.registerSecret ?? (() => {
  }), macosIdentity = readInputRaw(env, "macos-sign-identity"), macosCert = readInputRaw(env, "macos-sign-certificate"), macosKeychainPw = readInputRaw(env, "macos-keychain-password"), macosEntitlements = readInputRaw(env, "macos-entitlements"), macosNotarize = parseBool(readInputRaw(env, "macos-notarize"), "macos-notarize", !1), macosAppleId = readInputRaw(env, "macos-apple-id"), macosTeamId = readInputRaw(env, "macos-team-id"), macosAppPw = readInputRaw(env, "macos-app-password");
  macosCert !== void 0 && registerSecret(macosCert), macosKeychainPw !== void 0 && registerSecret(macosKeychainPw), macosAppleId !== void 0 && registerSecret(macosAppleId), macosTeamId !== void 0 && registerSecret(macosTeamId), macosAppPw !== void 0 && registerSecret(macosAppPw);
  let macos;
  if (macosIdentity !== void 0 || macosCert !== void 0 || macosKeychainPw !== void 0) {
    if (macosIdentity === void 0 || macosCert === void 0 || macosKeychainPw === void 0)
      throw new ValidationError(
        "macOS signing requires all of macos-sign-identity, macos-sign-certificate, macos-keychain-password."
      );
    if (macosNotarize && (macosAppleId === void 0 || macosTeamId === void 0 || macosAppPw === void 0))
      throw new ValidationError(
        "macos-notarize=true requires macos-apple-id, macos-team-id, macos-app-password."
      );
    macos = {
      identity: macosIdentity,
      certificate: macosCert,
      keychainPassword: macosKeychainPw,
      entitlements: macosEntitlements,
      notarize: macosNotarize,
      appleId: macosAppleId,
      teamId: macosTeamId,
      appPassword: macosAppPw
    };
  }
  let windowsMode = parseWindowsSignMode(readInputRaw(env, "windows-sign-mode") ?? "none"), signtoolCert = readInputRaw(env, "windows-sign-cert"), signtoolPw = readInputRaw(env, "windows-sign-password"), signtoolTimestamp = readInputRaw(env, "windows-sign-rfc3161-url") ?? "http://timestamp.digicert.com", signDescription = readInputRaw(env, "windows-sign-description"), azureTenant = readInputRaw(env, "azure-tenant-id"), azureClient = readInputRaw(env, "azure-client-id"), azureSecret = readInputRaw(env, "azure-client-secret"), azureEndpoint = readInputRaw(env, "azure-endpoint"), azureProfile = readInputRaw(env, "azure-cert-profile");
  signtoolCert !== void 0 && registerSecret(signtoolCert), signtoolPw !== void 0 && registerSecret(signtoolPw), azureTenant !== void 0 && registerSecret(azureTenant), azureClient !== void 0 && registerSecret(azureClient), azureSecret !== void 0 && registerSecret(azureSecret);
  let windowsSigntool, windowsTrusted;
  if (windowsMode === "signtool") {
    if (signtoolCert === void 0 || signtoolPw === void 0)
      throw new ValidationError(
        "windows-sign-mode=signtool requires windows-sign-cert and windows-sign-password."
      );
    if (azureTenant !== void 0 || azureClient !== void 0 || azureEndpoint !== void 0)
      throw new ValidationError(
        "windows-sign-mode=signtool cannot be combined with azure-* inputs. Set windows-sign-mode=trusted-signing instead."
      );
    windowsSigntool = {
      certificate: signtoolCert,
      password: signtoolPw,
      timestampUrl: signtoolTimestamp,
      description: signDescription
    };
  } else if (windowsMode === "trusted-signing") {
    if (azureTenant === void 0 || azureClient === void 0 || azureSecret === void 0 || azureEndpoint === void 0 || azureProfile === void 0)
      throw new ValidationError(
        "windows-sign-mode=trusted-signing requires all of azure-tenant-id, azure-client-id, azure-client-secret, azure-endpoint, azure-cert-profile."
      );
    if (signtoolCert !== void 0 || signtoolPw !== void 0)
      throw new ValidationError(
        "windows-sign-mode=trusted-signing cannot be combined with windows-sign-cert/password."
      );
    windowsTrusted = {
      tenantId: azureTenant,
      clientId: azureClient,
      clientSecret: azureSecret,
      endpoint: azureEndpoint,
      certProfile: azureProfile,
      description: signDescription
    };
  }
  return macos === void 0 && windowsMode === "none" ? null : { macos, windowsMode, windowsSigntool, windowsTrusted };
}
function parseBool(value, name, fallback) {
  if (value === void 0) return fallback;
  let v = value.toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return !0;
  if (v === "false" || v === "0" || v === "no") return !1;
  throw new ValidationError(`Input "${name}" expected a boolean, got "${value}".`);
}
function parseWindowsSignMode(raw) {
  if (raw === "none" || raw === "signtool" || raw === "trusted-signing") return raw;
  throw new ValidationError(
    `windows-sign-mode must be one of: none | signtool | trusted-signing. Got "${raw}".`
  );
}
async function runCheckedTool(command, args, label, deps, opts = {}) {
  deps.logger.info(`[pkg-action] ${label}: ${command} ${args.join(" ")}`);
  let result = await deps.exec(command, args, {
    ignoreReturnCode: !0,
    ...opts.env !== void 0 ? { env: opts.env } : {}
  });
  if (result.exitCode !== 0)
    throw new SignError(`${label} failed (exit ${String(result.exitCode)}). See stderr above.`);
}
async function writeSecretBase64(base64, extension, deps) {
  let path4 = join6(deps.tempDir, `${randomBytes(8).toString("hex")}.${extension}`), bytes = Buffer.from(base64, "base64");
  return await (deps.writeFile ?? ((p, d) => writeFile4(p, d, { mode: 384 })))(path4, bytes), path4;
}
async function signMacos(binaryPath, cfg, deps) {
  let keychainPath = join6(
    deps.tempDir,
    `pkg-action-${randomBytes(6).toString("hex")}.keychain-db`
  ), p12Path = await writeSecretBase64(cfg.certificate, "p12", deps);
  await runCheckedTool(
    "security",
    ["create-keychain", "-p", cfg.keychainPassword, keychainPath],
    "security create-keychain",
    deps
  ), await runCheckedTool(
    "security",
    ["set-keychain-settings", "-lut", "21600", keychainPath],
    "security set-keychain-settings",
    deps
  ), await runCheckedTool(
    "security",
    ["unlock-keychain", "-p", cfg.keychainPassword, keychainPath],
    "security unlock-keychain",
    deps
  ), await runCheckedTool(
    "security",
    [
      "import",
      p12Path,
      "-k",
      keychainPath,
      "-P",
      cfg.keychainPassword,
      "-T",
      "/usr/bin/codesign",
      "-T",
      "/usr/bin/security"
    ],
    "security import",
    deps
  ), await runCheckedTool(
    "security",
    [
      "set-key-partition-list",
      "-S",
      "apple-tool:,apple:,codesign:",
      "-s",
      "-k",
      cfg.keychainPassword,
      keychainPath
    ],
    "security set-key-partition-list",
    deps
  );
  let codesignArgs = [
    "--force",
    "--timestamp",
    "--options",
    "runtime",
    "--keychain",
    keychainPath,
    "--sign",
    cfg.identity
  ];
  return cfg.entitlements !== void 0 && codesignArgs.push("--entitlements", cfg.entitlements), codesignArgs.push(binaryPath), await runCheckedTool("codesign", codesignArgs, "codesign", deps), await runCheckedTool(
    "codesign",
    ["--verify", "--strict", "--verbose=2", binaryPath],
    "codesign --verify",
    deps
  ), cfg.notarize && (await runCheckedTool(
    "xcrun",
    [
      "notarytool",
      "submit",
      binaryPath,
      "--apple-id",
      cfg.appleId,
      "--team-id",
      cfg.teamId,
      "--password",
      cfg.appPassword,
      "--wait"
    ],
    "xcrun notarytool submit",
    deps
  ), deps.logger.info(
    "[pkg-action] notarytool submit succeeded. Note: bare binaries cannot be stapled; Gatekeeper queries Apple at first launch."
  )), { keychainPath };
}
async function signWindowsSigntool(binaryPath, cfg, deps) {
  let pfxPath = await writeSecretBase64(cfg.certificate, "pfx", deps), args = [
    "sign",
    "/fd",
    "sha256",
    "/td",
    "sha256",
    "/tr",
    cfg.timestampUrl,
    "/f",
    pfxPath,
    "/p",
    cfg.password
  ];
  cfg.description !== void 0 && args.push("/d", cfg.description), args.push(binaryPath), await runCheckedTool("signtool", args, "signtool sign", deps), await runCheckedTool("signtool", ["verify", "/pa", "/v", binaryPath], "signtool verify", deps);
}
async function signWindowsTrustedSigning(binaryPath, cfg, deps) {
  let env = {
    AZURE_TENANT_ID: cfg.tenantId,
    AZURE_CLIENT_ID: cfg.clientId,
    AZURE_CLIENT_SECRET: cfg.clientSecret
  }, args = [
    "sign",
    "-kvu",
    cfg.endpoint,
    "-kvc",
    cfg.certProfile,
    "-tr",
    "http://timestamp.acs.microsoft.com",
    "-td",
    "sha256",
    "-fd",
    "sha256"
  ];
  cfg.description !== void 0 && args.push("-d", cfg.description), args.push(binaryPath), await runCheckedTool("azuresigntool", args, "azuresigntool sign", deps, { env }), await runCheckedTool("signtool", ["verify", "/pa", "/v", binaryPath], "signtool verify", deps);
}

// packages/core/src/version.ts
var VERSION = "0.0.0";

// packages/build/src/main.ts
var execBridge = async (command, args, options) => {
  let opts = {};
  if (options.ignoreReturnCode !== void 0 && (opts.ignoreReturnCode = options.ignoreReturnCode), options.cwd !== void 0 && (opts.cwd = options.cwd), options.env !== void 0) {
    let merged = {};
    for (let [k, v] of Object.entries(process.env))
      v !== void 0 && (merged[k] = v);
    for (let [k, v] of Object.entries(options.env)) merged[k] = v;
    opts.env = merged;
  }
  let result = await getExecOutput(command, [...args], opts);
  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr
  };
};
async function main() {
  let logger = actionsLogger;
  logger.info(`pkg-action build v${VERSION} \u2014 orchestrator starting`);
  let inputs;
  try {
    inputs = parseInputs({
      registerSecret: (v) => setSecret(v),
      onUnknownInput: (name) => {
        let hint = closestInputName(name), suffix = hint !== null ? `. Did you mean "${hint}"?` : "";
        logger.warning(`Unknown input: "${name}"${suffix}`);
      }
    });
  } catch (err) {
    setFailed(formatErrorChain(err));
    return;
  }
  let workspace = process.env.GITHUB_WORKSPACE ?? process.cwd(), projectDir = (() => {
    let cfg = inputs.build.config;
    if (cfg !== void 0) {
      let absCfg = pathResolve(workspace, cfg);
      if (pathBasename(absCfg).toLowerCase() === "package.json")
        return dirname5(absCfg);
    }
    return workspace;
  })(), project = await readProjectInfo(projectDir);
  logger.info(`[pkg-action] project dir: ${projectDir}`), logger.info(`[pkg-action] project: ${project.name}@${project.version}`);
  let resolvedTargets = inputs.build.targets === "host" ? [hostTarget()] : [...inputs.build.targets];
  logger.info(`[pkg-action] targets: ${resolvedTargets.map(formatTarget).join(", ")}`);
  let runnerTemp = process.env.RUNNER_TEMP ?? tmpdir2(), invocationDir = await createInvocationTemp(runnerTemp);
  saveState("invocationDir", invocationDir);
  let pkgOutputDir = join7(invocationDir, "pkg-out");
  await mkdir3(pkgOutputDir, { recursive: !0 });
  let pkgCommand = inputs.build.pkgPath ?? "pkg", pkgBuildInputs = inputs.build.config !== void 0 && pathBasename(inputs.build.config).toLowerCase() === "package.json" ? { ...inputs.build, config: void 0 } : inputs.build, pkgArgs = buildPkgArgs({
    build: pkgBuildInputs,
    targets: resolvedTargets,
    outputDir: pkgOutputDir
  });
  logger.info(`[pkg-action] pkg ${pkgArgs.join(" ")}`);
  let started = Date.now();
  await runPkg(
    {
      build: pkgBuildInputs,
      targets: resolvedTargets,
      outputDir: pkgOutputDir,
      cwd: projectDir
    },
    { exec: execBridge, logger, pkgCommand }
  );
  let pkgDurationMs = Date.now() - started, pkgOutputs = await mapPkgOutputs(resolvedTargets, project.name, pkgOutputDir), windowsMeta = await parseWindowsMetadataInputs();
  windowsMeta !== null && logger.info("[pkg-action] Windows metadata detected \u2014 will patch win-* binaries post-rename.");
  let signing = parseSigningInputs({ registerSecret: (v) => setSecret(v) });
  signing !== null && logger.info(
    `[pkg-action] Signing configured \u2014 macOS=${String(signing.macos !== void 0)}, windows=${signing.windowsMode}.`
  );
  let finalDir = join7(invocationDir, "final");
  await mkdir3(finalDir, { recursive: !0 });
  let finalizedBinaries = [], finalizedArtifacts = [], shasumEntries = [], summaryRows = [], digestsByArtifact = {};
  for (let out of pkgOutputs) {
    let tokens = tokensForTarget(out.target, project, process.env), renamedBase = render(inputs.postBuild.filename, tokens), renamed = out.target.os === "win" && !renamedBase.toLowerCase().endsWith(".exe") ? `${renamedBase}.exe` : renamedBase, renamedPath = join7(finalDir, renamed);
    if (await rename3(out.path, renamedPath), windowsMeta !== null && out.target.os === "win") {
      let perBinary = {
        ...windowsMeta,
        originalFilename: windowsMeta.originalFilename ?? pathBasename(renamedPath)
      };
      await applyWindowsMetadata(renamedPath, renamedPath, perBinary), logger.info(`[pkg-action] Patched Windows resources on ${renamedPath}.`);
    }
    let signedFlag = !1;
    signing !== null && (signedFlag = await signOneTarget(
      { targetOs: out.target.os, binaryPath: renamedPath },
      signing,
      {
        exec: execBridge,
        logger,
        tempDir: invocationDir
      }
    )), finalizedBinaries.push(renamedPath);
    let finalPath = inputs.postBuild.compress === "none" ? renamedPath : await archiveBinary(out, renamedPath, inputs, tokens);
    finalizedArtifacts.push(finalPath);
    let rowDigest = await finalizeChecksums(finalPath, inputs.postBuild.checksum);
    for (let entry of rowDigest.entries) shasumEntries.push(entry);
    if (rowDigest.entries.length > 0) {
      let key = pathBasename(finalPath), byAlgo = {};
      for (let entry of rowDigest.entries) byAlgo[entry.algo] = entry.digest;
      digestsByArtifact[key] = byAlgo;
    }
    let { size } = await stat4(finalPath), row = {
      target: formatTarget(out.target),
      filename: finalPath,
      sizeBytes: size,
      ...signedFlag ? { signed: !0 } : {}
    };
    rowDigest.primary !== void 0 && (row.primaryDigest = rowDigest.primary), summaryRows.push(row);
  }
  let shasumsFiles = [];
  if (shasumEntries.length > 0)
    for (let algo of inputs.postBuild.checksum) {
      let entries = shasumEntries.filter((e) => e.algo === algo);
      if (entries.length === 0) continue;
      let shasumPath = join7(finalDir, `SHASUMS${algo.toUpperCase()}.txt`);
      await writeShasumsFile(shasumPath, entries), shasumsFiles.push(shasumPath);
    }
  if (inputs.performance.stepSummary) {
    let durationForFirst = summaryRows.length > 0 ? Math.round(pkgDurationMs / summaryRows.length) : void 0, rowsWithTime = summaryRows.map(
      (r) => durationForFirst !== void 0 ? { ...r, durationMs: durationForFirst } : r
    );
    await writeSummary(rowsWithTime, {
      actionVersion: VERSION,
      pkgVersion: inputs.build.pkgVersion
    });
  }
  setOutput("binaries", JSON.stringify(finalizedBinaries)), setOutput("artifacts", JSON.stringify(finalizedArtifacts)), setOutput("checksums", JSON.stringify(shasumsFiles)), setOutput("digests", JSON.stringify(digestsByArtifact)), setOutput("version", project.version), logger.info(`pkg-action build \u2014 done (${String(pkgOutputs.length)} binary/binaries produced)`);
}
async function signOneTarget(spec, signing, deps) {
  if (spec.targetOs === "macos" && signing.macos !== void 0) {
    let cleanup = await signMacos(spec.binaryPath, signing.macos, deps), prior = getState("macosKeychains"), next = prior === "" ? cleanup.keychainPath : `${prior}
${cleanup.keychainPath}`;
    return saveState("macosKeychains", next), !0;
  }
  if (spec.targetOs === "win") {
    if (signing.windowsMode === "signtool" && signing.windowsSigntool !== void 0)
      return await signWindowsSigntool(spec.binaryPath, signing.windowsSigntool, deps), !0;
    if (signing.windowsMode === "trusted-signing" && signing.windowsTrusted !== void 0)
      return await signWindowsTrustedSigning(spec.binaryPath, signing.windowsTrusted, deps), !0;
  }
  return !1;
}
async function archiveBinary(out, renamedPath, inputs, tokens) {
  let baseName = renamedPath.substring(0, renamedPath.length - extSuffix(renamedPath).length), archiveExt = archiveExtFor(inputs.postBuild.compress);
  if (archiveExt === void 0) return renamedPath;
  let archivePath = `${baseName}.${archiveExt}`;
  return await archive(
    {
      inputPath: renamedPath,
      outputPath: archivePath,
      // Use the same rendered basename inside the archive.
      format: inputs.postBuild.compress,
      entryName: render(inputs.postBuild.filename, tokens) + (out.target.os === "win" ? ".exe" : "")
    },
    { exec: execBridge }
  ), archivePath;
}
function extSuffix(path4) {
  let idx = path4.lastIndexOf(".");
  if (idx === -1) return "";
  let ext = path4.slice(idx);
  return ext.length <= 5 ? ext : "";
}
function archiveExtFor(format) {
  if (format === "tar.gz") return "tar.gz";
  if (format === "tar.xz") return "tar.xz";
  if (format === "zip") return "zip";
  if (format === "7z") return "7z";
}
async function finalizeChecksums(filePath, algos) {
  if (algos.length === 0) return { entries: [], primary: void 0 };
  let digests = await computeAllChecksums(filePath, algos), entries = [];
  for (let algo of algos) {
    let digest = digests[algo], sidecar = await writeSidecar(filePath, digest, algo);
    entries.push({ algo, path: sidecar, digest });
  }
  let firstAlgo = algos[0], primaryDigest = firstAlgo !== void 0 ? digests[firstAlgo] : void 0;
  return {
    entries,
    primary: firstAlgo !== void 0 && primaryDigest !== void 0 ? { algo: firstAlgo, value: primaryDigest } : void 0
  };
}
main().catch((err) => {
  setFailed(formatErrorChain(err));
});
