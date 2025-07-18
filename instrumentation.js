const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { diag, DiagConsoleLogger, DiagLogLevel, trace, context, propagation } = require('@opentelemetry/api');
const express = require('express');

// デバッグ用にOpenTelemetryの診断ログを有効化
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

defaultProvider = null;

function setupTracing() {
  if (defaultProvider) return defaultProvider;

  const traceExporter = new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'labo-observability-demo-app',
    }),
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start()
    .then(() => {
      // トレースIDを各リクエストで出力するためのラッパー
      const tracer = trace.getTracer('labo-observability-demo-app');
      // Expressのミドルウェアとして利用する場合は、アプリ側でtracerを使ってください
      console.log('OpenTelemetry tracing initialized');
    })
    .catch((error) => console.error('Error initializing OpenTelemetry', error));

  defaultProvider = sdk;
  return sdk;
}

// トレースIDをコンソールに出力するExpress用ミドルウェア
function traceIdLogger(req, res, next) {
  const span = trace.getSpan(trace.context.active());
  if (span) {
    const traceId = span.spanContext().traceId;
    console.log(`TraceID: ${traceId}`);
  }
  next();
}

const app = express();

setupTracing();

app.use((req, res, next) => {
  // traceparentヘッダーからコンテキスト抽出
  const parentContext = propagation.extract(context.active(), req.headers);
  const tracer = trace.getTracer('backend');
  const span = tracer.startSpan('GetStarted', undefined, parentContext);
  context.with(trace.setSpan(parentContext, span), () => {
    res.on('finish', () => {
      span.end();
    });
    next();
  });
});

// 既存のtraceIdLoggerも利用可能
app.use(traceIdLogger);

// ...他のルーティング...

module.exports = {
  setupTracing,
  traceIdLogger,
}; 