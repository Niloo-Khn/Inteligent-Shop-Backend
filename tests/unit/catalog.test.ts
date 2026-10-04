import test from "node:test";
import assert from "node:assert/strict";
import { signTopRequest } from "../../src/catalog.js";

test("AliExpress TOP signature is stable regardless of parameter insertion order",()=>{
  const first={method:"aliexpress.affiliate.product.query",app_key:"123",keywords:"pet bed",timestamp:"2026-10-04 12:00:00"};
  const second={timestamp:first.timestamp,keywords:first.keywords,app_key:first.app_key,method:first.method};
  assert.equal(signTopRequest(first,"secret"),signTopRequest(second,"secret"));
  assert.match(signTopRequest(first,"secret"),/^[A-F0-9]{32}$/);
});

test("AliExpress TOP signature changes when a request field changes",()=>{
  const original=signTopRequest({app_key:"123",keywords:"cat toy"},"secret");
  const changed=signTopRequest({app_key:"123",keywords:"dog toy"},"secret");
  assert.notEqual(original,changed);
});
