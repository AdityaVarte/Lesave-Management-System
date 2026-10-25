const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Employee = require('../models/Employee');
const LeaveType = require('../models/LeaveType');
const LeaveRequest = require('../models/LeaveRequest');

const chatService = require('../services/chatService');
const chatController = require('../controllers/chatController');
const slotFilling = require('../services/slotFilling');
const pendingActions = require('../services/pendingActions');

async function runResilienceTests() {
  console.log('================================================================');
  console.log('             TESTING CASES 25 - 26 (RESILIENCE)                 ');
  console.log('================================================================\n');

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const casual = await LeaveType.create({ type_name: 'Casual', max_days_per_request: 10, color: '#E4B84D' });
  const employee = await Employee.create({
    name: 'Rohan Sharma',
    email: 'rohan.resilience@company.com',
    department: 'Engineering',
    role: 'employee',
    total_leaves: 20,
    password: 'password123',
  });

  const { Writable } = require('stream');
  const createMockReqRes = (user, body = {}, params = {}) => {
    const req = { user, body, params, ip: '127.0.0.1' };
    let statusCode = 200;
    let jsonBody = null;
    const res = new Writable({ write(c, e, cb) { cb(); } });
    res.status = function(code) { statusCode = code; return this; };
    res.json = function(data) { jsonBody = data; return this; };
    res.setHeader = function() {};
    res.getStatusCode = () => statusCode;
    res.getBody = () => jsonBody;
    return { req, res };
  };

  const results = { case25: [], case26: [] };

  // ─────────────────────────────────────────────────────────────────
  // CASE 25: Invalid GEMINI_API_KEY Simulation
  // ─────────────────────────────────────────────────────────────────
  console.log('--- CASE 25: Invalid GEMINI_API_KEY Resilience ---');
  // Mock SDK to simulate invalid API key (HTTP 401 Unauthenticated)
  chatService._setMockGenerateContent(async () => {
    const err = new Error('API key not valid. Please pass a valid API key.');
    err.status = 401;
    throw err;
  });

  // 1. Balance must still work
  const { req: req1, res: res1 } = createMockReqRes(employee, { message: 'what is my balance' });
  await chatController.postChat(req1, res1, () => {});
  const b1 = res1.getBody();
  const c1 = res1.getStatusCode();
  const b1Pass = c1 === 200 && b1.source === 'rules' && b1.reply.includes('Your Leave Balance:');
  console.log(`  Rule Balance with invalid Gemini key: ${b1Pass ? 'PASS' : 'FAIL'} (Status ${c1}, source=${b1?.source})`);
  results.case25.push({ test: 'Balance with invalid key', pass: b1Pass, status: c1 });

  // 2. My leaves must still work
  const { req: req2, res: res2 } = createMockReqRes(employee, { message: 'show my leaves' });
  await chatController.postChat(req2, res2, () => {});
  const b2 = res2.getBody();
  const c2 = res2.getStatusCode();
  const b2Pass = c2 === 200 && b2.source === 'rules';
  console.log(`  Rule My Leaves with invalid Gemini key: ${b2Pass ? 'PASS' : 'FAIL'} (Status ${c2}, source=${b2?.source})`);
  results.case25.push({ test: 'My Leaves with invalid key', pass: b2Pass, status: c2 });

  // 3. PDF generation must still work
  const { req: req3, res: res3 } = createMockReqRes(employee, { message: 'pdf of my leaves' });
  await chatController.postChat(req3, res3, () => {});
  const b3 = res3.getBody();
  const c3 = res3.getStatusCode();
  const b3Pass = c3 === 200 && b3.source === 'rules';
  console.log(`  Rule PDF Export with invalid Gemini key: ${b3Pass ? 'PASS' : 'FAIL'} (Status ${c3}, source=${b3?.source})`);
  results.case25.push({ test: 'PDF Export with invalid key', pass: b3Pass, status: c3 });

  // 4. Unmatched question must return friendly error 502, NOT 500, NOT raw JSON
  const { req: req4, res: res4 } = createMockReqRes(employee, { message: 'what is the capital of Australia and its currency' });
  await chatController.postChat(req4, res4, () => {});
  const b4 = res4.getBody();
  const c4 = res4.getStatusCode();
  const b4Pass = c4 === 502 && b4.message === 'Assistant configuration error. Contact the administrator.';
  console.log(`  Unmatched query returns friendly 502: ${b4Pass ? 'PASS' : 'FAIL'} (Status ${c4}, message="${b4?.message}")`);
  results.case25.push({ test: 'Unmatched query returns friendly error', pass: b4Pass, status: c4 });

  chatService._clearMockGenerateContent();

  // ─────────────────────────────────────────────────────────────────
  // CASE 26: Server Restart in Middle of Draft
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- CASE 26: Server Restart During Draft Resilience ---');
  // 1. User starts slot filling: "apply leave"
  const { req: req5, res: res5 } = createMockReqRes(employee, { message: 'apply leave' });
  await chatController.postChat(req5, res5, () => {});
  const b5 = res5.getBody();
  console.log(`  Step 1 apply leave response: "${b5.reply}"`);

  // Verify slot state was created
  const stateBefore = slotFilling.getSlotState(employee._id);
  console.log(`  Slot state active: ${Boolean(stateBefore)}`);

  // 2. SIMULATE SERVER RESTART: All in-memory maps (slotStateMap, pendingActionsMap) are cleared
  console.log('  [Simulating server restart: clearing in-memory Maps]...');
  slotFilling.clearSlotState(employee._id);
  pendingActions._pendingActionsMap.clear();

  const stateAfter = slotFilling.getSlotState(employee._id);
  console.log(`  Slot state after restart: ${stateAfter === null ? 'null (cleared)' : 'still present'}`);

  // 3. User sends next step "Casual" after restart
  const { req: req6, res: res6 } = createMockReqRes(employee, { message: 'Casual' });
  await chatController.postChat(req6, res6, () => {});
  const b6 = res6.getBody();
  const c6 = res6.getStatusCode();
  console.log(`  Step 2 after restart response: status=${c6}, reply="${b6?.reply || b6?.message}"`);

  // 4. User attempts to confirm an expired / lost pending action ID
  const { req: req7, res: res7 } = createMockReqRes(employee, { actionId: 'pre-restart-action-uuid' });
  await chatController.confirmAction(req7, res7, () => {});
  const b7 = res7.getBody();
  const c7 = res7.getStatusCode();
  const c7Pass = c7 === 404 && b7?.message?.includes('does not exist');
  console.log(`  Confirm lost action ID: status=${c7}, message="${b7?.message}" -> ${c7Pass ? 'PASS' : 'FAIL'}`);

  results.case26.push({
    test: 'Draft reset and confirm lost action fails gracefully',
    pass: c7Pass && c6 === 200,
    status: c7,
  });

  const outPath = path.resolve(__dirname, '../tmp/resilience_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResilience results saved to ${outPath}`);

  await mongoose.disconnect();
  await mongod.stop();
}

runResilienceTests().catch(console.error);
